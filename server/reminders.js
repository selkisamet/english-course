// Günlük hatırlatmalar: telefon bildirimi (Firebase Cloud Messaging) ve e-posta (Resend).
//
// Zamanlayıcı (GitHub Actions) 15 dakikada bir /api/cron/reminders'ı çağırır. Hatırlatma saati
// gelmiş, o gün henüz çalışmamış ve erişimi süren kullanıcılara günde en fazla bir bildirim ve
// bir e-posta gider. Metin gönderim anındaki veriden hesaplanır (hesaba senkronize ilerleme).

import fs from 'fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { getAllStories } from './storyManager.js'
import { supabaseAdmin as db } from './userAuth.js'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
// Saat geçtikten sonra bu kadar dakika içinde gönderilir (zamanlayıcı gecikse de gün kaçmasın)
const SEND_WINDOW_MINUTES = 180
const LAST_MINUTE_OF_DAY = 23 * 60 + 59
const WEB_URL = (process.env.PUBLIC_WEB_URL || 'https://english-course-qlsk.onrender.com').replace(/\/$/, '')

// ---------- Firebase ----------

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  // Yerelde proje kökünde, Render'da "Secret Files" ile /etc/secrets altında
  for (const file of ['firebase-service-account.json', '/etc/secrets/firebase-service-account.json']) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  return null
}

let messaging = null
try {
  const account = loadServiceAccount()
  if (account) messaging = getMessaging(initializeApp({ credential: cert(account) }))
  else {
    // Kurulum hatasını kayıtlardan görebilmek için gizli dosya klasöründeki dosya adları (içerik değil)
    const secrets = fs.existsSync('/etc/secrets') ? fs.readdirSync('/etc/secrets').join(', ') || 'boş' : 'yok'
    console.warn(
      `Firebase hizmet hesabı yok: telefon bildirimleri kapalı (FIREBASE_SERVICE_ACCOUNT tanımlı değil; /etc/secrets: ${secrets})`
    )
  }
} catch (error) {
  console.error('Firebase başlatılamadı:', error.message)
}

export const pushAvailable = () => Boolean(messaging)
export const emailAvailable = () => Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_EMAIL_FROM)

// ---------- Tercihler ve bildirim kimlikleri ----------

const DEFAULT_PREFS = { push_enabled: false, email_enabled: false, hour: 19, minute: 0, timezone: 'Europe/Istanbul' }

const isValidTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function getPrefs(userId) {
  const { data, error } = await db.from('reminder_prefs').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  const prefs = { ...DEFAULT_PREFS, ...data }
  const { count } = await db.from('push_tokens').select('token', { count: 'exact', head: true }).eq('user_id', userId)
  return {
    pushEnabled: prefs.push_enabled,
    emailEnabled: prefs.email_enabled,
    hour: prefs.hour,
    minute: prefs.minute,
    timezone: prefs.timezone,
    devices: count || 0,
    pushAvailable: pushAvailable(),
    emailAvailable: emailAvailable()
  }
}

export async function savePrefs(userId, { pushEnabled, emailEnabled, hour, minute, timezone }) {
  const row = { user_id: userId, updated_at: new Date().toISOString() }
  if (typeof pushEnabled === 'boolean') row.push_enabled = pushEnabled
  if (typeof emailEnabled === 'boolean') row.email_enabled = emailEnabled
  if (Number.isInteger(hour) && hour >= 0 && hour <= 23) row.hour = hour
  if (Number.isInteger(minute) && minute >= 0 && minute <= 59) row.minute = minute
  if (typeof timezone === 'string' && isValidTimezone(timezone)) row.timezone = timezone
  const { error } = await db.from('reminder_prefs').upsert(row)
  if (error) throw error
  return getPrefs(userId)
}

export async function saveToken(userId, token, platform = 'android') {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) throw new Error('Geçersiz kimlik')
  const now = new Date().toISOString()
  const { error } = await db
    .from('push_tokens')
    .upsert({ token, user_id: userId, platform: String(platform).slice(0, 20), last_seen_at: now })
  if (error) throw error
}

export async function removeToken(userId, token) {
  const { error } = await db.from('push_tokens').delete().eq('user_id', userId).eq('token', token)
  if (error) throw error
}

// ---------- Kullanıcının bugünkü durumu ----------

/** Saat dilimine göre yerel gün ("2026-10-11") ve saat */
function localNow(timezone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  )
  // Gün içindeki dakika (0–1439)
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

const shiftDay = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Uygulamadaki tanımla aynı (src/utils/activity.js): soru, yeni kelime ya da hikaye
const isActiveDay = (c) => Boolean(c && (c.answers || 0) + (c.newWords || 0) + (c.stories || 0) > 0)

function streakBefore(daily, today) {
  let streak = 0
  for (let day = shiftDay(today, -1); isActiveDay(daily[day]); day = shiftDay(day, -1)) streak += 1
  return streak
}

// Uygulamadaki srs.cardOf ile aynı: FSRS kartının ya da eski sistemdeki kaydın tekrar tarihi
function dueDate(entry) {
  if (entry?.fsrs?.due) return new Date(entry.fsrs.due)
  if (entry?.reviewCount > 0) return new Date(entry.nextReview || Date.now())
  return null
}

async function userState(userId, today, now = new Date()) {
  const [{ data: settingsRow }, words, { data: readRows }] = await Promise.all([
    db.from('user_settings').select('data').eq('user_id', userId).maybeSingle(),
    fetchAllWords(userId),
    db.from('read_stories').select('story_id').eq('user_id', userId)
  ])
  const settings = settingsRow?.data || {}
  const daily = settings.vocabStats?.daily || {}
  const dueReviews = words.filter((w) => {
    const due = dueDate(w)
    return due && due <= now
  }).length
  const goal = [5, 10, 15, 20].includes(settings.dailyNewWords) ? settings.dailyNewWords : 10
  const newLeft = Math.max(0, goal - (daily[today]?.newWords || 0))
  const read = new Set((readRows || []).map((r) => r.story_id))
  const stories = getAllStories()
  const level = LEVELS.includes(settings.preferredLevel) ? settings.preferredLevel : 'A1'
  const nextStory =
    stories.find((s) => s.level === level && !read.has(s.id)) || stories.find((s) => !read.has(s.id)) || null
  return { studiedToday: isActiveDay(daily[today]), streak: streakBefore(daily, today), dueReviews, newLeft, nextStory }
}

async function fetchAllWords(userId) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('word_progress')
      .select('data')
      .eq('user_id', userId)
      .range(from, from + 999)
    if (error) throw error
    rows.push(...data.map((r) => r.data))
    if (data.length < 1000) return rows
  }
}

/** Bildirim / e-posta metni ve dokununca açılacak ekran */
function buildMessage(state) {
  const title = state.streak > 0 ? `Serin ${state.streak} gün, bozulmasın` : 'Bugünkü çalışman seni bekliyor'
  if (state.dueReviews > 0) {
    return { title, body: `${state.dueReviews} kelimenin tekrar zamanı geldi. Birkaç dakikanı ayır.`, route: '/vocabulary/study' }
  }
  if (state.newLeft > 0) {
    return { title, body: `Bugünkü ${state.newLeft} yeni kelimen hazır.`, route: '/vocabulary/study' }
  }
  if (state.nextStory) {
    return { title, body: `Sıradaki hikaye: ${state.nextStory.title}`, route: `/story/${state.nextStory.id}` }
  }
  return { title, body: 'Birkaç dakikalık çalışma serini sürdürür.', route: '/' }
}

// ---------- Gönderim ----------

async function sendPush(userId, { title, body, route }) {
  if (!messaging) return 0
  const { data: rows } = await db.from('push_tokens').select('token').eq('user_id', userId)
  const tokens = (rows || []).map((r) => r.token)
  if (!tokens.length) return 0
  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { route },
    // Kanal ve küçük simge uygulamada tanımlı (src/utils/reminders.js, res/drawable/ic_stat_notify)
    android: { priority: 'high', notification: { channelId: 'reminders', color: '#1F7A5C', icon: 'ic_stat_notify' } }
  })
  // Uygulaması silinmiş ya da kimliği yenilenmiş cihazlar listeden çıkar
  const stale = result.responses
    .map((r, i) => (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(r.error?.code || '') ? tokens[i] : null))
    .filter(Boolean)
  if (stale.length) await db.from('push_tokens').delete().in('token', stale)
  return result.successCount
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

async function sendEmail(userId, { title, body, route }) {
  if (!emailAvailable()) return false
  const { data, error } = await db.auth.admin.getUserById(userId)
  const to = data?.user?.email
  if (error || !to) return false
  const link = `${WEB_URL}${route}`
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1d1c1a">
  <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">${escapeHtml(body)}</p>
  <a href="${link}" style="display:inline-block;background:#1f7a5c;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Çalışmaya başla</a>
  <p style="font-size:12px;color:#6e6a62;margin:28px 0 0">Bu hatırlatmayı Hesabım › Günlük hatırlatma bölümünden kapatabilirsin.</p>
</div>`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.REMINDER_EMAIL_FROM,
      to: [to],
      subject: title,
      html,
      text: `${title}\n\n${body}\n\n${link}\n\nBu hatırlatmayı Hesabım › Günlük hatırlatma bölümünden kapatabilirsin.`
    })
  })
  if (!response.ok) console.error('Hatırlatma e-postası gönderilemedi:', response.status, await response.text())
  return response.ok
}

/** Ayarlardaki "Deneme bildirimi gönder" */
export async function sendTestPush(userId) {
  return sendPush(userId, {
    title: 'Deneme bildirimi',
    body: 'Hatırlatmalar bu telefona böyle gelecek.',
    route: '/hesap'
  })
}

/** Zamanlayıcının çağırdığı iş: saati gelenlere hatırlatma gönderir */
export async function runReminders(now = new Date()) {
  const { data: prefs, error } = await db
    .from('reminder_prefs')
    .select('*')
    .or('push_enabled.eq.true,email_enabled.eq.true')
  if (error) throw error

  const stats = { checked: prefs.length, pushes: 0, emails: 0, errors: 0 }
  for (const p of prefs) {
    try {
      const { day, minutes } = localNow(p.timezone, now)
      const inWindow = (target) => minutes >= target && minutes < target + SEND_WINDOW_MINUTES
      const pushAt = p.hour * 60 + (p.minute || 0)
      // İkisi de açıksa e-posta bildirimden 1 saat sonra gider; o arada çalışılırsa gitmez
      const emailAt = p.push_enabled ? Math.min(pushAt + 60, LAST_MINUTE_OF_DAY) : pushAt
      const pushDue = p.push_enabled && p.last_push_day !== day && inWindow(pushAt)
      const emailDue = p.email_enabled && p.last_email_day !== day && inWindow(emailAt)
      if (!pushDue && !emailDue) continue

      // Deneme süresi ya da aboneliği bitmiş kullanıcıya hatırlatma gitmez
      const { data: profile } = await db.from('profiles').select('access_until').eq('id', p.user_id).maybeSingle()
      if (!profile || new Date(profile.access_until) <= now) continue

      const state = await userState(p.user_id, day, now)
      if (state.studiedToday) continue
      const message = buildMessage(state)

      if (pushDue && (await sendPush(p.user_id, message)) > 0) {
        stats.pushes += 1
        await db.from('reminder_prefs').update({ last_push_day: day }).eq('user_id', p.user_id)
      }
      if (emailDue && (await sendEmail(p.user_id, message))) {
        stats.emails += 1
        await db.from('reminder_prefs').update({ last_email_day: day }).eq('user_id', p.user_id)
      }
    } catch (err) {
      stats.errors += 1
      console.error('Hatırlatma hatası:', p.user_id, err.message)
    }
  }
  return stats
}
