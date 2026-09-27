import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../utils/supabase'
import { endSync, startSync } from '../utils/sync'
import { clearApiCaches } from '../utils/api'

const AuthContext = createContext(null)
const PROFILE_KEY = 'profileCache' // çevrimdışıyken son bilinen erişim durumu
const DAY = 24 * 60 * 60 * 1000
const SYNC_TIMEOUT = 6000

const readCachedProfile = (userId) => {
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_KEY))
    return cached?.id === userId ? cached : null
  } catch {
    return null
  }
}

// İlk eşitleme uzun sürerse (yavaş bağlantı) uygulamayı bekletme
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((r) => setTimeout(r, ms))])

export function AuthProvider({ children }) {
  // loading: oturum kontrol ediliyor · signedOut · ready: giriş yapılmış ve ilk eşitleme bitti
  const [status, setStatus] = useState('loading')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [recovery, setRecovery] = useState(false)
  const currentUser = useRef(null)

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, subscription_status, trial_ends_at, access_until, created_at')
      .eq('id', userId)
      .single()
    if (error) {
      // Çevrimdışı: son bilinen profil
      const cached = readCachedProfile(userId)
      if (cached) setProfile(cached)
      return cached
    }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data))
    setProfile(data)
    return data
  }, [])

  const enter = useCallback(
    async (nextSession) => {
      const userId = nextSession.user.id
      setSession(nextSession)
      if (currentUser.current === userId) return
      currentUser.current = userId
      setProfile(readCachedProfile(userId))
      await Promise.all([loadProfile(userId), withTimeout(startSync(userId), SYNC_TIMEOUT)])
      setStatus('ready')
    },
    [loadProfile]
  )

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) enter(data.session)
      else setStatus('signedOut')
    })

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Supabase çağrıları bu geri çağrının içinde beklenmemeli; bir sonraki adıma ertelenir
      setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') setRecovery(true)
        if (nextSession) enter(nextSession)
        else if (event === 'SIGNED_OUT') {
          currentUser.current = null
          setSession(null)
          setProfile(null)
          setStatus('signedOut')
        }
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [enter])

  // Sunucu "erişim süresi doldu" derse profili yenile (kilit ekranına yönlendirilir)
  useEffect(() => {
    const onExpired = () => currentUser.current && loadProfile(currentUser.current)
    window.addEventListener('access-expired', onExpired)
    return () => window.removeEventListener('access-expired', onExpired)
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await endSync()
    localStorage.removeItem(PROFILE_KEY)
    clearApiCaches()
    if ('caches' in window) {
      await Promise.all(['stories', 'annotations', 'vocabulary'].map((name) => caches.delete(name)))
    }
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(() => {
    const accessUntil = profile ? new Date(profile.access_until).getTime() : 0
    const msLeft = accessUntil - Date.now()
    return {
      status,
      session,
      user: session?.user ?? null,
      profile,
      hasAccess: msLeft > 0,
      daysLeft: Math.max(0, Math.ceil(msLeft / DAY)),
      isTrial: profile?.subscription_status === 'trial',
      recovery,
      clearRecovery: () => setRecovery(false),
      refreshProfile: () => currentUser.current && loadProfile(currentUser.current),
      signOut
    }
  }, [status, session, profile, recovery, loadProfile, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
