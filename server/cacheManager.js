import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CACHE_FILE = path.join(__dirname, 'wordCache.json')

// Cache yapısı: { "word": { nlp: {...}, llm: {...}, timestamp: ... } }

export function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Cache load error:', error)
  }
  return {}
}

export function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
  } catch (error) {
    console.error('Cache save error:', error)
  }
}

export function getCachedWord(word) {
  const cache = loadCache()
  return cache[word.toLowerCase()] || null
}

export function setCachedWord(word, nlpData, translation = null, contextTranslation = null, sentence = null) {
  const cache = loadCache()
  const key = word.toLowerCase()

  cache[key] = {
    word,
    nlp: nlpData,
    translation,
    contextTranslation,
    sentence,
    timestamp: new Date().toISOString()
  }

  saveCache(cache)
  return cache[key]
}
