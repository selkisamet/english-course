// İlerleme takibi: seri, günlük etkinlik, seviye ilerlemesi ve yaklaşan tekrarlar.
// Hepsi günlük çalışma kaydından (stats.daily) ve kelime kartlarından hesaplanır.

import { cardOf, statusOf } from './srs'
import { VOCAB_LEVELS } from './format'
import { getProgress, localDay } from './vocabularyStorage'

const addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const EMPTY_DAY = { answers: 0, correct: 0, newWords: 0, reviews: 0, stories: 0 }

const getDaily = () => getProgress().stats.daily || {}

/** O gün bir şey yapıldı mı: soru cevaplamak, yeni kelime öğrenmek ya da hikaye okumak */
export const isActiveDay = (counts) =>
  Boolean(counts && (counts.answers || 0) + (counts.newWords || 0) + (counts.stories || 0) > 0)

/**
 * Art arda çalışılan gün sayısı. Bugün henüz çalışılmadıysa seri dünden sayılır (bozulmuş sayılmaz).
 * @returns {{streak:number, todayActive:boolean}}
 */
export function getStreak(now = new Date()) {
  const daily = getDaily()
  const todayActive = isActiveDay(daily[localDay(now)])
  let streak = 0
  let day = todayActive ? now : addDays(now, -1)
  while (isActiveDay(daily[localDay(day)])) {
    streak += 1
    day = addDays(day, -1)
  }
  return { streak, todayActive }
}

/** Son `days` günün sayaçları, eskiden yeniye */
export function getActivity(days, now = new Date()) {
  const daily = getDaily()
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(now, i - days + 1)
    const day = localDay(date)
    return { day, date, ...EMPTY_DAY, ...daily[day] }
  })
}

/** Bu haftanın günleri (Pazartesiden başlar) */
export function getWeek(now = new Date()) {
  const daily = getDaily()
  const today = localDay(now)
  const monday = addDays(now, -((now.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    const day = localDay(date)
    return { day, date, active: isActiveDay(daily[day]), isToday: day === today, isFuture: day > today }
  })
}

/** Kelime "biliniyor" sayılır: en az bir haftalık tekrar aralığına ulaşmış (durumu "tekrarda" ya da "öğrenildi") */
export const isKnown = (entry) => ['reviewing', 'mastered'].includes(statusOf(cardOf(entry)))

/**
 * Oxford listesinde her seviyenin kelime sayısı ve bilinenler.
 * @param {{id:string, level:string}[]} pool
 */
export function getLevelProgress(pool) {
  const words = getProgress().words
  return VOCAB_LEVELS.map((level) => {
    const ids = pool.filter((w) => w.level === level).map((w) => w.id)
    const known = ids.filter((id) => words[id] && isKnown(words[id])).length
    return { level, total: ids.length, known, percent: ids.length ? Math.floor((known / ids.length) * 100) : 0 }
  })
}

/**
 * Önümüzdeki günlerde tekrar zamanı gelecek kelime sayıları.
 * İlk gün (bugün) zamanı geçmiş tekrarları da içerir.
 */
export function getReviewForecast(days = 7, now = new Date()) {
  const counts = new Array(days).fill(0)
  const today = startOfDay(now)
  for (const entry of Object.values(getProgress().words)) {
    const card = cardOf(entry)
    if (!card) continue
    const index = Math.max(0, Math.round((startOfDay(card.due) - today) / 86400000))
    if (index < days) counts[index] += 1
  }
  return counts.map((count, i) => ({ date: addDays(now, i), count }))
}

// "%62'sini": yüzdenin okunuşuna göre belirtme hali eki
const UNIT_SUFFIX = ['', "'ini", "'sini", "'ünü", "'ünü", "'ini", "'sını", "'sini", "'ini", "'unu"]
const TEN_SUFFIX = ['', "'unu", "'sini", "'unu", "'ını", "'sini", "'ını", "'ini", "'ini", "'ını"]

/** 0–100 arası tam sayı yüzde, belirtme hali ekiyle: 62 → "%62'sini" */
export function percentAccusative(n) {
  if (n === 0) return "%0'ını"
  if (n === 100) return "%100'ünü"
  const suffix = n % 10 ? UNIT_SUFFIX[n % 10] : TEN_SUFFIX[Math.floor(n / 10)]
  return `%${n}${suffix}`
}
