import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SENTENCE_CACHE_FILE = path.join(__dirname, 'sentenceCache.json')

// Cümle cache yapısı: { "sentence-hash": { sentence: "...", translation: "...", timestamp: ... } }

function createSentenceHash(sentence) {
  // Cümleden hash oluştur (aynı cümle için aynı key)
  return crypto.createHash('md5').update(sentence.toLowerCase().trim()).digest('hex')
}

export function loadSentenceCache() {
  try {
    if (fs.existsSync(SENTENCE_CACHE_FILE)) {
      const data = fs.readFileSync(SENTENCE_CACHE_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Sentence cache load error:', error)
  }
  return {}
}

export function saveSentenceCache(cache) {
  try {
    fs.writeFileSync(SENTENCE_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
  } catch (error) {
    console.error('Sentence cache save error:', error)
  }
}

export function getCachedSentence(sentence) {
  if (!sentence) return null

  const cache = loadSentenceCache()
  const hash = createSentenceHash(sentence)
  return cache[hash] || null
}

export function setCachedSentence(sentence, translation) {
  if (!sentence || !translation) return null

  const cache = loadSentenceCache()
  const hash = createSentenceHash(sentence)

  cache[hash] = {
    sentence,
    translation,
    timestamp: new Date().toISOString()
  }

  saveSentenceCache(cache)
  return cache[hash]
}
