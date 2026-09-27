import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Trash2 } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { apiFetch } from '../utils/api'
import { useAuth } from '../auth/AuthProvider'
import { authErrorMessage, MIN_PASSWORD } from '../auth/errors'
import page from '../styles/page.module.css'
import styles from './Account.module.css'

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

const PROVIDERS = { google: 'Google', email: 'E-posta' }

function Membership() {
  const { profile, hasAccess, daysLeft, isTrial } = useAuth()
  let text
  if (!hasAccess) text = isTrial ? 'Deneme süren bitti.' : 'Aboneliğin sona erdi.'
  else if (isTrial) text = `Deneme süren devam ediyor: ${daysLeft} gün kaldı (${formatDate(profile.access_until)}).`
  else text = `Aboneliğin ${formatDate(profile.access_until)} tarihine kadar geçerli.`

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Üyelik</h2>
      <p>{text}</p>
      {!hasAccess && <Link to="/abonelik" className="btn btn-primary">Aboneliği başlat</Link>}
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
        <dd>{user.email}</dd>
        <dt>Giriş yöntemi</dt>
        <dd>{providers.map((p) => PROVIDERS[p] || p).join(', ') || '—'}</dd>
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
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    setMessage(error ? authErrorMessage(error) : 'Şifren güncellendi.')
    if (!error) setPassword('')
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Şifre</h2>
      <p className="muted">Google ya da e-posta koduyla giriş yapıyorsan şifre belirlemen gerekmez.</p>
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
  const { signOut } = useAuth()
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
      <button type="button" className="btn btn-danger" onClick={deleteAccount} disabled={busy}>
        <Trash2 size={16} /> Hesabımı sil
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}

function Account() {
  const { profile, signOut } = useAuth()

  return (
    <div className={page.page}>
      <header className={page.header}>
        <h1 className={page.title}>{profile.display_name ? `Merhaba, ${profile.display_name}` : 'Hesabım'}</h1>
      </header>

      <div className={styles.stack}>
        <Membership />
        <ProfileCard />
        <PasswordCard />
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
