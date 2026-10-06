// Hikayeleri Azure sinir ağı sesleriyle seslendirir, MP3'leri Supabase Storage'a yükler ve
// her kelimenin sesteki başlangıç zamanını server/data/story-audio/<id>.json dosyasına yazar.
//
// Gerekli ortam değişkenleri (.env.local):
//   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
//   SUPABASE_URL (ya da VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
// İsteğe bağlı: AZURE_VOICE_FEMALE, AZURE_VOICE_MALE
//
// Kullanım:
//   node server/scripts/generateStoryAudio.js                 eksik ya da metni değişmiş tüm hikayeler
//   node server/scripts/generateStoryAudio.js --level A1      yalnızca bir seviye
//   node server/scripts/generateStoryAudio.js story-a1-001    belirli hikayeler
//   node server/scripts/generateStoryAudio.js --force ...     var olanları da yeniden üret
//   node server/scripts/generateStoryAudio.js --voices        bölgede kullanılabilen en-US seslerini listele

import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { tokenize, textHash, coreOf } from '../storyText.js'
import { AUDIO_BUCKET, VOICE_KEYS, readStoryAudio, writeStoryAudio } from '../storyAudio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') })

const VOICES = {
  female: process.env.AZURE_VOICE_FEMALE || 'en-US-EmmaMultilingualNeural',
  male: process.env.AZURE_VOICE_MALE || 'en-US-BrianMultilingualNeural'
}

// Ücretsiz katman dakikada 20 isteğe izin verir; aralarda pay bırak
const MIN_INTERVAL_MS = 3500
const TICKS_PER_MS = 10000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Azure'un kelime sınırlarını hikayenin kelimeleriyle (tokenize) eşleştirir.
 * Dönen dizi: her kelimenin sesteki başlangıç zamanı (ms), artan sırada.
 * @param {string} text
 * @param {{textOffset:number, wordLength:number, text:string, ms:number}[]} boundaries
 */
export function alignBoundaries(text, boundaries) {
  const { tokens, offsets } = tokenize(text)
  const starts = new Array(tokens.length).fill(null)
  const tokenAt = (charIndex) => {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (offsets[i] <= charIndex) return charIndex < offsets[i] + tokens[i].length ? i : -1
    }
    return -1
  }
  const norm = (s) => coreOf(s).toLowerCase().replace(/’/g, "'")
  // "Car-free" gibi kelimeleri Azure parça parça okuyabilir
  const parts = (s) => norm(s).split(/[-–—/:]/).filter(Boolean)
  const fits = (token, target) => norm(token) === target || parts(token).includes(target)

  let last = -1
  for (const b of boundaries) {
    let i = -1
    // Önce metindeki konuma güven; konum kelimeyle uyuşmuyorsa sırayla ara
    if (b.textOffset >= 0 && text.slice(b.textOffset, b.textOffset + b.wordLength).toLowerCase() === b.text.toLowerCase()) {
      i = tokenAt(b.textOffset)
    }
    if (i < 0) {
      const target = norm(b.text)
      if (!target) continue
      // Önceki kelimenin devamı mı (birleşik kelimenin ikinci parçası), yoksa sonraki kelimelerden biri mi
      if (last >= 0 && parts(tokens[last]).length > 1 && parts(tokens[last]).includes(target)) i = last
      for (let j = last + 1; i < 0 && j < tokens.length && j <= last + 4; j++) {
        if (fits(tokens[j], target)) i = j
      }
    }
    if (i < 0 || i < last) continue
    if (starts[i] === null) starts[i] = b.ms
    last = i
  }

  const matched = starts.filter((s) => s !== null).length

  // Eşleşmeyen kelimeleri komşularının arasına yerleştir
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] !== null) continue
    const prev = i > 0 ? starts[i - 1] : 0
    let j = i + 1
    while (j < starts.length && starts[j] === null) j++
    const next = j < starts.length ? starts[j] : prev
    for (let k = i; k < j; k++) starts[k] = Math.round(prev + ((next - prev) * (k - i + 1)) / (j - i + 1))
    i = j - 1
  }
  for (let i = 1; i < starts.length; i++) if (starts[i] < starts[i - 1]) starts[i] = starts[i - 1]

  return { starts: starts.map((s) => Math.round(s)), matched, total: tokens.length }
}

async function synthesize(sdk, text, voiceName) {
  const config = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, process.env.AZURE_SPEECH_REGION)
  config.speechSynthesisVoiceName = voiceName
  config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
  const synthesizer = new sdk.SpeechSynthesizer(config, null)

  const boundaries = []
  synthesizer.wordBoundary = (_, e) => {
    if (e.boundaryType !== sdk.SpeechSynthesisBoundaryType.Word) return
    boundaries.push({ textOffset: e.textOffset, wordLength: e.wordLength, text: e.text, ms: e.audioOffset / TICKS_PER_MS })
  }

  try {
    const result = await new Promise((resolve, reject) => synthesizer.speakTextAsync(text, resolve, reject))
    if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
      const details = sdk.CancellationDetails.fromResult(result)
      throw new Error(details.errorDetails || `Seslendirme tamamlanamadı (${result.reason})`)
    }
    return {
      audio: Buffer.from(result.audioData),
      durationMs: Math.round(result.audioDuration / TICKS_PER_MS),
      boundaries
    }
  } finally {
    synthesizer.close()
  }
}

async function listVoices() {
  const { AZURE_SPEECH_KEY: key, AZURE_SPEECH_REGION: region } = process.env
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
    headers: { 'Ocp-Apim-Subscription-Key': key }
  })
  if (!res.ok) throw new Error(`Ses listesi alınamadı: HTTP ${res.status}`)
  const voices = (await res.json()).filter((v) => v.Locale === 'en-US' && v.VoiceType === 'Neural')
  for (const v of voices) console.log(`${v.ShortName.padEnd(36)} ${v.Gender}`)
  for (const [key, name] of Object.entries(VOICES)) {
    console.log(`${key}: ${name} ${voices.some((v) => v.ShortName === name) ? '✓ mevcut' : '✗ BU BÖLGEDE YOK'}`)
  }
}

function checkEnv() {
  const missing = ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k])
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) missing.push('SUPABASE_URL')
  if (missing.length) {
    console.error(`.env.local içinde eksik: ${missing.join(', ')}`)
    process.exit(1)
  }
}

async function ensureBucket(supabase) {
  const { data } = await supabase.storage.getBucket(AUDIO_BUCKET)
  if (data) return
  const { error } = await supabase.storage.createBucket(AUDIO_BUCKET, { public: true, allowedMimeTypes: ['audio/mpeg'] })
  if (error) throw new Error(`Depolama klasörü oluşturulamadı: ${error.message}`)
  console.log(`Supabase Storage'da "${AUDIO_BUCKET}" klasörü oluşturuldu (herkese açık).`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--voices')) {
    checkEnv()
    return listVoices()
  }
  checkEnv()

  const force = args.includes('--force')
  const levelIdx = args.indexOf('--level')
  const level = levelIdx >= 0 ? args[levelIdx + 1] : null
  const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--level')

  const { default: sdk } = await import('microsoft-cognitiveservices-speech-sdk')
  const { getAllStories } = await import('../storyManager.js')
  const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })
  await ensureBucket(supabase)

  let stories = getAllStories()
  if (ids.length) stories = stories.filter((s) => ids.includes(s.id))
  if (level) stories = stories.filter((s) => s.level === level)

  let done = 0
  let skipped = 0
  let failed = 0
  let lastRequest = 0

  for (const story of stories) {
    const hash = textHash(story.text)
    const existing = readStoryAudio(story.id)
    const current = existing?.textHash === hash ? existing : null
    const record = { storyId: story.id, textHash: hash, voices: { ...(current?.voices || {}) } }

    for (const key of VOICE_KEYS) {
      const voiceName = VOICES[key]
      if (!force && record.voices[key]?.voice === voiceName) {
        skipped++
        continue
      }

      for (let attempt = 1; attempt <= 3; attempt++) {
        const wait = lastRequest + MIN_INTERVAL_MS - Date.now()
        if (wait > 0) await sleep(wait)
        lastRequest = Date.now()
        try {
          const { audio, durationMs, boundaries } = await synthesize(sdk, story.text, voiceName)
          const { starts, matched, total } = alignBoundaries(story.text, boundaries)
          if (matched < total * 0.9) {
            throw new Error(`kelime zamanlarının yalnızca ${matched}/${total} tanesi eşleşti`)
          }

          // Ses adı adreste: ses değişince eski dosya önbellekten çalınmaz
          const filePath = `${key}/${story.id}-${hash}-${voiceName.replace(/^en-US-|Neural$/g, '').toLowerCase()}.mp3`
          const { error } = await supabase.storage
            .from(AUDIO_BUCKET)
            .upload(filePath, audio, { contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000' })
          if (error) throw new Error(`yükleme hatası: ${error.message}`)

          // Metni değişen hikayenin eski ses dosyasını sil
          const old = existing?.voices?.[key]?.path
          if (old && old !== filePath) await supabase.storage.from(AUDIO_BUCKET).remove([old])

          record.voices[key] = { voice: voiceName, path: filePath, durationMs, starts }
          writeStoryAudio(record)
          done++
          console.log(`✓ ${story.id} ${key} (${voiceName}) ${(durationMs / 1000).toFixed(1)} sn, ${matched}/${total} kelime`)
          break
        } catch (err) {
          const message = String(err?.message || err)
          console.warn(`  ${story.id} ${key} deneme ${attempt}: ${message}`)
          if (attempt === 3) {
            failed++
            break
          }
          // Kota aşımında bir dakika bekle
          await sleep(/429|throttl|too many/i.test(message) ? 60000 : 5000)
        }
      }
    }
  }

  console.log(`\nÜretilen: ${done}, zaten hazır: ${skipped}, başarısız: ${failed}`)
  if (failed) process.exitCode = 1
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
