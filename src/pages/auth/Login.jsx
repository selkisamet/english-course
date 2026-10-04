import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { authErrorMessage, isValidEmail, MIN_PASSWORD } from '../../auth/errors'
import styles from '../../auth/auth.module.css'

const RESEND_SECONDS = 60

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function Login() {
  const { status } = useAuth()
  const location = useLocation()
  // start: Google + e-posta kodu · code: kod girişi · password: şifreyle giriş / hesap açma
  const [mode, setMode] = useState('start')
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  if (status === 'ready') return <Navigate to={location.state?.from || '/'} replace />

  const go = (next) => {
    setMode(next)
    setError('')
    setInfo('')
  }

  const run = async (action) => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await action()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const signInWithGoogle = () =>
    run(async () => {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${location.state?.from || '/'}` }
      })
      if (err) throw err
    })

  const sendCode = (e) => {
    e?.preventDefault()
    if (!isValidEmail(email)) return setError('Geçerli bir e-posta adresi yaz.')
    run(async () => {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true, emailRedirectTo: window.location.origin }
      })
      if (err) throw err
      setCode('')
      setMode('code')
      setResendIn(RESEND_SECONDS)
    })
  }

  const verifyCode = (e) => {
    e.preventDefault()
    run(async () => {
      const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
      if (err) throw err
    })
  }

  const submitPassword = (e) => {
    e.preventDefault()
    if (!isValidEmail(email)) return setError('Geçerli bir e-posta adresi yaz.')
    if (tab === 'signup' && password.length < MIN_PASSWORD) {
      return setError(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`)
    }
    run(async () => {
      if (tab === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
        return
      }
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin }
      })
      if (err) throw err
      // Kayıtlı e-posta: Supabase hata yerine kimliksiz bir kullanıcı döner ve e-posta göndermez
      if (data.user && data.user.identities?.length === 0) {
        return setError('Bu e-posta ile zaten bir hesap var. "Giriş yap" sekmesini kullan ya da şifreni yenile.')
      }
      // E-posta doğrulaması açıksa oturum hemen açılmaz
      if (!data.session) setInfo('Hesabın oluşturuldu. E-postana gönderdiğimiz bağlantıya tıklayarak adresini doğrula.')
    })
  }

  const forgotPassword = () => {
    if (!isValidEmail(email)) return setError('Önce e-posta adresini yaz.')
    run(async () => {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/sifre-yenile`
      })
      if (err) throw err
      setInfo('Şifre yenileme bağlantısını e-postana gönderdik.')
    })
  }

  const emailField = (
    <label className={styles.field}>
      <span>E-posta</span>
      <input
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ornek@eposta.com"
        required
      />
    </label>
  )

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src="/favicon.svg" alt="" />
          English Course
        </div>

        {mode === 'start' && (
          <>
            <h1 className={styles.title}>Hoş geldin</h1>
            <p className={styles.lead}>Giriş yap ya da hesap oluştur. Yeni hesaplarda deneme süresi hemen başlar.</p>

            <button type="button" className={`btn btn-lg btn-block ${styles.google}`} onClick={signInWithGoogle} disabled={busy}>
              <GoogleIcon /> Google ile devam et
            </button>

            <div className={styles.divider}>ya da</div>

            <form onSubmit={sendCode} className={styles.form} noValidate>
              {emailField}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
                <Mail size={18} /> E-postama giriş kodu gönder
              </button>
            </form>

            <button type="button" className={styles.linkBtn} onClick={() => go('password')}>
              Şifreyle giriş yap
            </button>
          </>
        )}

        {mode === 'code' && (
          <form onSubmit={verifyCode} className={styles.form}>
            <button type="button" className="icon-btn" onClick={() => go('start')} aria-label="Geri">
              <ArrowLeft size={20} />
            </button>
            <h1 className={styles.title}>Kodu gir</h1>
            <p className={styles.lead}>
              <strong>{email.trim()}</strong> adresine bir giriş kodu gönderdik. Gelen kutunu (ve istenmeyen
              klasörünü) kontrol et.
            </p>
            <label className={styles.field}>
              <span>Giriş kodu</span>
              <input
                className={styles.code}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </label>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || code.length < 6}>
              Giriş yap
            </button>
            <button type="button" className={styles.linkBtn} onClick={sendCode} disabled={busy || resendIn > 0}>
              {resendIn > 0 ? `Yeni kod (${resendIn} sn)` : 'Yeni kod gönder'}
            </button>
          </form>
        )}

        {mode === 'password' && (
          <form onSubmit={submitPassword} className={styles.form} noValidate>
            <button type="button" className="icon-btn" onClick={() => go('start')} aria-label="Geri">
              <ArrowLeft size={20} />
            </button>
            <div className={styles.tabs} role="group" aria-label="Giriş türü">
              <button type="button" aria-pressed={tab === 'signin'} onClick={() => { setTab('signin'); setError(''); setInfo('') }}>
                Giriş yap
              </button>
              <button type="button" aria-pressed={tab === 'signup'} onClick={() => { setTab('signup'); setError(''); setInfo('') }}>
                Hesap oluştur
              </button>
            </div>
            {emailField}
            <label className={styles.field}>
              <span>Şifre</span>
              <input
                type="password"
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'signup' ? `En az ${MIN_PASSWORD} karakter` : ''}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {tab === 'signin' ? 'Giriş yap' : 'Hesap oluştur'}
            </button>
            {tab === 'signin' && (
              <button type="button" className={styles.linkBtn} onClick={forgotPassword} disabled={busy}>
                Şifremi unuttum
              </button>
            )}
          </form>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}
        {info && <p className={styles.info} role="status">{info}</p>}

        <p className={styles.legal}>
          Devam ederek <Link to="/kosullar">Kullanım Koşulları</Link>'nı ve{' '}
          <Link to="/gizlilik">Gizlilik Politikası</Link>'nı kabul etmiş olursun.
        </p>
      </div>
    </div>
  )
}

export default Login
