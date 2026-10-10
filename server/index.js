import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { analyzeWord, extractSentence } from './nlpAnalyzer.js'
import {
  getCachedWord,
  setCachedWord,
  getCachedContextTranslation,
  setCachedContextTranslation
} from './cacheManager.js'
import { getCachedSentence, setCachedSentence } from './sentenceCache.js'
import { getAllStories, getStoryById, createStory, updateStory, deleteStory } from './storyManager.js'
import { authMiddleware, verifyPassword } from './authMiddleware.js'
import { deleteAnnotation, getAnnotationForClient, readAnnotation, writeAnnotation } from './annotationStore.js'
import { getStoryAudioForClient } from './storyAudio.js'
import { forgetAnnotationJob, getAnnotationStatus, queueAnnotation } from './storyAnnotator.js'
import { analyzeStory, textHash } from './storyText.js'
import { validateAnnotation } from './scripts/validateAnnotations.js'
import { deleteAccount, requireAccess, requireUser } from './userAuth.js'
import { getAllWords, getWordById, getWordPool, getStats, getAvailableLevels } from './vocabularyManager.js'

// .env.local dosyasını yükle
dotenv.config({ path: '.env.local' })

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// İçerik yalnızca girişli ve erişim süresi dolmamış kullanıcılara (ya da yönetim paneline) açık.
// Hikaye ekleme/düzenleme gibi yönetici işlemleri ayrıca authMiddleware ile korunur.
app.use(['/api/translate', '/api/analyze-word', '/api/vocabulary'], requireAccess)
app.use('/api/stories', (req, res, next) => (req.method === 'GET' ? requireAccess(req, res, next) : next()))

// Hesabı ve bütün verilerini sil
app.delete('/api/account', requireUser, async (req, res) => {
  try {
    await deleteAccount(req.userId)
    res.json({ message: 'Hesap silindi' })
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({ error: 'Hesap silinemedi' })
  }
})

// DeepL ile EN → TR çeviri. `context` verilirse çeviriyi etkiler ama kendisi çevrilmez
async function translateWithContext(text, context) {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) return null

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      context,
      target_lang: 'TR',
      source_lang: 'EN'
    })
  })

  if (!response.ok) return null
  const data = await response.json()
  return data.translations[0].text
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Translation API is running' })
})

// Translation endpoint
app.post('/api/translate', async (req, res) => {
  try {
    const { text, source = 'EN', target = 'TR' } = req.body

    if (!text) {
      return res.status(400).json({ error: 'Text is required' })
    }

    const apiKey = process.env.DEEPL_API_KEY

    if (!apiKey) {
      console.error('API Key not found in environment variables')
      return res.status(500).json({ error: 'API key not configured' })
    }

    // DeepL API request
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [text],
        target_lang: target.toUpperCase(),
        source_lang: source.toUpperCase()
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepL API Error:', response.status, errorText)
      return res.status(response.status).json({
        error: 'Translation failed',
        details: errorText
      })
    }

    const data = await response.json()

    res.json({
      translation: data.translations[0].text,
      source,
      target
    })

  } catch (error) {
    console.error('Translation error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

// Word analysis endpoint (Hybrid: NLP + DeepL with cache)
app.post('/api/analyze-word', async (req, res) => {
  try {
    const { word, sentence: providedSentence = '' } = req.body

    if (!word) {
      return res.status(400).json({ error: 'Word is required' })
    }

    const cleanWord = word.toLowerCase().trim()

    // Frontend'den gelen cümleyi kullan
    const sentence = providedSentence.trim()

    // 1. Cache'e bak (sadece kelime çevirisi ve NLP için)
    const cached = getCachedWord(cleanWord)

    let translation = null
    let nlpData = null

    if (cached) {
      console.log(`✅ Cache hit for word: ${cleanWord}`)
      // Cache'ten sadece kelime çevirisi ve NLP al
      translation = cached.translation
      nlpData = cached.nlp
    } else {
      console.log(`🔍 Cache miss for: ${cleanWord}`)

      // 2. Statik NLP analizi (anında)
      nlpData = analyzeWord(cleanWord)

      // 3. Kelime çevirisini DeepL'den al
      try {
        const apiKey = process.env.DEEPL_API_KEY
        if (apiKey) {
          const wordResponse = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
              'Authorization': `DeepL-Auth-Key ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: [cleanWord],
              target_lang: 'TR',
              source_lang: 'EN'
            })
          })

          if (wordResponse.ok) {
            const wordData = await wordResponse.json()
            translation = wordData.translations[0].text
          }
        }
      } catch (error) {
        console.error('DeepL word translation error:', error)
      }

      // Cache'e sadece kelime + NLP kaydet (cümle olmadan)
      setCachedWord(cleanWord, nlpData, translation, null, null)
    }

    // 4. Cümle çevirisini cache'ten kontrol et
    let contextTranslation = null

    if (sentence) {
      // Önce cache'e bak
      const cachedSentence = getCachedSentence(sentence)

      if (cachedSentence) {
        console.log(`✅ Sentence cache hit: "${sentence.substring(0, 30)}..."`)
        contextTranslation = cachedSentence.translation
      } else {
        console.log(`🔍 Sentence cache miss, translating...`)
        // Cache'te yoksa DeepL'e gönder
        try {
          const apiKey = process.env.DEEPL_API_KEY
          if (apiKey) {
            const sentenceResponse = await fetch('https://api-free.deepl.com/v2/translate', {
              method: 'POST',
              headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: [sentence],
                target_lang: 'TR',
                source_lang: 'EN'
              })
            })

            if (sentenceResponse.ok) {
              const sentenceData = await sentenceResponse.json()
              contextTranslation = sentenceData.translations[0].text

              // Cache'e kaydet
              setCachedSentence(sentence, contextTranslation)
            }
          }
        } catch (error) {
          console.error('DeepL sentence translation error:', error)
        }
      }
    }

    // 5. Kelimeyi cümle bağlamında çevir (ör. "plays" → "oynuyor", "oyunlar" değil)
    if (sentence) {
      const cachedContext = getCachedContextTranslation(cleanWord, sentence)

      if (cachedContext) {
        translation = cachedContext
      } else {
        try {
          const contextual = await translateWithContext(cleanWord, sentence)
          if (contextual) {
            translation = contextual
            setCachedContextTranslation(cleanWord, sentence, contextual)
          }
        } catch (error) {
          console.error('DeepL context translation error:', error)
        }
      }
    }

    // 6. Sonuçları birleştir ve döndür
    const response = {
      word: cleanWord,
      nlp: nlpData,
      translation,
      contextTranslation,
      sentence,
      source: cached ? 'cache' : 'fresh'
    }

    res.json(response)

  } catch (error) {
    console.error('Word analysis error:', error)
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    })
  }
})

// Story endpoints
// Get all stories
app.get('/api/stories', (req, res) => {
  try {
    const stories = getAllStories()
    res.json(stories)
  } catch (error) {
    console.error('Get stories error:', error)
    res.status(500).json({
      error: 'Failed to get stories',
      message: error.message
    })
  }
})

// Get story by ID
app.get('/api/stories/:id', (req, res) => {
  try {
    const { id } = req.params
    const story = getStoryById(id)

    if (!story) {
      return res.status(404).json({ error: 'Story not found' })
    }

    res.json(story)
  } catch (error) {
    console.error('Get story error:', error)
    res.status(500).json({
      error: 'Failed to get story',
      message: error.message
    })
  }
})

// Hikayenin önceden üretilmiş seslendirmeleri ve kelime zamanlamaları
app.get('/api/stories/:id/audio', (req, res) => {
  try {
    const story = getStoryById(req.params.id)
    if (!story) return res.status(404).json({ error: 'Story not found' })

    const audio = getStoryAudioForClient(story)
    if (!audio) return res.status(404).json({ error: 'Audio not found' })

    res.json(audio)
  } catch (error) {
    console.error('Get audio error:', error)
    res.status(500).json({ error: 'Failed to get audio', message: error.message })
  }
})

// Hikayedeki her kelimenin temel ve bağlamsal anlamı (işaretleme)
app.get('/api/stories/:id/annotations', (req, res) => {
  try {
    const story = getStoryById(req.params.id)
    if (!story) return res.status(404).json({ error: 'Story not found' })

    const annotation = getAnnotationForClient(story)
    if (!annotation) return res.status(404).json({ error: 'Annotation not found' })

    res.json(annotation)
  } catch (error) {
    console.error('Get annotation error:', error)
    res.status(500).json({
      error: 'Failed to get story',
      message: error.message
    })
  }
})

// Create new story (requires auth)
app.post('/api/stories', authMiddleware, (req, res) => {
  try {
    const { title, level, text } = req.body

    if (!title || !level || !text) {
      return res.status(400).json({ error: 'Title, level, and text are required' })
    }

    const newStory = createStory({ title, level, text })
    // Kelime işaretlemesi arka planda hazırlanır; hikaye hemen yayındadır
    queueAnnotation(newStory)
    res.status(201).json({ ...newStory, annotation: getAnnotationStatus(newStory) })
  } catch (error) {
    console.error('Create story error:', error)
    res.status(500).json({
      error: 'Failed to create story',
      message: error.message
    })
  }
})

// Update story (requires auth)
app.put('/api/stories/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const { title, level, text } = req.body

    if (!title || !level || !text) {
      return res.status(400).json({ error: 'Title, level, and text are required' })
    }

    const updatedStory = updateStory(id, { title, level, text })

    if (!updatedStory) {
      return res.status(404).json({ error: 'Story not found' })
    }

    // Metin değiştiyse eski işaretleme geçersizdir, yeniden hazırlanır
    if (getAnnotationStatus(updatedStory).status === 'none') queueAnnotation(updatedStory)
    res.json({ ...updatedStory, annotation: getAnnotationStatus(updatedStory) })
  } catch (error) {
    console.error('Update story error:', error)
    res.status(500).json({
      error: 'Failed to update story',
      message: error.message
    })
  }
})

// Delete story (requires auth)
app.delete('/api/stories/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const success = deleteStory(id)

    if (!success) {
      return res.status(404).json({ error: 'Story not found' })
    }

    deleteAnnotation(id)
    forgetAnnotationJob(id)
    res.json({ message: 'Story deleted successfully' })
  } catch (error) {
    console.error('Delete story error:', error)
    res.status(500).json({
      error: 'Failed to delete story',
      message: error.message
    })
  }
})

// ===== İşaretleme yönetimi (yönetim paneli) =====

// Bütün hikayelerin işaretleme durumu: ready | pending | failed | none
app.get('/api/admin/annotations', authMiddleware, (req, res) => {
  const statuses = Object.fromEntries(getAllStories().map((s) => [s.id, getAnnotationStatus(s)]))
  res.json(statuses)
})

// Claude ile yeniden işaretle
app.post('/api/stories/:id/annotate', authMiddleware, (req, res) => {
  const story = getStoryById(req.params.id)
  if (!story) return res.status(404).json({ error: 'Story not found' })
  queueAnnotation(story)
  res.status(202).json(getAnnotationStatus(story))
})

// İnceleme ekranı için: kelimeler, cümleler ve mevcut işaretleme
app.get('/api/admin/stories/:id/annotation', authMiddleware, (req, res) => {
  const story = getStoryById(req.params.id)
  if (!story) return res.status(404).json({ error: 'Story not found' })
  const { tokens, sentences, sentenceOfToken } = analyzeStory(story.text)
  const saved = readAnnotation(story.id)
  const annotation = saved?.textHash === textHash(story.text) ? saved : null
  // İncelemede temel anlamı göstermek için bağlı kelimelerin Oxford anlamları
  const senses = {}
  for (const t of annotation?.tokens || []) {
    const word = t.wordId && getWordById(t.wordId)
    if (word) senses[t.wordId] = word.senses.map(({ pos, translation }) => ({ pos, translation }))
  }
  res.json({ story, tokens, sentences, sentenceOfToken, annotation, senses, status: getAnnotationStatus(story) })
})

// Elle düzeltilmiş işaretlemeyi doğrulayıp kaydet
app.put('/api/admin/stories/:id/annotation', authMiddleware, (req, res) => {
  const story = getStoryById(req.params.id)
  if (!story) return res.status(404).json({ error: 'Story not found' })
  const { sentences, tokens } = req.body || {}
  const annotation = { storyId: story.id, textHash: textHash(story.text), source: 'manual', sentences, tokens }
  const { errors, warnings } = validateAnnotation(story, annotation)
  if (errors.length) return res.status(400).json({ error: 'Doğrulama hatası', errors, warnings })
  writeAnnotation(annotation)
  forgetAnnotationJob(story.id)
  res.json({ warnings, status: getAnnotationStatus(story) })
})

// ===== Vocabulary Endpoints =====

// Get all words (with filters and pagination)
app.get('/api/vocabulary/words', (req, res) => {
  try {
    const { level, search, page, limit } = req.query
    const result = getAllWords({ level, search, page, limit })

    res.json(result)
  } catch (error) {
    console.error('Get words error:', error)
    res.status(500).json({
      error: 'Failed to get words',
      message: error.message
    })
  }
})

// Get word by ID
// Kelime çalışması: bütün kelimelerin türü ve anlamları (yanlış seçenekler için)
app.get('/api/vocabulary/pool', (req, res) => {
  res.json(getWordPool())
})

app.get('/api/vocabulary/words/:id', (req, res) => {
  try {
    const { id } = req.params
    const word = getWordById(id)

    if (!word) {
      return res.status(404).json({ error: 'Word not found' })
    }

    res.json(word)
  } catch (error) {
    console.error('Get word error:', error)
    res.status(500).json({
      error: 'Failed to get word',
      message: error.message
    })
  }
})

// Get vocabulary statistics
app.get('/api/vocabulary/stats', (req, res) => {
  try {
    const stats = getStats()
    res.json(stats)
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({
      error: 'Failed to get stats',
      message: error.message
    })
  }
})

// Get available levels
app.get('/api/vocabulary/levels', (req, res) => {
  try {
    const levels = getAvailableLevels()
    res.json(levels)
  } catch (error) {
    console.error('Get levels error:', error)
    res.status(500).json({
      error: 'Failed to get levels',
      message: error.message
    })
  }
})

// Admin password verification
app.post('/api/admin/verify', (req, res) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({ error: 'Password is required' })
    }

    const isValid = verifyPassword(password)

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    res.json({
      success: true,
      token: password
    })
  } catch (error) {
    console.error('Verify password error:', error)
    res.status(500).json({
      error: 'Verification failed',
      message: error.message
    })
  }
})

// Production: derlenmiş frontend'i (dist) sun
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  // React Router için: /api dışındaki tüm istekler index.html'e
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`🚀 Translation server running on http://localhost:${PORT}`)
  console.log(`📝 API endpoints:`)
  console.log(`   - POST http://localhost:${PORT}/api/translate`)
  console.log(`   - POST http://localhost:${PORT}/api/analyze-word (NLP + DeepL + Cache)`)
  console.log(`   - GET  http://localhost:${PORT}/api/stories`)
  console.log(`   - GET  http://localhost:${PORT}/api/stories/:id`)
  console.log(`   - POST http://localhost:${PORT}/api/stories (Auth required)`)
  console.log(`   - PUT  http://localhost:${PORT}/api/stories/:id (Auth required)`)
  console.log(`   - DELETE http://localhost:${PORT}/api/stories/:id (Auth required)`)
  console.log(`   📚 Vocabulary endpoints:`)
  console.log(`   - GET  http://localhost:${PORT}/api/vocabulary/words`)
  console.log(`   - GET  http://localhost:${PORT}/api/vocabulary/words/:id`)
  console.log(`   - GET  http://localhost:${PORT}/api/vocabulary/stats`)
  console.log(`   - GET  http://localhost:${PORT}/api/vocabulary/levels`)
  console.log(`   - POST http://localhost:${PORT}/api/admin/verify`)
})
