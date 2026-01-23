import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OXFORD_FILE = path.join(__dirname, 'data', 'oxford3000.json')
const ENRICHMENT_CACHE = path.join(__dirname, 'data', 'wordEnrichmentCache.json')

// ===== Oxford 3000 Base Data Functions =====

export function loadOxford3000() {
  try {
    if (fs.existsSync(OXFORD_FILE)) {
      const data = fs.readFileSync(OXFORD_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Oxford 3000 load error:', error)
  }
  return { words: [], metadata: {} }
}

export function saveOxford3000(data) {
  try {
    fs.writeFileSync(OXFORD_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (error) {
    console.error('Oxford 3000 save error:', error)
    throw error
  }
}

export function getAllWords(options = {}) {
  const data = loadOxford3000()
  let words = data.words || []

  // Filter by level
  if (options.level && options.level !== 'all') {
    words = words.filter(w => w.cefrLevel === options.level)
  }

  // Filter by category
  if (options.category && options.category !== 'all') {
    words = words.filter(w => w.categories && w.categories.includes(options.category))
  }

  // Search by word text
  if (options.search) {
    const searchLower = options.search.toLowerCase()
    words = words.filter(w => w.word.toLowerCase().includes(searchLower))
  }

  // Pagination
  const page = parseInt(options.page) || 1
  const limit = parseInt(options.limit) || 50
  const start = (page - 1) * limit
  const end = start + limit

  const paginatedWords = words.slice(start, end)

  return {
    words: paginatedWords,
    total: words.length,
    page,
    limit,
    totalPages: Math.ceil(words.length / limit)
  }
}

export function getWordById(id) {
  const data = loadOxford3000()
  const words = data.words || []
  return words.find(word => word.id === id) || null
}

export function getWordByText(word) {
  const data = loadOxford3000()
  const words = data.words || []
  return words.find(w => w.word.toLowerCase() === word.toLowerCase()) || null
}

export function getWordsByLevel(level) {
  const data = loadOxford3000()
  const words = data.words || []
  return words.filter(w => w.cefrLevel === level)
}

export function getWordsByCategory(category) {
  const data = loadOxford3000()
  const words = data.words || []
  return words.filter(w => w.categories && w.categories.includes(category))
}

export function searchWords(query) {
  const data = loadOxford3000()
  const words = data.words || []
  const searchLower = query.toLowerCase()
  return words.filter(w => w.word.toLowerCase().includes(searchLower))
}

export function getStats() {
  const data = loadOxford3000()
  const words = data.words || []

  // Count words by level
  const levelCounts = {}
  const categoryCounts = {}

  words.forEach(word => {
    // Level count
    levelCounts[word.cefrLevel] = (levelCounts[word.cefrLevel] || 0) + 1

    // Category count
    if (word.categories) {
      word.categories.forEach(cat => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
      })
    }
  })

  return {
    totalWords: words.length,
    levelCounts,
    categoryCounts,
    metadata: data.metadata || {}
  }
}

// ===== Word Enrichment Cache Functions =====

export function loadEnrichmentCache() {
  try {
    if (fs.existsSync(ENRICHMENT_CACHE)) {
      const data = fs.readFileSync(ENRICHMENT_CACHE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Enrichment cache load error:', error)
  }
  return {}
}

export function saveEnrichmentCache(cache) {
  try {
    fs.writeFileSync(ENRICHMENT_CACHE, JSON.stringify(cache, null, 2), 'utf8')
  } catch (error) {
    console.error('Enrichment cache save error:', error)
    throw error
  }
}

export function getEnrichedWord(word) {
  const cache = loadEnrichmentCache()
  const key = word.toLowerCase()
  return cache[key] || null
}

export function setEnrichedWord(word, enrichedData) {
  const cache = loadEnrichmentCache()
  const key = word.toLowerCase()

  cache[key] = {
    ...enrichedData,
    word,
    timestamp: new Date().toISOString()
  }

  // Implement simple LRU cache (max 500 entries)
  const entries = Object.entries(cache)
  if (entries.length > 500) {
    // Sort by timestamp, keep most recent 500
    const sorted = entries
      .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
      .slice(0, 500)

    const newCache = Object.fromEntries(sorted)
    saveEnrichmentCache(newCache)
  } else {
    saveEnrichmentCache(cache)
  }

  return cache[key]
}

// ===== Utility Functions =====

export function getAvailableLevels() {
  return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
}

export function getAvailableCategories() {
  const data = loadOxford3000()
  const words = data.words || []
  const categoriesSet = new Set()

  words.forEach(word => {
    if (word.categories) {
      word.categories.forEach(cat => categoriesSet.add(cat))
    }
  })

  return Array.from(categoriesSet).sort()
}
