import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Splash } from '../../auth/RequireAuth'
import { authErrorMessage, MIN_PASSWORD } from '../../auth/errors'
import styles from '../../auth/auth.module.css'

// E-postadaki "şifreni yenile" bağlantısı buraya açılır; bağlantı geçici bir oturum başlatır
function ResetPassword() {
  const { status, clearRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (status === 'loading') return <Splash />
  if (status === 'signedOut') {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1 className={styles.title}>Bağlantı geçersiz</h1>
          <p className={styles.lead}>Şifre yenileme bağlantısının süresi dolmuş ya da daha önce kullanılmış.</p>
          <Link to="/giris" className="btn btn-primary btn-lg btn-block">Giriş ekranına dön</Link>
        </div>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`)
    if (password !== repeat) return setError('Şifreler aynı değil.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError(authErrorMessage(err))
    clearRecovery()
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={submit} noValidate>
        <h1 className={styles.title}>Yeni şifre belirle</h1>
        <label className={styles.field}>
          <span>Yeni şifre</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`En az ${MIN_PASSWORD} karakter`}
            autoFocus
          />
        </label>
        <label className={styles.field}>
          <span>Yeni şifre (tekrar)</span>
          <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          Şifreyi kaydet
        </button>
      </form>
    </div>
  )
}

export default ResetPassword
