import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { isSupabaseConfigured } from '../utils/supabase'
import styles from './auth.module.css'

export function Splash({ children }) {
  return (
    <div className={styles.splash}>
      <img src="/favicon.svg" alt="" className={styles.splashLogo} />
      {children}
    </div>
  )
}

/**
 * Giriş ve erişim kontrolü. allowExpired: deneme/abonelik bitse de açılan sayfalar (hesap, abonelik).
 */
function RequireAuth({ allowExpired = false }) {
  const { status, profile, hasAccess, refreshProfile } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) {
    return (
      <Splash>
        <p>Kullanıcı sistemi yapılandırılmadı.</p>
        <p className="muted">VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlanmalı.</p>
      </Splash>
    )
  }
  if (status === 'loading') return <Splash />
  if (status === 'signedOut') {
    const from = location.pathname + location.search
    return <Navigate to="/giris" replace state={from !== '/' ? { from } : undefined} />
  }
  if (!profile) {
    return (
      <Splash>
        <p>Hesap bilgilerin yüklenemedi. İnternet bağlantını kontrol et.</p>
        <button className="btn btn-primary" onClick={refreshProfile}>Tekrar dene</button>
      </Splash>
    )
  }
  if (!hasAccess && !allowExpired) return <Navigate to="/abonelik" replace />
  return <Outlet />
}

export default RequireAuth
