import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import {
  enablePushOnDevice,
  fetchReminderPrefs,
  markReminderOffered,
  pushPermission,
  REMINDER_HOURS,
  saveReminderPrefs,
  shouldOfferReminder
} from '../utils/reminders'
import styles from './ReminderSettings.module.css'

const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`

/** İlk kelime çalışmasından sonra (yalnızca telefon uygulamasında) bir kez sorulur */
function ReminderPrompt() {
  const [visible, setVisible] = useState(false)
  const [hour, setHour] = useState(19)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!shouldOfferReminder()) return
    // Bildirim kapalıysa ya da başka cihazdan açılmış ama bu telefonda izin yoksa sorulur
    Promise.all([fetchReminderPrefs(), pushPermission()])
      .then(([prefs, permission]) => {
        if (prefs.pushAvailable && (!prefs.pushEnabled || permission === 'prompt')) {
          setHour(prefs.hour)
          setVisible(true)
        } else markReminderOffered()
      })
      .catch(() => {})
  }, [])

  if (!visible) return null

  const accept = async () => {
    setBusy(true)
    markReminderOffered()
    try {
      const granted = await enablePushOnDevice()
      if (granted) {
        await saveReminderPrefs({ pushEnabled: true, hour })
        setResult(`Tamam! O gün çalışmadıysan saat ${hourLabel(hour)}'da hatırlatacağız.`)
      } else {
        setResult('Bildirim izni verilmedi. İstersen sonra Hesabım bölümünden açabilirsin.')
      }
    } catch {
      setResult('Hatırlatma açılamadı. Hesabım bölümünden tekrar deneyebilirsin.')
    } finally {
      setBusy(false)
    }
  }

  const decline = () => {
    markReminderOffered()
    setVisible(false)
  }

  if (result) {
    return (
      <p className={styles.card} role="status">
        {result}
      </p>
    )
  }

  return (
    <section className={styles.card} aria-labelledby="reminder-offer">
      <div className={styles.offerHead}>
        <span className={styles.offerIcon} aria-hidden="true">
          <Bell size={20} />
        </span>
        <div className={styles.head}>
          <h2 id="reminder-offer" className={styles.title}>Yarın hatırlatalım mı?</h2>
          <p className={styles.lead}>
            O gün henüz çalışmadıysan tek bir bildirim gönderelim. Saatini sonra Hesabım bölümünden
            değiştirebilirsin.
          </p>
        </div>
      </div>
      <div className={styles.hourGrid} role="group" aria-label="Hatırlatma saati">
        {REMINDER_HOURS.map((h) => (
          <button key={h} type="button" aria-pressed={hour === h} onClick={() => setHour(h)}>
            {hourLabel(h)}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={accept} disabled={busy}>
        Evet, hatırlat
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={decline} disabled={busy}>
        Şimdi değil
      </button>
    </section>
  )
}

export default ReminderPrompt
