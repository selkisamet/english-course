import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, ChartNoAxesColumn, Download, Layers, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import PwaStatus from '../PwaStatus'
import { onLocalChange } from '../../utils/changes'
import { useInstallPrompt } from '../../utils/pwa'
import { getTodayPlan } from '../../utils/studySession'
import styles from './AppLayout.module.css'

const NAV = [
  { to: '/', label: 'Hikayeler', icon: BookOpen, end: true },
  { to: '/vocabulary', label: 'Kelimeler', icon: Layers },
  { to: '/progress', label: 'İlerleme', icon: ChartNoAxesColumn },
  { to: '/hesap', label: 'Hesabım', icon: UserRound }
]

// Okuma ve kart çalışması ekranları odak modunda açılır: menü gizlenir
const FOCUS_ROUTES = [/^\/story\//, /^\/vocabulary\/study/]

/** Tekrar zamanı gelmiş kelime sayısı; sayfa değişince ve ilerleme değişince yeniden hesaplanır */
function useDueReviews(pathname) {
  const [version, setVersion] = useState(0)
  useEffect(() => onLocalChange((type) => type.startsWith('word') && setVersion((v) => v + 1)), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getTodayPlan().reviewTotal, [pathname, version])
}

const badgeText = (count) => (count > 99 ? '99+' : String(count))

function AppLayout() {
  const { pathname } = useLocation()
  const isFocus = FOCUS_ROUTES.some((re) => re.test(pathname))
  const { canInstall, install } = useInstallPrompt()
  const { hasAccess, isTrial, daysLeft } = useAuth()
  const trialEnding = hasAccess && isTrial && daysLeft <= 2
  const dueReviews = useDueReviews(pathname)
  const badgeFor = (to) => (to === '/vocabulary' && dueReviews > 0 ? dueReviews : 0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className={isFocus ? styles.shellFocus : styles.shell}>
      {!isFocus && (
        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <NavLink to="/" className={styles.brand}>
              <img src="/favicon.svg" alt="" className={styles.logo} />
              English Course
            </NavLink>

            <nav className={styles.desktopNav} aria-label="Ana menü">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
                >
                  <Icon size={18} strokeWidth={2.2} />
                  {label}
                  {badgeFor(to) > 0 && (
                    <span className={styles.navBadge}>
                      {badgeText(badgeFor(to))}
                      <span className="sr-only"> tekrar bekliyor</span>
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {canInstall && (
              <button className={styles.install} onClick={install}>
                <Download size={16} strokeWidth={2.4} />
                Yükle
              </button>
            )}
          </div>
        </header>
      )}

      {trialEnding && !isFocus && (
        <Link to="/abonelik" className={styles.trialBanner}>
          Deneme süren {daysLeft} gün içinde bitiyor · Üyelik seçenekleri
        </Link>
      )}

      <main className={isFocus ? undefined : styles.main}>
        <Outlet />
      </main>

      <PwaStatus aboveTabbar={!isFocus} />

      {!isFocus && (
        <nav className={styles.tabbar} aria-label="Ana menü">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}
            >
              <span className={styles.tabIcon}>
                <Icon size={22} strokeWidth={2} />
                {badgeFor(to) > 0 && (
                  <span className={styles.tabBadge}>
                    {badgeText(badgeFor(to))}
                    <span className="sr-only"> tekrar bekliyor</span>
                  </span>
                )}
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

export default AppLayout
