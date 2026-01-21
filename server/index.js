import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { analyzeWord, extractSentence } from './nlpAnalyzer.js'
import { getCachedWord, setCachedWord } from './cacheManager.js'

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

    // 1. Cache'e bak
    const cached = getCachedWord(cleanWord)
    if (cached) {
      console.log(`✅ Cache hit for: ${cleanWord}`)
      return res.json({
        ...cached,
        source: 'cache'
      })
    }

    console.log(`🔍 Cache miss for: ${cleanWord}`)

    // 2. Statik NLP analizi (anında)
    const sentence = context || extractSentence(cleanWord, fullText)
    const nlpData = analyzeWord(cleanWord)

    // 3. DeepL ile çeviri (hızlı)
    let translation = null
    let contextTranslation = null

    try {
      const apiKey = process.env.DEEPL_API_KEY
      if (apiKey) {
        // Kelime anlamı
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

        // Cümledeki kullanım (eğer cümle varsa)
        if (sentence) {
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
          }
        }
      }
    } catch (error) {
      console.error('DeepL translation error:', error)
    }

    // 4. Sonuçları birleştir ve döndür
    const response = {
      word: cleanWord,
      nlp: nlpData,
      translation,
      contextTranslation,
      sentence,
      source: 'fresh'
    }

    // Cache'e kaydet (contextTranslation dahil)
    setCachedWord(cleanWord, nlpData, translation, contextTranslation, sentence)

    res.json(response)

  } catch (error) {
    console.error('Word analysis error:', error)
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Translation server running on http://localhost:${PORT}`)
  console.log(`📝 API endpoints:`)
  console.log(`   - POST http://localhost:${PORT}/api/translate`)
  console.log(`   - POST http://localhost:${PORT}/api/analyze-word (NLP + DeepL + Cache)`)
})
