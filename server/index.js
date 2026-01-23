import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { analyzeWord, extractSentence } from './nlpAnalyzer.js'
import { getCachedWord, setCachedWord } from './cacheManager.js'
import { getCachedSentence, setCachedSentence } from './sentenceCache.js'
import { getAllStories, getStoryById, createStory, updateStory, deleteStory } from './storyManager.js'
import { authMiddleware, verifyPassword } from './authMiddleware.js'
import {
  getAllWords,
  getWordById,
  getWordByText,
  getStats,
  getEnrichedWord,
  setEnrichedWord,
  getAvailableLevels,
  getAvailableCategories
} from './vocabularyManager.js'

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

// ===== Vocabulary Endpoints =====

// Get all words (with filters and pagination)
app.get('/api/vocabulary/words', (req, res) => {
  try {
    const { level, category, search, page, limit } = req.query

    const result = getAllWords({
      level,
      category,
      search,
      page,
      limit
    })

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

// Enrich word with Oxford API + DeepL
app.post('/api/vocabulary/enrich/:word', async (req, res) => {
  try {
    const { word } = req.params
    const cleanWord = word.toLowerCase().trim()

    // 1. Check enrichment cache
    const cached = getEnrichedWord(cleanWord)
    if (cached && cached.turkish !== undefined) {
      console.log(`✅ Enrichment cache hit: ${cleanWord}`)
      return res.json(cached)
    }

    if (cached && !cached.turkish) {
      console.log(`🔄 Re-enriching word (missing turkish field): ${cleanWord}`)
    }

    console.log(`🔍 Enriching word: ${cleanWord}`)

    // 2. Get word from database (includes basicTranslation)
    const wordFromDb = getWordByText(cleanWord)

    // 3. Fetch from Oxford API
    const oxfordData = await fetchOxfordData(cleanWord)

    if (!oxfordData) {
      return res.status(404).json({ error: 'Word not found in Oxford API' })
    }

    // 3. Translate examples to Turkish with DeepL
    const translatedExamples = []
    if (oxfordData.examples && oxfordData.examples.length > 0) {
      for (const example of oxfordData.examples.slice(0, 5)) {
        try {
          const apiKey = process.env.DEEPL_API_KEY
          if (apiKey) {
            const translateResponse = await fetch('https://api-free.deepl.com/v2/translate', {
              method: 'POST',
              headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: [example],
                target_lang: 'TR',
                source_lang: 'EN'
              })
            })

            if (translateResponse.ok) {
              const translateData = await translateResponse.json()
              translatedExamples.push({
                english: example,
                turkish: translateData.translations[0].text
              })
            }
          }
        } catch (error) {
          console.error('DeepL translation error:', error)
          translatedExamples.push({
            english: example,
            turkish: ''
          })
        }
      }
    }

    // 3.5. Translate the word itself to Turkish
    let turkishTranslation = ''
    try {
      const apiKey = process.env.DEEPL_API_KEY
      if (apiKey) {
        const translateResponse = await fetch('https://api-free.deepl.com/v2/translate', {
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

        if (translateResponse.ok) {
          const translateData = await translateResponse.json()
          turkishTranslation = translateData.translations[0].text
        }
      }
    } catch (error) {
      console.error('Word translation error:', error)
    }

    // 4. Build enriched data
    const enrichedData = {
      word: cleanWord,
      turkish: turkishTranslation,
      basicTranslation: wordFromDb?.basicTranslation || turkishTranslation,
      definitions: oxfordData.definitions || [],
      exampleSentences: translatedExamples,
      collocations: oxfordData.collocations || [],
      synonyms: oxfordData.synonyms || [],
      phonetic: oxfordData.phonetic || '',
      partOfSpeech: oxfordData.partOfSpeech || ''
    }

    // 5. Save to cache
    setEnrichedWord(cleanWord, enrichedData)

    res.json(enrichedData)
  } catch (error) {
    console.error('Enrich word error:', error)
    res.status(500).json({
      error: 'Failed to enrich word',
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

// Get available categories
app.get('/api/vocabulary/categories', (req, res) => {
  try {
    const categories = getAvailableCategories()
    res.json(categories)
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({
      error: 'Failed to get categories',
      message: error.message
    })
  }
})

// Helper function to fetch from Oxford API
async function fetchOxfordData(word) {
  try {
    const baseUrl = process.env.OXFORD_BASE_URL
    const appId = process.env.OXFORD_APP_ID
    const appKey = process.env.OXFORD_APP_KEY

    if (!baseUrl || !appId || !appKey) {
      console.error('Oxford API credentials not configured')
      return null
    }

    const url = `${baseUrl}/entries/en-gb/${word}`
    const response = await fetch(url, {
      headers: {
        'app_id': appId,
        'app_key': appKey
      }
    })

    if (!response.ok) {
      console.error(`Oxford API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const result = data.results[0]
    const lexicalEntry = result.lexicalEntries[0]
    const entry = lexicalEntry.entries[0]

    // Extract data
    const definitions = entry.senses
      .filter(sense => sense.definitions)
      .map(sense => sense.definitions[0])
      .slice(0, 3)

    const examples = entry.senses
      .filter(sense => sense.examples)
      .flatMap(sense => sense.examples.map(ex => ex.text))
      .slice(0, 5)

    const synonyms = entry.senses
      .filter(sense => sense.synonyms)
      .flatMap(sense => sense.synonyms.map(syn => syn.text))
      .slice(0, 5)

    const phonetic = result.lexicalEntries[0].pronunciations
      ? result.lexicalEntries[0].pronunciations[0].phoneticSpelling
      : ''

    return {
      definitions,
      examples,
      synonyms,
      collocations: [], // Oxford API might not provide collocations in sandbox
      phonetic,
      partOfSpeech: lexicalEntry.lexicalCategory.text
    }
  } catch (error) {
    console.error('Fetch Oxford data error:', error)
    return null
  }
}

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
  console.log(`   📚 Vocabulary endpoints:`)
  console.log(`   - GET  http://localhost:${PORT}/api/vocabulary/words`)
  console.log(`   - GET  http://localhost:${PORT}/api/vocabulary/words/:id`)
  console.log(`   - POST http://localhost:${PORT}/api/vocabulary/enrich/:word`)
  console.log(`   - GET  http://localhost:${PORT}/api/vocabulary/stats`)
  console.log(`   - GET  http://localhost:${PORT}/api/vocabulary/levels`)
  console.log(`   - GET  http://localhost:${PORT}/api/vocabulary/categories`)
  console.log(`   - POST http://localhost:${PORT}/api/admin/verify`)
})
