import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import {
  enablePushOnDevice,
  fetchReminderPrefs,
  markReminderOffered,
  pushPermission,
  formatReminderTime,
  parseReminderTime,
  saveReminderPrefs,
  shouldOfferReminder
} from '../utils/reminders'
import { TimeField } from './ReminderSettings'
import styles from './ReminderSettings.module.css'

/** İlk kelime çalışmasından sonra (yalnızca telefon uygulamasında) bir kez sorulur */
function ReminderPrompt() {
  const [visible, setVisible] = useState(false)
  const [time, setTime] = useState('19:00')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!shouldOfferReminder()) return
    // Bildirim kapalıysa ya da başka cihazdan açılmış ama bu telefonda izin yoksa sorulur
    Promise.all([fetchReminderPrefs(), pushPermission()])
      .then(([prefs, permission]) => {
        if (prefs.pushAvailable && (!prefs.pushEnabled || permission === 'prompt')) {
          setTime(formatReminderTime(prefs.hour, prefs.minute))
          setVisible(true)
        } else markReminderOffered()
      })
      .catch(() => {})
  }, [])

  if (!visible) return null

  const accept = async () => {
    const parsed = parseReminderTime(time)
    if (!parsed) return
    setBusy(true)
    markReminderOffered()
    try {
      const granted = await enablePushOnDevice()
      if (granted) {
        await saveReminderPrefs({ pushEnabled: true, ...parsed })
        // Saate ek getirilmez ("07:45'te" / "19:30'da" okunuşa göre değişir)
        setResult(`Tamam! Hatırlatma saatin: ${time}. O gün çalışmadıysan bildirim gelecek.`)
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
      <div className={styles.row}>
        <label className={styles.rowTitle} htmlFor="reminder-offer-time">Saat</label>
        <TimeField id="reminder-offer-time" value={time} onChange={setTime} disabled={busy} />
      </div>
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={accept} disabled={busy || !parseReminderTime(time)}>
        Evet, hatırlat
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={decline} disabled={busy}>
        Şimdi değil
      </button>
    </section>
  )
}

export default ReminderPrompt
