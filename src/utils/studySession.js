// Günlük kelime çalışmasının planı ve oturumdaki soru sırası.

import { pickNewWords } from './api'
import { cardOf, isNewWord, stabilityOf } from './srs'
import { canSpeak } from './speech'
import { getDailyNewWords } from './storyProgress'
import { getProgress, getTodayStudy } from './vocabularyStorage'

// Bir oturumda en fazla bu kadar tekrar; fazlası bir sonraki oturuma kalır
export const MAX_REVIEWS = 30

/** Bugünkü plan: zamanı gelen tekrarlar ve bugün daha öğretilebilecek yeni kelime sayısı */
export function getTodayPlan(now = new Date()) {
  const words = Object.values(getProgress().words)
  const reviews = words
    .filter((w) => !isNewWord(w) && cardOf(w).due <= now)
    .sort((a, b) => cardOf(a).due - cardOf(b).due)
  // Hikayeden kaydedilip henüz çalışılmamış kelimeler yeni kelimelerin önüne geçer
  const saved = words.filter(isNewWord).sort((a, b) => (a.firstSeen || '').localeCompare(b.firstSeen || ''))
  const newLeft = Math.max(0, getDailyNewWords() - getTodayStudy().newWords)
  return {
    reviews: reviews.slice(0, MAX_REVIEWS),
    reviewTotal: reviews.length,
    saved,
    newLeft
  }
}

/** Planın oturum listesi: önce tekrarlar, sonra yeni kelimeler */
export async function buildTodayQueue(level, extraNew = 0) {
  const plan = getTodayPlan()
  const newCount = plan.newLeft + extraNew
  const saved = plan.saved.slice(0, newCount)
  const fresh = newCount > saved.length ? await pickNewWords(level, newCount - saved.length) : []
  const item = ({ wordId, word }) => ({ wordId, word })
  return [...plan.reviews.map(item), ...saved.map(item), ...fresh]
}

/**
 * Oturumdaki adımlar. Yeni kelime önce tanıtılır; sorusu bir sonraki kelimenin tanıtımından
 * sonra gelir, böylece cevap hemen kısa süreli bellekten verilmez.
 * @param {{wordId:string, word:string}[]} queue
 */
export function planSteps(queue) {
  const entries = getProgress().words
  const reviews = []
  const fresh = []
  for (const item of queue) {
    if (isNewWord(entries[item.wordId])) fresh.push(item)
    else reviews.push({ ...item, kind: 'quiz' })
  }
  const steps = [...reviews]
  fresh.forEach((item, i) => {
    steps.push({ ...item, kind: 'intro' })
    if (i > 0) steps.push({ ...fresh[i - 1], kind: 'quiz' })
  })
  if (fresh.length) steps.push({ ...fresh[fresh.length - 1], kind: 'quiz' })
  return steps
}

/**
 * Kelimenin ne kadar iyi bilindiğine göre denenecek soru türleri (öncelik sırasıyla).
 * Bir tür üretilemezse (ör. cümlede kelime birebir geçmiyor) sıradakine geçilir.
 */
export function exerciseTypesFor(entry, { retry = false, random = Math.random } = {}) {
  const listen = canSpeak ? ['listen'] : []
  const pickOrder = (list) => [...list].sort(() => random() - 0.5)
  if (retry || !entry || isNewWord(entry)) return ['meaning']
  const stability = stabilityOf(entry)
  if (stability < 4) return [...pickOrder(['meaning', ...listen]), 'meaning']
  if (stability < 21) return [...pickOrder(['toEnglish', 'cloze']), 'meaning']
  return [...pickOrder(['typing', 'cloze', 'toEnglish']), 'meaning']
}
