import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Layers, ChartNoAxesColumn } from 'lucide-react'
import styles from './AppLayout.module.css'

const NAV = [
  { to: '/', label: 'Hikayeler', icon: BookOpen, end: true },
  { to: '/vocabulary', label: 'Kelimeler', icon: Layers },
  { to: '/progress', label: 'İlerleme', icon: ChartNoAxesColumn }
]

// Okuma ve kart çalışması ekranları odak modunda açılır: menü gizlenir
const FOCUS_ROUTES = [/^\/story\//, /^\/vocabulary\/study/]

function AppLayout() {
  const { pathname } = useLocation()
  const isFocus = FOCUS_ROUTES.some((re) => re.test(pathname))

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className={isFocus ? styles.shellFocus : styles.shell}>
      {!isFocus && (
        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <NavLink to="/" className={styles.brand}>
              <span className={styles.logo} aria-hidden="true">E</span>
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
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
      )}

      <main className={isFocus ? undefined : styles.main}>
        <Outlet />
      </main>

      {!isFocus && (
        <nav className={styles.tabbar} aria-label="Ana menü">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}
            >
              <Icon size={22} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

export default AppLayout
