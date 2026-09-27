import { getProgress } from './vocabularyStorage'
import { slugify, VOCAB_LEVELS } from './format'

async function request(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.json()
}

let storiesPromise = null

export function fetchStories() {
  if (!storiesPromise) {
    storiesPromise = request('/api/stories').catch((error) => {
      storiesPromise = null
      throw error
    })
  }
  return storiesPromise
}

export const translateText = (text) =>
  request('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source: 'en', target: 'tr' })
  }).then((data) => data.translation)

export const analyzeWord = (word, sentence) =>
  request('/api/analyze-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, sentence })
  })

export const fetchWords = (params) =>
  request(`/api/vocabulary/words?${new URLSearchParams(params)}`)

export const fetchWord = (id) => request(`/api/vocabulary/words/${encodeURIComponent(id)}`)

// Oxford 3000 içinde metindeki kelimeyle eşleşen kaydı bul (yoksa null)
export async function findOxfordWord(word) {
  try {
    return await fetchWord(slugify(word))
  } catch {
    return null
  }
}

const shuffle = (items) => {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Verilen seviyeden, henüz çalışılmamış `count` kelimeyi rastgele seç.
// Seviyede yeterli kelime kalmadıysa bir üst seviyeye geçer.
export async function pickNewWords(level, count = 10) {
  const known = getProgress().words || {}
  const picked = []
  const levels = VOCAB_LEVELS.slice(Math.max(0, VOCAB_LEVELS.indexOf(level)))

  for (const lvl of levels) {
    const pool = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const data = await fetchWords({ level: lvl, page, limit: 200 })
      totalPages = data.totalPages
      pool.push(...data.words.filter((w) => !known[w.id]))
      page++
    }
    for (const w of shuffle(pool)) {
      picked.push({ wordId: w.id, word: w.word })
      if (picked.length === count) return picked
    }
  }

  return picked
}
