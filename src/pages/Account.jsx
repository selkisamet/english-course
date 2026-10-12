import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Trash2 } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { apiFetch } from '../utils/api'
import { useAuth } from '../auth/AuthProvider'
import ReminderSettings from '../components/ReminderSettings'
import { authErrorMessage, MIN_PASSWORD } from '../auth/errors'
import page from '../styles/page.module.css'
import styles from './Account.module.css'

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

// Supabase e-posta kodu ve şifreyi aynı 'email' yöntemi sayar; şifreli hesaplar user_metadata.has_password ile ayrılır
const providerLabel = (provider, hasPassword) =>
  provider === 'google' ? 'Google' : provider === 'email' ? (hasPassword ? 'E-posta ve şifre' : 'E-posta kodu') : provider

const PLAN_NAMES = { monthly: 'Aylık', yearly: 'Yıllık', lifetime: 'Ömür boyu' }

function Membership() {
  const { profile, hasAccess, daysLeft } = useAuth()
  const paid = hasAccess && profile.subscription_status === 'active' && profile.plan
  const until = formatDate(profile.access_until)
  // Abonelikte yenilenme / bitiş tarihi deneme bitişinden bağımsızdır
  const periodEnd = profile.period_ends_at ? formatDate(profile.period_ends_at) : until
  // Ödeme yönetimi mağazada (iptal, ödeme yöntemi, yeniden başlatma)
  const manage = profile.management_url && (
    <a href={profile.management_url} target="_blank" rel="noreferrer" className={styles.link}>
      Aboneliği Google Play’de yönet
    </a>
  )

  let body
  if (paid && profile.plan === 'lifetime') {
    body = <p>Ömür boyu üyesin. Yenileme yok, ek ödeme yok.</p>
  } else if (paid) {
    const name = PLAN_NAMES[profile.plan].toLocaleLowerCase('tr')
    body = (
      <>
        {profile.billing_issue && (
          <p className={styles.warning}>Son ödeme alınamadı. Üyeliğin kesilmemesi için Google Play’de ödeme yöntemini güncelle.</p>
        )}
        <p>
          {profile.renews
            ? `${PLAN_NAMES[profile.plan]} aboneliğin ${periodEnd} tarihinde yenilenecek.`
            : `${PLAN_NAMES[profile.plan]} aboneliğin iptal edildi; ${until} tarihine kadar kullanabilirsin.`}
        </p>
        {manage}
        {!profile.renews && !profile.management_url && (
          <Link to="/abonelik" className={styles.link}>Yeni {name} üyelik başlat</Link>
        )}
      </>
    )
  } else if (hasAccess) {
    body = (
      <>
        <p>Deneme süren devam ediyor: {daysLeft} gün kaldı ({until}).</p>
        <Link to="/abonelik" className="btn btn-primary">Üyelik seçeneklerini gör</Link>
      </>
    )
  } else {
    const hadPaid = new Date(profile.access_until) > new Date(profile.trial_ends_at)
    body = (
      <>
        <p>{hadPaid ? 'Üyeliğin sona erdi.' : 'Deneme süren bitti.'}</p>
        <Link to="/abonelik" className="btn btn-primary">Üyelik başlat</Link>
      </>
    )
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Üyelik</h2>
        {paid && <span className={styles.planBadge} data-plan={profile.plan}>{PLAN_NAMES[profile.plan]}</span>}
      </div>
      {body}
    </section>
  )
}

function ProfileCard() {
  const { user, profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile.display_name || '')
  const [message, setMessage] = useState('')
  const providers = (user.app_metadata?.providers || [user.app_metadata?.provider]).filter(Boolean)

  const save = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() || null }).eq('id', user.id)
    setMessage(error ? 'Kaydedilemedi, tekrar dene.' : 'Kaydedildi.')
    if (!error) refreshProfile()
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Profil</h2>
      <dl className={styles.facts}>
        <dt>E-posta</dt>
        <dd className={styles.nowrap} title={user.email}>{user.email}</dd>
        <dt>Giriş yöntemi</dt>
        <dd>{providers.map((p) => providerLabel(p, user.user_metadata?.has_password)).join(', ') || '—'}</dd>
      </dl>
      <form className={styles.inline} onSubmit={save}>
        <label className={styles.field}>
          <span>Adın</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
        </label>
        <button type="submit" className="btn btn-secondary">Kaydet</button>
      </form>
      {message && <p className="muted">{message}</p>}
    </section>
  )
}

function PasswordCard() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setMessage(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`)
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } })
    setBusy(false)
    setMessage(error ? authErrorMessage(error) : 'Şifren güncellendi.')
    if (!error) setPassword('')
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Şifreyi değiştir</h2>
      <form className={styles.inline} onSubmit={save}>
        <label className={styles.field}>
          <span>Yeni şifre</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`En az ${MIN_PASSWORD} karakter`}
          />
        </label>
        <button type="submit" className="btn btn-secondary" disabled={busy}>Şifreyi kaydet</button>
      </form>
      {message && <p className="muted">{message}</p>}
    </section>
  )
}

function DangerZone() {
  const { signOut, profile } = useAuth()
  // Abonelik mağazada sürer: hesap silinince ücret alınmaya devam etmesin diye önce iptal edilmeli
  const renewing = profile?.subscription_status === 'active' && profile?.renews
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const deleteAccount = async () => {
    const answer = prompt(
      'Hesabın ve bütün ilerlemen kalıcı olarak silinecek. Bu işlem geri alınamaz.\n\nOnaylamak için SİL yaz:'
    )
    if (answer?.trim().toLocaleUpperCase('tr') !== 'SİL') return
    setBusy(true)
    setError('')
    try {
      const response = await apiFetch('/api/account', { method: 'DELETE' })
      if (!response.ok) throw new Error(response.status)
      await signOut().catch(() => {})
    } catch {
      setError('Hesap silinemedi. İnternet bağlantını kontrol edip tekrar dene.')
      setBusy(false)
    }
  }

  return (
    <section className={`${styles.card} ${styles.danger}`}>
      <h2 className={styles.cardTitle}>Hesabı sil</h2>
      <p className="muted">Hesabın, kelime ilerlemen ve okuma geçmişin kalıcı olarak silinir.</p>
      {renewing && (
        <p className={styles.warning}>
          Aboneliğin Google Play’de sürüyor. Hesabını silmek aboneliği iptal etmez; ücret alınmaması için önce
          aboneliği Google Play’den iptal et.
        </p>
      )}
      <button type="button" className="btn btn-danger" onClick={deleteAccount} disabled={busy}>
        <Trash2 size={16} /> Hesabımı sil
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}

function Account() {
  const { user, profile, signOut } = useAuth()
  const hasPassword = Boolean(user.user_metadata?.has_password)

  return (
    <div className={page.page}>
      <header className={page.header}>
        <h1 className={page.title}>{profile.display_name ? `Merhaba, ${profile.display_name}` : 'Hesabım'}</h1>
      </header>

      <div className={styles.stack}>
        <Membership />
        <ReminderSettings email={user.email} />
        <ProfileCard />
        {hasPassword && <PasswordCard />}
        <button type="button" className="btn btn-secondary btn-block" onClick={signOut}>
          <LogOut size={18} /> Çıkış yap
        </button>
        <DangerZone />
        <p className={styles.legal}>
          <Link to="/kosullar">Kullanım Koşulları</Link> · <Link to="/gizlilik">Gizlilik Politikası</Link>
        </p>
      </div>
    </div>
  )
}

export default Account
