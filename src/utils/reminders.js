// Günlük hatırlatmalar: sunucudaki tercihler ve telefon bildirimleri (Firebase Cloud Messaging).
// Gönderimi sunucu yapar (server/reminders.js); burada izin, cihaz kaydı ve bildirime dokunma var.

import { PushNotifications } from '@capacitor/push-notifications'
import { apiFetch } from './api'
import { isNative } from './platform'

export const REMINDER_HOURS = [9, 13, 19, 21]

const TOKEN_KEY = 'pushToken'
const PROMPT_KEY = 'reminderPromptShown'
const CHANNEL_ID = 'reminders'

const json = async (response) => {
  if (!response.ok) throw new Error(`${response.status}`)
  return response.json()
}

const send = (url, method, body) =>
  apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const fetchReminderPrefs = () => apiFetch('/api/reminders').then(json)

export const saveReminderPrefs = (prefs) =>
  send('/api/reminders', 'PUT', { ...prefs, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).then(json)

export const sendTestNotification = () => apiFetch('/api/reminders/test', { method: 'POST' }).then(json)

// ---------- Telefon bildirimleri ----------

let tokenWaiters = []

/** Uygulama açılırken bir kez: kimlik geldiğinde sunucuya yaz, bildirime dokununca ilgili ekranı aç */
export function setupPushNotifications() {
  if (!isNative) return

  PushNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Günlük hatırlatma',
    description: 'O gün henüz çalışmadıysan günde bir hatırlatma',
    importance: 4
  }).catch(() => {})

  // Kimlik sunucuya yazıldıktan sonra bekleyenlere haber verilir (ayarlardaki telefon sayısı hemen doğru olsun)
  PushNotifications.addListener('registration', async ({ value }) => {
    localStorage.setItem(TOKEN_KEY, value)
    const saved = await send('/api/push-tokens', 'POST', { token: value, platform: 'android' })
      .then((r) => r.ok)
      .catch(() => false)
    tokenWaiters.forEach((w) => (saved ? w.resolve(value) : w.reject(new Error('Bildirim kimliği kaydedilemedi'))))
    tokenWaiters = []
  })
  PushNotifications.addListener('registrationError', ({ error }) => {
    tokenWaiters.forEach((w) => w.reject(new Error(error)))
    tokenWaiters = []
  })

  // Bildirime dokununca: kelime çalışması, hikaye ya da hesap ekranı
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => openRoute(notification?.data?.route))
  // Uygulama açıkken gelen bildirim de gösterilir: capacitor.config.json › PushNotifications.presentationOptions
}

function openRoute(route) {
  if (typeof route === 'string' && route.startsWith('/')) {
    window.history.pushState({}, '', route)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

/** 'granted' | 'denied' | 'prompt' | 'unsupported' (tarayıcı) */
export async function pushPermission() {
  if (!isNative) return 'unsupported'
  const { receive } = await PushNotifications.checkPermissions()
  if (receive === 'granted') return 'granted'
  return receive === 'denied' ? 'denied' : 'prompt'
}

function registerDevice() {
  return new Promise((resolve, reject) => {
    tokenWaiters.push({ resolve, reject })
    PushNotifications.register().catch(reject)
    setTimeout(() => reject(new Error('Bildirim kaydı zaman aşımına uğradı')), 20000)
  })
}

/** İzin ister (gerekirse) ve cihazı kaydeder. İzin verilmezse false döner. */
export async function enablePushOnDevice() {
  if (!isNative) return false
  let { receive } = await PushNotifications.checkPermissions()
  if (receive !== 'granted' && receive !== 'denied') ({ receive } = await PushNotifications.requestPermissions())
  if (receive !== 'granted') return false
  await registerDevice()
  return true
}

/** Giriş yapılınca: izin zaten verilmişse kimliği yenile (kimlik zamanla değişebilir) */
export async function refreshPushRegistration() {
  if (isNative && (await pushPermission()) === 'granted') PushNotifications.register().catch(() => {})
}

/** Çıkışta: bu cihaz artık bu hesaba bildirim almasın */
export async function forgetPushDevice() {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return
  await send('/api/push-tokens', 'DELETE', { token }).catch(() => {})
  localStorage.removeItem(TOKEN_KEY)
}

// ---------- İlk çalışmadan sonra bir kez sorulan kart ----------

export const shouldOfferReminder = () => isNative && !localStorage.getItem(PROMPT_KEY)
export const markReminderOffered = () => localStorage.setItem(PROMPT_KEY, '1')
