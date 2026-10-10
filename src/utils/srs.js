// Kelime tekrar takvimi: FSRS algoritması (ts-fsrs).
//
// Her kelime için "kalıcılık" (stability: kelimenin kaç gün akılda kalacağı) ve "zorluk" tutulur;
// bir sonraki tekrar, öğrencinin kelimeyi %90 ihtimalle hâlâ hatırlayacağı güne konur.
// Uygulama gün bazında çalıştığı için dakikalık öğrenme adımları kapalı; aynı oturumdaki
// tekrarı çalışma ekranı kendisi yapar (yanlış bilinen kelime birkaç soru sonra yeniden gelir).

import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'

const scheduler = fsrs(generatorParameters({ enable_short_term: false, enable_fuzz: true }))

const DAY = 24 * 60 * 60 * 1000

export const GRADE = {
  AGAIN: Rating.Again, // yanlış
  HARD: Rating.Hard, // neredeyse doğru (küçük yazım hatası)
  GOOD: Rating.Good, // doğru
  EASY: Rating.Easy // "Bu kelimeyi zaten biliyorum"
}

const toCard = (saved) => ({
  ...saved,
  due: new Date(saved.due),
  last_review: saved.last_review ? new Date(saved.last_review) : undefined
})

const fromCard = (card) => ({
  due: card.due.toISOString(),
  stability: card.stability,
  difficulty: card.difficulty,
  elapsed_days: card.elapsed_days,
  scheduled_days: card.scheduled_days,
  learning_steps: card.learning_steps,
  reps: card.reps,
  lapses: card.lapses,
  state: card.state,
  last_review: card.last_review ? card.last_review.toISOString() : null
})

/**
 * Eski sistemde çalışılmış kelimenin kartı: bir sonraki tekrar tarihi korunur, kalıcılık
 * son iki tekrar arasındaki aralıktan, zorluk da doğru cevap oranından tahmin edilir.
 */
function migratedCard(entry) {
  const due = new Date(entry.nextReview || Date.now())
  const last = entry.lastReviewed ? new Date(entry.lastReviewed) : new Date(due.getTime() - DAY)
  const interval = Math.max(1, Math.round((due - last) / DAY))
  const accuracy = entry.reviewCount ? (entry.correctCount || 0) / entry.reviewCount : 0.5
  return {
    due,
    stability: interval,
    difficulty: Math.min(10, Math.max(1, 9 - accuracy * 6)),
    elapsed_days: 0,
    scheduled_days: interval,
    learning_steps: 0,
    reps: entry.reviewCount,
    lapses: entry.incorrectCount || 0,
    state: State.Review,
    last_review: last
  }
}

/** Kelimenin kartı; hiç çalışılmamış (yeni) kelimede null */
export function cardOf(entry) {
  if (entry?.fsrs) return toCard(entry.fsrs)
  if (entry?.reviewCount > 0) return migratedCard(entry)
  return null
}

export const isNewWord = (entry) => !cardOf(entry)

/** Uygulamanın diğer ekranlarında gösterilen durum */
export function statusOf(card) {
  if (!card) return 'new'
  if (card.stability >= 30) return 'mastered'
  if (card.stability >= 7) return 'reviewing'
  return 'learning'
}

/** Kelime ne kadar iyi biliniyor: soru türünü seçmek için */
export const stabilityOf = (entry) => cardOf(entry)?.stability ?? 0

/**
 * Bir cevaptan sonra kelimenin yeni kaydı.
 * @param {object} entry   kelimenin mevcut kaydı
 * @param {number} grade   GRADE değerlerinden biri
 */
export function reviewEntry(entry, grade, now = new Date()) {
  const previous = cardOf(entry)
  const { card } = scheduler.next(previous || createEmptyCard(now), now, grade)

  // Unutulan ya da yeni öğrenilen kelime ertesi gün yeniden sorulur
  // (FSRS bu durumlarda 2–3 gün verebiliyor; ilk günlerde sık tekrar daha kalıcı)
  if (grade !== GRADE.EASY && (grade === GRADE.AGAIN || !previous)) {
    const tomorrow = new Date(now.getTime() + DAY)
    if (card.due > tomorrow) {
      card.due = tomorrow
      card.scheduled_days = 1
    }
  }

  const correct = grade !== GRADE.AGAIN
  return {
    fsrs: fromCard(card),
    nextReview: card.due.toISOString(),
    lastReviewed: now.toISOString(),
    reviewCount: (entry.reviewCount || 0) + 1,
    correctCount: (entry.correctCount || 0) + (correct ? 1 : 0),
    incorrectCount: (entry.incorrectCount || 0) + (correct ? 0 : 1),
    status: statusOf(card)
  }
}
