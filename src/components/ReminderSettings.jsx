import { useEffect, useState } from 'react'
import { isNative } from '../utils/platform'
import {
  enablePushOnDevice,
  fetchReminderPrefs,
  pushPermission,
  REMINDER_HOURS,
  saveReminderPrefs,
  sendTestNotification
} from '../utils/reminders'
import styles from './ReminderSettings.module.css'

const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.switch}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span />
    </button>
  )
}

/** Hesabım › Günlük hatırlatma: telefon bildirimi ve e-posta ayrı ayrı, ortak saat */
function ReminderSettings({ email }) {
  const [prefs, setPrefs] = useState(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [permission, setPermission] = useState('unsupported')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchReminderPrefs().then(setPrefs).catch(() => setFailed(true))
    pushPermission().then(setPermission).catch(() => {})
  }, [])

  const showPush = isNative && prefs?.pushAvailable
  const showEmail = prefs?.emailAvailable
  // Tarayıcıda ve e-posta gönderimi kurulmamışken bu bölüm gösterilmez
  if (failed || (prefs && !showPush && !showEmail)) return null
  if (!prefs) return <div className={`skeleton ${styles.skeleton}`} />

  const update = async (changes) => {
    setBusy(true)
    setMessage('')
    try {
      setPrefs(await saveReminderPrefs(changes))
    } catch {
      setMessage('Kaydedilemedi, bağlantını kontrol edip tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  const togglePush = async (on) => {
    if (!on) return update({ pushEnabled: false })
    setBusy(true)
    try {
      const granted = await enablePushOnDevice()
      setPermission(await pushPermission())
      if (granted) await update({ pushEnabled: true })
    } catch {
      setMessage('Bildirimler açılamadı, tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setMessage('')
    try {
      const { sent } = await sendTestNotification()
      setMessage(sent ? 'Deneme bildirimi gönderildi.' : 'Bu telefon henüz kayıtlı değil, bildirimi kapatıp yeniden aç.')
    } catch {
      setMessage('Deneme bildirimi gönderilemedi.')
    }
  }

  const both = showPush && showEmail && prefs.pushEnabled && prefs.emailEnabled

  return (
    <section className={styles.card} aria-labelledby="reminder-title">
      <div className={styles.head}>
        <h2 id="reminder-title" className={styles.title}>Günlük hatırlatma</h2>
        <p className={styles.lead}>Yalnızca o gün henüz çalışmadıysan, günde en fazla bir kez.</p>
      </div>

      {showPush && (
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Telefon bildirimi</span>
            <span className={styles.rowDetail}>Bu telefonda</span>
          </div>
          <Switch checked={prefs.pushEnabled} onChange={togglePush} label="Telefon bildirimi" disabled={busy} />
        </div>
      )}

      {showEmail && (
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>E-posta</span>
            <span className={styles.rowDetail}>{email}</span>
          </div>
          <Switch
            checked={prefs.emailEnabled}
            onChange={(on) => update({ emailEnabled: on })}
            label="E-posta hatırlatması"
            disabled={busy}
          />
        </div>
      )}

      <div className={styles.hours}>
        <span className={styles.rowTitle} id="reminder-hour">Saat</span>
        <div className={styles.hourGrid} role="group" aria-labelledby="reminder-hour">
          {REMINDER_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={prefs.hour === h}
              onClick={() => update({ hour: h })}
              disabled={busy}
            >
              {hourLabel(h)}
            </button>
          ))}
        </div>
        {both && (
          <p className={styles.note}>
            İkisi de açık: e-posta, bildirimden 1 saat sonra gider; o arada çalışırsan gönderilmez.
          </p>
        )}
      </div>

      {showPush && prefs.pushEnabled && (
        <button type="button" className="btn btn-secondary" onClick={test}>
          Deneme bildirimi gönder
        </button>
      )}

      {showPush && permission === 'denied' && (
        <div className={styles.warning} role="status">
          <strong>Bildirim izni kapalı</strong>
          <span>Telefonun Ayarlar › Uygulamalar › English Course › Bildirimler bölümünden açabilirsin.</span>
        </div>
      )}

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}
    </section>
  )
}

export default ReminderSettings
