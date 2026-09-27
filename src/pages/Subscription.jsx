import { Link, Navigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import styles from '../auth/auth.module.css'

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL

// Deneme süresi ya da abonelik bittiğinde gösterilir. Ödeme sistemi eklenince satın alma buraya gelir.
function Subscription() {
  const { hasAccess, isTrial, signOut } = useAuth()
  if (hasAccess) return <Navigate to="/" replace />

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <span className="icon-btn icon-btn-soft" aria-hidden="true">
          <Lock size={20} />
        </span>
        <h1 className={styles.title}>{isTrial ? 'Deneme süren bitti' : 'Aboneliğin sona erdi'}</h1>
        <p className={styles.lead}>
          Hikayeler, kelime çalışması ve ilerlemen hesabında güvende. Devam etmek için aboneliğini
          başlatman gerekiyor.
        </p>
        {CONTACT_EMAIL ? (
          <a className="btn btn-primary btn-lg btn-block" href={`mailto:${CONTACT_EMAIL}?subject=Abonelik`}>
            Abonelik için bize yaz
          </a>
        ) : (
          <p className={styles.info}>Abonelik satın alma çok yakında burada olacak.</p>
        )}
        <div className={styles.row}>
          <Link to="/hesap" className="btn btn-ghost">Hesabım</Link>
          <button type="button" className="btn btn-ghost" onClick={signOut}>Çıkış yap</button>
        </div>
      </div>
    </div>
  )
}

export default Subscription
