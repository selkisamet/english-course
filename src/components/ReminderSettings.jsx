import { useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { isNative } from '../utils/platform'
import {
  enablePushOnDevice,
  fetchReminderPrefs,
  formatReminderTime,
  openNotificationSettings,
  parseReminderTime,
  pushPermission,
  saveReminderPrefs,
  sendTestNotification
} from '../utils/reminders'
import styles from './ReminderSettings.module.css'

/** Saat seçimi (telefonda sistemin saat seçicisi açılır) */
export function TimeField({ value, onChange, disabled, id }) {
  return (
    <input
      id={id}
      type="time"
      className={styles.time}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required
    />
  )
}

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

/**
 * Hesabım › Günlük hatırlatma. Ayarlar hesaba aittir: telefon bildirimi web'den de açılabilir
 * (bildirim, hesapla giriş yapılmış telefonlara gider), e-posta telefondan da açılabilir.
 */
function ReminderSettings({ email }) {
  const [prefs, setPrefs] = useState(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [permission, setPermission] = useState('unsupported')
  const [message, setMessage] = useState('')

  const [time, setTime] = useState('')
  const saveTimer = useRef(null)

  useEffect(() => {
    fetchReminderPrefs()
      .then((p) => {
        setPrefs(p)
        setTime(formatReminderTime(p.hour, p.minute))
      })
      .catch(() => setFailed(true))
    pushPermission().then(setPermission).catch(() => {})
    return () => clearTimeout(saveTimer.current)
  }, [])

  // Telefon ayarlarından dönünce: izin açıldıysa bu telefonu kaydet ve ekranı güncelle
  useEffect(() => {
    if (!isNative) return
    const handle = App.addListener('resume', async () => {
      const next = await pushPermission().catch(() => null)
      if (!next) return
      setPermission(next)
      if (next === 'granted') {
        await enablePushOnDevice().catch(() => {})
        fetchReminderPrefs().then(setPrefs).catch(() => {})
      }
    })
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  const showPush = prefs?.pushAvailable
  const showEmail = prefs?.emailAvailable
  // Sunucuda iki gönderim yolu da kurulu değilse bu bölüm gösterilmez
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

  // Saat yazılırken her tuşta değil, kısa bir duraklamadan sonra kaydedilir
  const changeTime = (value) => {
    setTime(value)
    clearTimeout(saveTimer.current)
    const parsed = parseReminderTime(value)
    if (!parsed || (parsed.hour === prefs.hour && parsed.minute === prefs.minute)) return
    saveTimer.current = setTimeout(() => update(parsed), 700)
  }

  // Telefonda: izin iste ve bu telefonu kaydet. İzin verilmezse false.
  const registerThisPhone = async () => {
    const granted = await enablePushOnDevice()
    setPermission(await pushPermission())
    return granted
  }

  const togglePush = async (on) => {
    if (!on) return update({ pushEnabled: false })
    setBusy(true)
    setMessage('')
    try {
      if (isNative && !(await registerThisPhone())) return
      await update({ pushEnabled: true })
    } catch {
      setMessage('Bildirimler açılamadı, tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  // Bildirim başka cihazdan açılmış, bu telefonda henüz izin verilmemiş
  const allowOnThisPhone = async () => {
    setBusy(true)
    setMessage('')
    try {
      if (await registerThisPhone()) setPrefs(await fetchReminderPrefs())
    } catch {
      setMessage('Bu telefon kaydedilemedi, tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setMessage('')
    try {
      const { sent } = await sendTestNotification()
      setMessage(sent ? 'Deneme bildirimi gönderildi.' : 'Bildirim gönderilemedi: kayıtlı telefon bulunamadı.')
    } catch {
      setMessage('Deneme bildirimi gönderilemedi.')
    }
  }

  const devices = prefs.devices || 0
  const pushDetail =
    devices > 0
      ? `${devices} telefon kayıtlı`
      : isNative
        ? 'Açınca bildirimler bu telefona gelir'
        : 'Uygulamayı telefona kurup giriş yapınca bildirimler oraya gelir'
  const needsThisPhone = isNative && prefs.pushEnabled && permission !== 'granted'
  const both = showPush && showEmail && prefs.pushEnabled && prefs.emailEnabled

  return (
    <section className={styles.card} aria-labelledby="reminder-title">
      <div className={styles.head}>
        <h2 id="reminder-title" className={styles.title}>Günlük hatırlatma</h2>
        <p className={styles.lead}>Yalnızca o gün henüz çalışmadıysan gönderilir.</p>
      </div>

      {showPush && (
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Telefon bildirimi</span>
            <span className={styles.rowDetail}>{pushDetail}</span>
          </div>
          <Switch checked={prefs.pushEnabled} onChange={togglePush} label="Telefon bildirimi" disabled={busy} />
        </div>
      )}

      {showPush && (
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Seri kurtarma</span>
            <span className={styles.rowDetail}>
              Serin 3 gün ve üstündeyse, o gün çalışmadıysan 21:30'da son bir bildirim
            </span>
          </div>
          <Switch
            checked={prefs.pushEnabled && prefs.streakSaver}
            onChange={(on) => update({ streakSaver: on })}
            label="Seri kurtarma bildirimi"
            disabled={busy || !prefs.pushEnabled}
          />
        </div>
      )}

      {prefs.paused && (
        <div className={styles.callout} role="status">
          <span>
            Bir haftadır çalışmadığın için hatırlatmalara ara verdik. Çalışmaya başladığında kendiliğinden yeniden
            başlar.
          </span>
        </div>
      )}

      {showPush && needsThisPhone && permission !== 'denied' && (
        <div className={styles.callout}>
          <span>Bu telefona da bildirim gelsin mi?</span>
          <button type="button" className="btn btn-secondary" onClick={allowOnThisPhone} disabled={busy}>
            Bu telefonda izin ver
          </button>
        </div>
      )}

      {showEmail && (
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>E-posta</span>
            <span className={styles.rowDetail} data-nowrap title={email}>{email}</span>
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
        <div className={styles.row}>
          <label className={styles.rowTitle} htmlFor="reminder-time">Saat</label>
          <TimeField id="reminder-time" value={time} onChange={changeTime} />
        </div>
        <p className={styles.note}>Hatırlatma seçtiğin saatten sonraki birkaç dakika içinde gelir.</p>
        {both && (
          <p className={styles.note}>
            İkisi de açık: e-posta, bildirimden 1 saat sonra gider; o arada çalışırsan gönderilmez.
          </p>
        )}
      </div>

      {showPush && prefs.pushEnabled && devices > 0 && (
        <button type="button" className="btn btn-secondary" onClick={test}>
          Deneme bildirimi gönder
        </button>
      )}

      {showPush && isNative && permission === 'denied' && (
        <div className={styles.warning} role="status">
          <strong>Bu telefonda bildirim izni kapalı</strong>
          <span>Bildirimleri telefonun ayarlarından açabilirsin; açınca buraya geri dön.</span>
          <button type="button" className="btn btn-secondary" onClick={() => openNotificationSettings().catch(() => {})}>
            Ayarları aç
          </button>
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
