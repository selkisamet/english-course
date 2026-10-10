import { getProgress } from './vocabularyStorage'
import { slugify, VOCAB_LEVELS } from './format'
import { getAccessToken } from './supabase'

/** Oturum belirteciyle istek. Erişim süresi dolduysa uygulamaya haber verir (kilit ekranı). */
export async function apiFetch(url, options = {}) {
  const token = await getAccessToken()
  const headers = { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const response = await fetch(url, { ...options, headers })
  if (response.status === 403) {
    const body = await response.clone().json().catch(() => null)
    if (body?.code === 'access_expired') window.dispatchEvent(new Event('access-expired'))
  }
  return response
}

async function request(url, options) {
  const response = await apiFetch(url, options)
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

// Hikayedeki her kelimenin temel ve bağlamsal anlamı. İşaretlemesi olmayan hikayede null.
// Yalnızca bulunan işaretleme saklanır: yeni eklenen hikayenin işaretlemesi arka planda
// hazırlanırken açılırsa, hikaye bir sonraki açılışta yeniden sorgulanır.
const annotationCache = new Map()
export function fetchAnnotations(storyId) {
  if (!annotationCache.has(storyId)) {
    const promise = apiFetch(`/api/stories/${encodeURIComponent(storyId)}/annotations`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((annotation) => {
        if (!annotation) annotationCache.delete(storyId)
        return annotation
      })
    annotationCache.set(storyId, promise)
  }
  return annotationCache.get(storyId)
}

// Hikayenin önceden üretilmiş seslendirmesi (ses adresi ve her kelimenin başladığı milisaniye).
// Seslendirmesi olmayan hikayede null: okuyucu cihazın sesini kullanır.
const audioCache = new Map()
export function fetchStoryAudio(storyId) {
  if (!audioCache.has(storyId)) {
    const promise = apiFetch(`/api/stories/${encodeURIComponent(storyId)}/audio`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((audio) => {
        if (!audio) audioCache.delete(storyId)
        return audio
      })
    audioCache.set(storyId, promise)
  }
  return audioCache.get(storyId)
}

/** Çıkışta: bellekteki içerik önbelleklerini boşalt */
export function clearApiCaches() {
  storiesPromise = null
  annotationCache.clear()
  audioCache.clear()
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

// Kelimenin geçtiği hikayeler ve o hikayedeki cümlesi
export const fetchWordStories = (id) => request(`/api/vocabulary/words/${encodeURIComponent(id)}/stories`)

// Bütün kelimelerin türü ve anlamları: alıştırmalarda yanlış seçenek üretmek için
let poolPromise = null
export function fetchWordPool() {
  if (!poolPromise) {
    poolPromise = request('/api/vocabulary/pool').catch((error) => {
      poolPromise = null
      throw error
    })
  }
  return poolPromise
}

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
