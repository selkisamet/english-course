import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// server/scripts/buildVocabulary.js tarafından üretilir, elle düzenlenmez
const OXFORD_FILE = path.join(__dirname, 'data', 'oxford3000.json')

const LEVELS = ['A1', 'A2', 'B1', 'B2']

let cache = null

export function loadOxford3000() {
  if (!cache) {
    try {
      cache = JSON.parse(fs.readFileSync(OXFORD_FILE, 'utf8'))
    } catch (error) {
      console.error('Oxford 3000 load error:', error)
      return { words: [], metadata: {} }
    }
  }
  return cache
}

export function getAllWords(options = {}) {
  let words = loadOxford3000().words

  // Bir seviye seçildiyse o seviyede en az bir anlamı olan kelimeler
  if (options.level && options.level !== 'all') {
    words = words.filter((w) => w.senses.some((s) => s.level === options.level))
  }

  if (options.search) {
    const searchLower = options.search.toLowerCase()
    words = words.filter((w) => w.word.toLowerCase().includes(searchLower))
    // Birebir eşleşme en üstte
    words = [...words].sort(
      (a, b) =>
        (b.word.toLowerCase() === searchLower) - (a.word.toLowerCase() === searchLower) ||
        (b.word.toLowerCase().startsWith(searchLower)) - (a.word.toLowerCase().startsWith(searchLower))
    )
  }

  const page = parseInt(options.page) || 1
  const limit = Math.min(parseInt(options.limit) || 50, 200)
  const start = (page - 1) * limit

  return {
    words: words.slice(start, start + limit),
    total: words.length,
    page,
    limit,
    totalPages: Math.ceil(words.length / limit)
  }
}

// Alıştırmalarda yanlış seçenek üretmek için bütün kelimelerin yalnızca türü ve anlamı
let poolCache = null
export function getWordPool() {
  if (!poolCache) {
    poolCache = loadOxford3000().words.map((w) => ({
      id: w.id,
      word: w.word,
      level: w.level,
      senses: w.senses.map((s) => ({ pos: s.pos, translation: s.translation }))
    }))
  }
  return poolCache
}

export function getWordById(id) {
  return loadOxford3000().words.find((word) => word.id === id) || null
}

export function getStats() {
  const data = loadOxford3000()
  const levelCounts = Object.fromEntries(
    LEVELS.map((level) => [level, data.words.filter((w) => w.senses.some((s) => s.level === level)).length])
  )

  return {
    totalWords: data.words.length,
    levelCounts,
    metadata: data.metadata || {}
  }
}

export function getAvailableLevels() {
  return LEVELS
}
