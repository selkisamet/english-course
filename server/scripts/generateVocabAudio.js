// Kelime listesindeki kelimeleri ve örnek cümleleri Azure sesleriyle seslendirir.
//
// Kelimeler ve cümleler tek tek değil gruplar halinde seslendirilir: her grup tek bir MP3 olur
// (Supabase Storage), her öğenin o dosyadaki başlangıç ve bitiş zamanı
// server/data/vocab-audio/<ses>.json dosyasına yazılır. Uygulama yalnızca ilgili aralığı çalar.
//
// Kelimeler türüne uygun kısa bir bağlamda okutulur ("to record", "the record") ve yalnızca
// kelimenin kendisi kesilir; böylece isim/fiil vurgusu doğru olur.
//
// Kullanım:
//   node server/scripts/generateVocabAudio.js --voice female            eksik grupları üret
//   node server/scripts/generateVocabAudio.js --voice male --kind words yalnızca kelimeler
//   node server/scripts/generateVocabAudio.js --voice female --dry      yalnızca karakter sayısı
//   node server/scripts/generateVocabAudio.js --voice female --limit 1  yalnızca ilk eksik grup (deneme)

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { AUDIO_BUCKET } from '../storyAudio.js'
import { exampleKey, wordAudioKey } from '../vocabAudio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') })

const ROOT = path.join(__dirname, '..', 'data')
const OUT_DIR = path.join(ROOT, 'vocab-audio')
const VOICES = {
  female: process.env.AZURE_VOICE_FEMALE || 'en-US-EmmaMultilingualNeural',
  male: process.env.AZURE_VOICE_MALE || 'en-US-BrianMultilingualNeural'
}
// Kelimeler biraz yavaş, cümleler doğal hızda
const RATES = { words: '-10%', examples: '0%' }
const MAX_CHARS = 2400 // ücretsiz katmanda istek başına sınır 3000 karakter
const MAX_ITEMS = 150
const MIN_INTERVAL_MS = 3500
const TICKS_PER_MS = 10000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10)
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Anlamına göre farklı okunan, aynı türde iki anlamı olan kelimeler: her anlam kendi bağlamında
const SENSE_FRAMES = {
  'tear|noun': ['a tear in the paper.', 'a tear on her face.'],
  'used|adjective': ['I am used to it.', 'a used car.']
}

// Türüne göre bağlamın yetmediği, yazılışı aynı ama okunuşu farklı kelimeler
// (ör. "lead" isim: öncülük /liːd/ – metal /led/; "close" zarf /kləʊs/ – fiil /kləʊz/)
const WORD_FRAMES = {
  'lead|noun': 'in the lead.',
  'row|noun': 'in the front row.',
  'close|adverb': 'come close.',
  'close|noun': 'at the close of the day.',
  'live|adverb': 'it is shown live.'
}

function frameFor(word, pos) {
  const special = WORD_FRAMES[`${word.toLowerCase()}|${pos}`]
  if (special) return special
  if (pos === 'verb') return `to ${word}.`
  if (pos === 'noun') return `the ${word}.`
  if (pos === 'adjective') return `it is ${word}.`
  return `${word}.`
}

/** Seslendirilecek bütün öğeler: { key, text, target } — target: metinde kesilecek kısım */
export function buildItems(words) {
  const wordItems = []
  const exampleItems = new Map()
  for (const w of words) {
    const posSeen = new Set()
    w.senses.forEach((sense, i) => {
      const special = SENSE_FRAMES[`${w.id}|${sense.pos}`]
      if (special) {
        const text = special[w.senses.filter((s, j) => j < i && s.pos === sense.pos).length]
        if (text) wordItems.push({ key: wordAudioKey(w.id, sense.pos, i), text, target: w.word })
      } else if (!posSeen.has(sense.pos)) {
        posSeen.add(sense.pos)
        wordItems.push({ key: wordAudioKey(w.id, sense.pos), text: frameFor(w.word, sense.pos), target: w.word })
      }
      if (sense.example && !exampleItems.has(sense.example)) {
        exampleItems.set(sense.example, { key: exampleKey(sense.example), text: sense.example, target: null })
      }
    })
  }
  return { words: wordItems, examples: [...exampleItems.values()] }
}

function toBatches(items) {
  const batches = []
  let current = []
  let chars = 0
  for (const item of items) {
    const len = escapeXml(item.text).length + 1
    if (current.length && (current.length >= MAX_ITEMS || chars + len > MAX_CHARS)) {
      batches.push(current)
      current = []
      chars = 0
    }
    current.push(item)
    chars += len
  }
  if (current.length) batches.push(current)
  return batches
}

function buildSsml(batch, voiceName, rate) {
  const head = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voiceName}"><prosody rate="${rate}">`
  let body = ''
  const ranges = []
  for (const item of batch) {
    const text = escapeXml(item.text)
    const start = head.length + body.length
    // Kesilecek kısmın SSML içindeki aralığı (kelimede hedef kelime, cümlede bütün cümle)
    const targetAt = item.target ? text.lastIndexOf(escapeXml(item.target)) : 0
    const targetLen = item.target ? escapeXml(item.target).length : text.length
    ranges.push({ from: start + targetAt, to: start + targetAt + targetLen })
    body += text + '\n'
  }
  return { ssml: head + body + '</prosody></voice></speak>', ranges }
}

async function synthesize(sdk, ssml) {
  const config = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, process.env.AZURE_SPEECH_REGION)
  config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
  const synthesizer = new sdk.SpeechSynthesizer(config, null)
  const boundaries = []
  synthesizer.wordBoundary = (_, e) => {
    boundaries.push({
      offset: e.textOffset,
      word: e.boundaryType === sdk.SpeechSynthesisBoundaryType.Word,
      ms: e.audioOffset / TICKS_PER_MS,
      end: (e.audioOffset + e.duration) / TICKS_PER_MS
    })
  }
  try {
    const result = await new Promise((resolve, reject) => synthesizer.speakSsmlAsync(ssml, resolve, reject))
    if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
      const details = sdk.CancellationDetails.fromResult(result)
      throw new Error(details.errorDetails || `Seslendirme tamamlanamadı (${result.reason})`)
    }
    return { audio: Buffer.from(result.audioData), durationMs: result.audioDuration / TICKS_PER_MS, boundaries }
  } finally {
    synthesizer.close()
  }
}

/** Her öğenin [başlangıç, bitiş] zamanı (ms). Bulunamayan öğe için null. */
export function cutItems(ranges, boundaries, durationMs) {
  return ranges.map(({ from, to }, i) => {
    const inside = boundaries.filter((b) => b.offset >= from && b.offset < to)
    const words = inside.filter((b) => b.word)
    if (!words.length) return null
    // Kelimenin hemen öncesinden başla; sonunda kısa bir boşluk bırak ama sonraki öğeye taşma
    const start = Math.max(0, words[0].ms - 15)
    const lastEnd = Math.max(...inside.map((b) => b.end))
    const nextStart = boundaries.find((b) => b.offset >= (ranges[i + 1]?.from ?? Infinity))?.ms ?? durationMs
    const end = Math.min(lastEnd + 120, nextStart - 10, durationMs)
    return end > start ? [Math.round(start), Math.round(end)] : null
  })
}

function readManifest(key) {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT_DIR, `${key}.json`), 'utf8'))
  } catch {
    return { voice: VOICES[key], batches: {}, items: {} }
  }
}

function writeManifest(key, manifest) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, `${key}.json`), JSON.stringify(manifest) + '\n', 'utf8')
}

async function main() {
  const args = process.argv.slice(2)
  const voiceKey = args[args.indexOf('--voice') + 1]
  if (!VOICES[voiceKey] || !args.includes('--voice')) throw new Error('--voice female ya da --voice male')
  const kinds = args.includes('--kind') ? [args[args.indexOf('--kind') + 1]] : ['words', 'examples']
  const dry = args.includes('--dry')

  const { words } = JSON.parse(fs.readFileSync(path.join(ROOT, 'oxford3000.json'), 'utf8'))
  const items = buildItems(words)
  const voiceName = VOICES[voiceKey]
  let manifest = readManifest(voiceKey)
  if (manifest.voice !== voiceName) manifest = { voice: voiceName, batches: {}, items: {} }

  const plan = []
  for (const kind of kinds) {
    toBatches(items[kind]).forEach((batch, i) => {
      const { ssml, ranges } = buildSsml(batch, voiceName, RATES[kind])
      const id = `${kind}-${String(i + 1).padStart(3, '0')}`
      const hash = sha(ssml)
      plan.push({ kind, id, hash, batch, ssml, ranges })
    })
  }
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity
  const todo = plan.filter((p) => manifest.batches[p.id]?.hash !== p.hash).slice(0, limit)
  // Azure'un saydığı karakterler: <speak> ve <voice> dışındaki her şey
  const billable = (ssml) => ssml.replace(/<speak[^>]*>|<\/speak>|<voice[^>]*>|<\/voice>/g, '').length
  const chars = todo.reduce((n, p) => n + billable(p.ssml), 0)
  console.log(`${voiceKey}: ${plan.length} grup, üretilecek ${todo.length}, yaklaşık ${chars.toLocaleString('tr-TR')} karakter`)
  if (dry) return

  for (const k of ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[k]) throw new Error(`.env.local içinde eksik: ${k}`)
  }
  const { default: sdk } = await import('microsoft-cognitiveservices-speech-sdk')
  const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  let lastRequest = 0
  let failed = 0
  for (const p of todo) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const wait = lastRequest + MIN_INTERVAL_MS - Date.now()
      if (wait > 0) await sleep(wait)
      lastRequest = Date.now()
      try {
        const { audio, durationMs, boundaries } = await synthesize(sdk, p.ssml)
        const cuts = cutItems(p.ranges, boundaries, durationMs)
        const missing = p.batch.filter((_, i) => !cuts[i]).map((it) => it.key)
        if (missing.length) throw new Error(`zamanı bulunamayan öğeler: ${missing.slice(0, 5).join(', ')}`)

        const filePath = `vocab/${voiceKey}/${p.id}-${p.hash}.mp3`
        const { error } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(filePath, audio, { contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000' })
        if (error) throw new Error(`yükleme hatası: ${error.message}`)
        const old = manifest.batches[p.id]?.path
        if (old && old !== filePath) await supabase.storage.from(AUDIO_BUCKET).remove([old])

        manifest.batches[p.id] = { path: filePath, hash: p.hash }
        p.batch.forEach((it, i) => (manifest.items[it.key] = [p.id, ...cuts[i]]))
        writeManifest(voiceKey, manifest)
        console.log(`✓ ${p.id} ${p.batch.length} öğe, ${(durationMs / 1000).toFixed(0)} sn`)
        break
      } catch (err) {
        const message = String(err?.message || err)
        console.warn(`  ${p.id} deneme ${attempt}: ${message}`)
        if (attempt === 3) failed++
        else await sleep(/429|throttl|too many/i.test(message) ? 60000 : 5000)
      }
    }
  }

  // Artık listede olmayan öğeleri temizle
  const keys = new Set([...items.words, ...items.examples].map((it) => it.key))
  for (const key of Object.keys(manifest.items)) if (!keys.has(key)) delete manifest.items[key]
  writeManifest(voiceKey, manifest)
  console.log(`\nBitti. Başarısız grup: ${failed}`)
  if (failed) process.exitCode = 1
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
