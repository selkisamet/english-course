import { RefreshCw, WifiOff, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useOnline } from '../utils/pwa'
import styles from './PwaStatus.module.css'

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000

// Çevrimdışı uyarısı ve "yeni sürüm hazır" bildirimi
function PwaStatus({ aboveTabbar }) {
  const online = useOnline()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Uzun süre açık kalan uygulama da güncellemeleri fark etsin
      if (registration) setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL)
    }
  })

  if (online && !needRefresh) return null

  return (
    <div className={styles.stack} data-tabbar={aboveTabbar} aria-live="polite">
      {!online && (
        <div className={styles.toast}>
          <WifiOff size={18} className={styles.icon} />
          <span>Çevrimdışısın. Daha önce açtığın hikayeler ve kelimeler kullanılabilir.</span>
        </div>
      )}
      {needRefresh && (
        <div className={styles.toast}>
          <RefreshCw size={18} className={styles.icon} />
          <span>Yeni sürüm hazır.</span>
          <button className={styles.action} onClick={() => updateServiceWorker(true)}>
            Yenile
          </button>
          <button className={styles.close} onClick={() => setNeedRefresh(false)} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export default PwaStatus
