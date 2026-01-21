import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { analyzeWord, extractSentence } from './nlpAnalyzer.js'
import { getCachedWord, setCachedWord } from './cacheManager.js'
import { getCachedSentence, setCachedSentence } from './sentenceCache.js'
import { getAllStories, getStoryById, createStory, updateStory, deleteStory } from './storyManager.js'
import { authMiddleware, verifyPassword } from './authMiddleware.js'

// .env.local dosyasını yükle
dotenv.config({ path: '.env.local' })

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

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
    const { word, context = '', fullText = '' } = req.body

    if (!word) {
      return res.status(400).json({ error: 'Word is required' })
    }

    const cleanWord = word.toLowerCase().trim()

    // Her zaman güncel cümleyi hesapla
    const sentence = context || extractSentence(cleanWord, fullText)

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

    // 5. Sonuçları birleştir ve döndür
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

// Create new story (requires auth)
app.post('/api/stories', authMiddleware, (req, res) => {
  try {
    const { title, level, text } = req.body

    if (!title || !level || !text) {
      return res.status(400).json({ error: 'Title, level, and text are required' })
    }

    const newStory = createStory({ title, level, text })
    res.status(201).json(newStory)
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

    res.json(updatedStory)
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

    res.json({ message: 'Story deleted successfully' })
  } catch (error) {
    console.error('Delete story error:', error)
    res.status(500).json({
      error: 'Failed to delete story',
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
  console.log(`   - POST http://localhost:${PORT}/api/admin/verify`)
})
