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
// Seri kurtarma bildiriminin yerel saati (21:30); ana hatırlatma bundan en az 2 saat önce gitmiş olmalı
const SAVER_AT = 21 * 60 + 30
const SAVER_MIN_GAP = 120
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

const DEFAULT_PREFS = {
  push_enabled: false,
  email_enabled: false,
  hour: 19,
  minute: 0,
  timezone: 'Europe/Istanbul',
  streak_saver: true
}

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
  const [{ count }, { data: settingsRow }] = await Promise.all([
    db.from('push_tokens').select('token', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('user_settings').select('data').eq('user_id', userId).maybeSingle()
  ])
  const enabled = prefs.push_enabled || prefs.email_enabled
  const { day } = localNow(prefs.timezone)
  const daily = settingsRow?.data?.vocabStats?.daily || {}
  return {
    // Kullanıcı ayarları daha önce kaydetmiş mi (ilk kez soran kart saati önerir)
    configured: Boolean(data),
    pushEnabled: prefs.push_enabled,
    emailEnabled: prefs.email_enabled,
    hour: prefs.hour,
    minute: prefs.minute,
    timezone: prefs.timezone,
    streakSaver: prefs.streak_saver,
    // Uzun süre çalışılmadığı için hatırlatmalara ara verildi (çalışınca kendiliğinden başlar)
    paused: enabled && inactiveDays(daily, day, prefs.enabled_on) >= PAUSE_AFTER_DAYS,
    devices: count || 0,
    pushAvailable: pushAvailable(),
    emailAvailable: emailAvailable()
  }
}

export async function savePrefs(userId, { pushEnabled, emailEnabled, hour, minute, timezone, streakSaver }) {
  const { data: current, error: readError } = await db.from('reminder_prefs').select('*').eq('user_id', userId).maybeSingle()
  if (readError) throw readError
  const row = { user_id: userId, updated_at: new Date().toISOString() }
  if (typeof streakSaver === 'boolean') row.streak_saver = streakSaver
  if (typeof pushEnabled === 'boolean') row.push_enabled = pushEnabled
  if (typeof emailEnabled === 'boolean') row.email_enabled = emailEnabled
  if (Number.isInteger(hour) && hour >= 0 && hour <= 23) row.hour = hour
  if (Number.isInteger(minute) && minute >= 0 && minute <= 59) row.minute = minute
  if (typeof timezone === 'string' && isValidTimezone(timezone)) row.timezone = timezone
  // Hatırlatmalar kapalıyken açıldıysa: sessizleşme sayacı bu günden başlar
  const wasEnabled = Boolean(current?.push_enabled || current?.email_enabled)
  const willEnable = (row.push_enabled ?? current?.push_enabled) || (row.email_enabled ?? current?.email_enabled)
  if (willEnable && !wasEnabled) {
    row.enabled_on = localNow(row.timezone || current?.timezone || DEFAULT_PREFS.timezone).day
    row.pause_notice_day = null
  }
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

// Bu kadar gün üst üste çalışılmazsa hatırlatmalar gün aşırı gider; PAUSE_AFTER_DAYS'te ara verilir
const EVERY_OTHER_DAY_AFTER = 3
const PAUSE_AFTER_DAYS = 7

/**
 * Dünden geriye üst üste çalışılmayan gün sayısı (en fazla 8). Hatırlatmaların açıldığı günden
 * öncesi sayılmaz: uzun aradan sonra hatırlatma açan kullanıcı hemen susturulmaz.
 */
function inactiveDays(daily, today, enabledOn) {
  if (isActiveDay(daily[today])) return 0
  let count = 0
  for (let day = shiftDay(today, -1); count < PAUSE_AFTER_DAYS + 1; day = shiftDay(day, -1)) {
    if ((enabledOn && day < enabledOn) || isActiveDay(daily[day])) break
    count += 1
  }
  return count
}

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
  return { daily, studiedToday: isActiveDay(daily[today]), streak: streakBefore(daily, today), dueReviews, newLeft, nextStory }
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

// Uygulamadaki tahminle aynı (VocabularyHome): tekrar ~15 sn, yeni kelime (tanıtım + soru) ~35 sn
const minutesFor = (reviews, fresh) => Math.max(1, Math.round((Math.min(reviews, 30) * 15 + fresh * 35) / 60))

// Her türün iki metni var; aynı tür arka arkaya gelirse öteki kullanılır (aynı metin her gün tekrarlanmasın).
// Bütün sayılar gönderim anındaki gerçek veriden gelir.
const TITLES = {
  streak: [(s) => `Serin ${s.streak} gün, bozulmasın`, (s) => `${s.streak} günlük serini sürdür`],
  started: [() => 'Dün çalıştın, bugün de devam', () => 'Güzel gidiyorsun, bugün de birkaç dakika'],
  fresh: [() => 'Bugünkü çalışman seni bekliyor', () => 'Bugün birkaç dakikan var mı?']
}
const BODIES = {
  review: [
    (s) => `${s.dueReviews} kelimenin tekrar zamanı geldi · yaklaşık ${minutesFor(s.dueReviews, 0)} dakika`,
    (s) => `Unutmadan önce: ${s.dueReviews} kelime tekrar bekliyor.`
  ],
  new: [
    (s) => `Bugünkü ${s.newLeft} yeni kelimen hazır · yaklaşık ${minutesFor(0, s.newLeft)} dakika`,
    (s) => `${s.newLeft} yeni kelime öğrenmeyi bekliyor.`
  ],
  story: [(s) => `Sıradaki hikaye: ${s.nextStory.title}`, (s) => `"${s.nextStory.title}" hikayesi seni bekliyor.`]
}

/** Günlük hatırlatma metni; template: "tür:sıra" (bir sonrakinde aynısı seçilmesin diye saklanır) */
function buildMessage(state, lastTemplate) {
  const kind = state.dueReviews > 0 ? 'review' : state.newLeft > 0 ? 'new' : state.nextStory ? 'story' : null
  if (!kind) return null
  const [lastKind, lastIndex] = String(lastTemplate || '').split(':')
  const index = lastKind === kind ? (Number(lastIndex) + 1) % 2 : 0
  const titleKind = state.streak >= 3 ? 'streak' : state.streak > 0 ? 'started' : 'fresh'
  return {
    title: TITLES[titleKind][index](state),
    body: BODIES[kind][index](state),
    route: kind === 'story' ? `/story/${state.nextStory.id}` : '/vocabulary/study',
    template: `${kind}:${index}`
  }
}

/** 7 gün çalışılmadığında bir kez gönderilir; ardından hatırlatmalar durur */
const PAUSE_MESSAGE = {
  title: 'Hatırlatmalara ara veriyoruz',
  body: 'Bir haftadır çalışmadın; seni rahatsız etmek istemiyoruz. Döndüğünde kaldığın yerden devam edersin.',
  route: '/'
}

/** Seri kurtarma: serisi 3+ gün olan, o gün çalışmamış kullanıcıya akşam son bildirim */
function buildSaverMessage(state) {
  return {
    title: `${state.streak} günlük serin bugün bitiyor`,
    body:
      state.dueReviews > 0
        ? `Kısa bir tekrar serini korur: ${state.dueReviews} kelime, yaklaşık ${minutesFor(state.dueReviews, 0)} dakika.`
        : 'Birkaç dakikalık çalışma serini korur.',
    route: '/vocabulary/study'
  }
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

/**
 * Günün gönderimini önce veritabanında "üstlenir": yalnızca o gün henüz işaretlenmemişse işaretler.
 * İki zamanlayıcı aynı anda çalışsa bile aynı kişiye aynı gün ikinci kez gönderilmez.
 */
async function claimDay(prefs, column, day) {
  let query = db.from('reminder_prefs').update({ [column]: day }).eq('user_id', prefs.user_id)
  query = prefs[column] ? query.eq(column, prefs[column]) : query.is(column, null)
  const { data, error } = await query.select('user_id')
  if (error) throw error
  return data.length > 0
}

/** Gönderim başarısız olduysa işaret geri alınır (bir sonraki çalıştırmada yeniden denenir) */
async function releaseDay(prefs, column) {
  await db.from('reminder_prefs').update({ [column]: prefs[column] ?? null }).eq('user_id', prefs.user_id)
}

/**
 * Zamanlayıcının çağırdığı iş: saati gelenlere hatırlatma gönderir.
 * userId yalnızca testler içindir (zamanı ileri saran denemeler gerçek kullanıcılara dokunmasın).
 */
export async function runReminders(now = new Date(), { userId } = {}) {
  let query = db.from('reminder_prefs').select('*').or('push_enabled.eq.true,email_enabled.eq.true')
  if (userId) query = query.eq('user_id', userId)
  const { data: prefs, error } = await query
  if (error) throw error

  const stats = { checked: prefs.length, pushes: 0, emails: 0, savers: 0, errors: 0 }
  for (const p of prefs) {
    try {
      const { day, minutes } = localNow(p.timezone, now)
      const inWindow = (target) => minutes >= target && minutes < target + SEND_WINDOW_MINUTES
      const pushAt = p.hour * 60 + (p.minute || 0)
      // İkisi de açıksa e-posta bildirimden 1 saat sonra gider; o arada çalışılırsa gitmez
      const emailAt = p.push_enabled ? Math.min(pushAt + 60, LAST_MINUTE_OF_DAY) : pushAt
      const pushDue = p.push_enabled && p.last_push_day !== day && inWindow(pushAt)
      const emailDue = p.email_enabled && p.last_email_day !== day && inWindow(emailAt)
      const saverDue =
        p.streak_saver &&
        p.push_enabled &&
        p.last_push_day === day &&
        p.last_saver_day !== day &&
        pushAt <= SAVER_AT - SAVER_MIN_GAP &&
        inWindow(SAVER_AT)
      if (!pushDue && !emailDue && !saverDue) continue

      // Deneme süresi ya da aboneliği bitmiş kullanıcıya hatırlatma gitmez
      const { data: profile } = await db.from('profiles').select('access_until').eq('id', p.user_id).maybeSingle()
      if (!profile || new Date(profile.access_until) <= now) continue

      const state = await userState(p.user_id, day, now)
      if (state.studiedToday) continue

      // Seri kurtarma (yalnızca telefon bildirimi)
      if (saverDue && state.streak >= 3 && (await claimDay(p, 'last_saver_day', day))) {
        if ((await sendPush(p.user_id, buildSaverMessage(state))) > 0) stats.savers += 1
        else await releaseDay(p, 'last_saver_day')
      }
      if (!pushDue && !emailDue) continue

      // Uzun süre çalışılmadıysa: önce gün aşırı, bir hafta sonunda tek bir "ara veriyoruz" mesajı
      const inactive = inactiveDays(state.daily, day, p.enabled_on)
      let message
      if (inactive > PAUSE_AFTER_DAYS) continue
      if (inactive === PAUSE_AFTER_DAYS) {
        if (p.pause_notice_day) continue
        message = PAUSE_MESSAGE
      } else if (inactive >= EVERY_OTHER_DAY_AFTER && inactive % 2 === 0) {
        continue
      } else {
        message = buildMessage(state, p.last_template)
        if (!message) continue
      }

      let sent = false
      if (pushDue && (await claimDay(p, 'last_push_day', day))) {
        if ((await sendPush(p.user_id, message)) > 0) {
          stats.pushes += 1
          sent = true
        } else await releaseDay(p, 'last_push_day')
      }
      if (emailDue && (await claimDay(p, 'last_email_day', day))) {
        if (await sendEmail(p.user_id, message)) {
          stats.emails += 1
          sent = true
        } else await releaseDay(p, 'last_email_day')
      }
      if (sent) {
        const update =
          message === PAUSE_MESSAGE ? { pause_notice_day: day } : { last_template: message.template, pause_notice_day: null }
        await db.from('reminder_prefs').update(update).eq('user_id', p.user_id)
      }
    } catch (err) {
      stats.errors += 1
      console.error('Hatırlatma hatası:', p.user_id, err.message)
    }
  }
  return stats
}
