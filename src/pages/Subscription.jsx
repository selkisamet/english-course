import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Check, Lock, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { buyPlan, canPurchase, getPlans, LISTED_PRICES, restorePurchases } from '../utils/billing'
import styles from './Subscription.module.css'

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL

const PLAN_TITLES = { yearly: 'Yıllık', monthly: 'Aylık', lifetime: 'Ömür boyu' }
const PERIODS = { yearly: ' / yıl', monthly: ' / ay', lifetime: '' }

// TL tutarları mağazadaki gibi yazılır: "58,33 ₺" (Intl "₺58,33" yazıyor)
const formatTry = (amount, currency) =>
  currency === 'TRY'
    ? `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ₺`
    : new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)

const BENEFITS = ["A1'den C2'ye 300 hikaye, sesli okuma", 'Kişisel tekrar planıyla kelime çalışması', "Telefon ve web'de aynı hesap"]

/** Planın altındaki açıklama; tasarruf oranı mağazanın gerçek fiyatlarından hesaplanır (aşağı yuvarlanır) */
function planDetail(plan, plans) {
  if (plan.kind === 'monthly') return 'İstediğin zaman iptal'
  if (plan.kind === 'lifetime') return 'Tek seferlik ödeme, yenileme yok'
  const monthly = plans.find((p) => p.kind === 'monthly')
  const perMonth = formatTry(plan.price / 12, plan.currency)
  if (!monthly || monthly.currency !== plan.currency) return `Ayda ${perMonth}`
  const saving = Math.floor((1 - plan.price / (monthly.price * 12)) * 100)
  return saving > 0 ? `Ayda ${perMonth} · %${saving} tasarruf` : `Ayda ${perMonth}`
}

/** Planın adı, açıklaması ve fiyatı (mağaza seçeneğinde de web listesinde de aynı) */
function PlanBody({ plan, plans }) {
  return (
    <>
      {plan.kind === 'yearly' && <span className={styles.badge}>EN AVANTAJLI</span>}
      <span className={styles.planText}>
        <strong>{PLAN_TITLES[plan.kind]}</strong>
        <small>{planDetail(plan, plans)}</small>
      </span>
      <span className={styles.price}>
        {plan.priceString}
        <small>{PERIODS[plan.kind]}</small>
      </span>
    </>
  )
}

// Web'de gösterilen fiyatlar (mağazadaki TL fiyatlarla aynı)
const parseTry = (text) => Number(text.replace(/[^\d,]/g, '').replace(',', '.'))
const WEB_PLANS = ['yearly', 'monthly', 'lifetime'].map((kind) => ({
  kind,
  price: parseTry(LISTED_PRICES[kind]),
  currency: 'TRY',
  priceString: LISTED_PRICES[kind]
}))

function Heading({ profile, hasAccess, daysLeft }) {
  if (hasAccess) {
    return (
      <>
        <h1 className={styles.title}>Öğrenmeye devam et</h1>
        <p className={styles.lead}>
          {daysLeft <= 1 ? 'Deneme süren bugün bitiyor.' : `Deneme süren ${daysLeft} gün sonra bitiyor.`} İlerlemen
          hesabında güvende.
        </p>
      </>
    )
  }
  return (
    <>
      {/* Erişim deneme bitişinden sonraya uzanmışsa daha önce ücretli üyelik vardı */}
      <h1 className={styles.title}>
        {new Date(profile.access_until) > new Date(profile.trial_ends_at) ? 'Üyeliğin sona erdi' : 'Deneme süren bitti'}
      </h1>
      <p className={styles.lead}>Hikayeler, kelime çalışması ve ilerlemen hesabında güvende. Devam etmek için üyelik başlat.</p>
    </>
  )
}

/** Telefon uygulaması: mağazadan satın alma */
function StorePlans({ onPurchased }) {
  const [plans, setPlans] = useState(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState('yearly')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setFailed(false)
    getPlans()
      .then((list) => {
        setPlans(list)
        if (list.length && !list.some((p) => p.kind === 'yearly')) setSelected(list[0].kind)
      })
      .catch(() => setFailed(true))
  }, [])
  useEffect(load, [load])

  const plan = plans?.find((p) => p.kind === selected)

  const buy = async () => {
    if (!plan) return
    setBusy(true)
    setError('')
    try {
      const result = await buyPlan(plan)
      if (!result.cancelled) onPurchased(plan.kind)
    } catch {
      setError('Satın alma tamamlanamadı. Ücret alındıysa "Satın alımları geri yükle" ile üyeliğini etkinleştirebilirsin.')
    } finally {
      setBusy(false)
    }
  }

  const restore = async () => {
    setBusy(true)
    setError('')
    try {
      const membership = await restorePurchases()
      if (membership?.subscription_status === 'active') onPurchased(membership.plan)
      else setError('Bu hesapla yapılmış bir satın alım bulunamadı.')
    } catch {
      setError('Satın alımlar geri yüklenemedi. Bağlantını kontrol edip tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  if (failed) {
    return (
      <div className={styles.notice}>
        <p>Üyelik seçenekleri yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.</p>
        <button type="button" className="btn btn-secondary" onClick={load}>Tekrar dene</button>
      </div>
    )
  }
  if (!plans) return <div className={`skeleton ${styles.plansSkeleton}`} />

  return (
    <>
      <div role="radiogroup" aria-label="Üyelik seçenekleri" className={styles.plans}>
        {plans.map((p) => (
          <button
            key={p.kind}
            type="button"
            role="radio"
            aria-checked={selected === p.kind}
            className={styles.plan}
            onClick={() => setSelected(p.kind)}
          >
            <span className={styles.radio} aria-hidden="true" />
            <PlanBody plan={p} plans={plans} />
          </button>
        ))}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={buy} disabled={busy || !plan}>
        {plan?.kind === 'lifetime' ? 'Ömür boyu üyeliği al' : `${PLAN_TITLES[selected]} üyeliği başlat`}
      </button>
      <p className={styles.fine}>
        Ödeme Google Play hesabından hemen alınır.{' '}
        {plan?.kind !== 'lifetime' &&
          'Abonelik, dönem bitmeden Google Play’den iptal edilmezse aynı ücretle otomatik yenilenir. '}
        Fiyatlara vergiler dahildir.
      </p>
      <div className={styles.links}>
        <button type="button" className={styles.linkBtn} onClick={restore} disabled={busy}>
          Satın alımları geri yükle
        </button>
        <Link to="/kosullar">Koşullar</Link>
        <Link to="/gizlilik">Gizlilik</Link>
      </div>
    </>
  )
}

/** Web: ödeme şimdilik uygulamadan (web ödemesi şirket kurulunca eklenecek) */
function WebPlans() {
  return (
    <>
      <ul className={styles.plans} aria-label="Üyelik seçenekleri">
        {WEB_PLANS.map((p) => (
          <li key={p.kind} className={styles.plan} data-featured={p.kind === 'yearly'}>
            <PlanBody plan={p} plans={WEB_PLANS} />
          </li>
        ))}
      </ul>
      {PLAY_STORE_URL ? (
        <>
          <p className={styles.note}>
            Üyeliği şimdilik telefon uygulamasından başlatabilirsin. Uygulamada aynı hesapla giriş yap; üyelik web’de de
            hemen geçerli olur.
          </p>
          <a className="btn btn-primary btn-lg btn-block" href={PLAY_STORE_URL} target="_blank" rel="noreferrer">
            Uygulamayı Google Play’den indir
          </a>
        </>
      ) : CONTACT_EMAIL ? (
        <a className="btn btn-primary btn-lg btn-block" href={`mailto:${CONTACT_EMAIL}?subject=Üyelik`}>
          Üyelik için bize yaz
        </a>
      ) : (
        <p className={styles.note}>Üyelik satın alma çok yakında burada olacak.</p>
      )}
    </>
  )
}

function Success({ kind }) {
  const navigate = useNavigate()
  return (
    <div className={styles.success}>
      <span className={styles.successIcon} aria-hidden="true">
        <Check size={38} strokeWidth={2.4} />
      </span>
      <h1 className={styles.title}>Hoş geldin!</h1>
      <p className={styles.lead}>
        {kind === 'lifetime' ? 'Ömür boyu üyeliğin başladı.' : `${PLAN_TITLES[kind] || ''} üyeliğin başladı.`} Aynı hesapla
        web’de de kullanabilirsin.
      </p>
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate('/', { replace: true })}>
        Kaldığın yerden devam et
      </button>
    </div>
  )
}

function Subscription() {
  const { profile, hasAccess, daysLeft, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [purchased, setPurchased] = useState(null)

  const onPurchased = async (kind) => {
    await refreshProfile()
    setPurchased(kind || 'yearly')
  }

  if (purchased) {
    return (
      <div className={styles.screen}>
        <Success kind={purchased} />
      </div>
    )
  }
  // Ücretli üyeliği olan bu sayfayı görmez
  if (profile?.subscription_status === 'active') return <Navigate to="/hesap" replace />

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.top}>
          <span className={styles.lock} aria-hidden="true">
            <Lock size={20} />
          </span>
          {hasAccess && (
            <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => navigate(-1)}>
              <X size={22} />
            </button>
          )}
        </div>

        <Heading profile={profile} hasAccess={hasAccess} daysLeft={daysLeft} />

        <ul className={styles.benefits}>
          {BENEFITS.map((b) => (
            <li key={b}>
              <Check size={18} strokeWidth={2.5} aria-hidden="true" /> {b}
            </li>
          ))}
        </ul>

        {canPurchase ? <StorePlans onPurchased={onPurchased} /> : <WebPlans />}

        {!hasAccess && (
          <div className={styles.links}>
            <Link to="/hesap">Hesabım</Link>
            <button type="button" className={styles.linkBtn} onClick={signOut}>Çıkış yap</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Subscription
