// Kelime ve örnek cümle seslendirmeleri (server/scripts/generateVocabAudio.js).
// MP3'ler gruplar halinde Supabase Storage'da; her öğenin grup dosyasındaki aralığı
// server/data/vocab-audio/<ses>.json içinde. Kelime verisine istemci için eklenir.

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { publicAudioUrl, VOICE_KEYS } from './storyAudio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(__dirname, 'data', 'vocab-audio')

/** Kelimenin bir türdeki (ya da okunuşu farklı bir anlamdaki) seslendirme anahtarı */
export const wordAudioKey = (wordId, pos, senseIndex = null) =>
  senseIndex === null ? `${wordId}|${pos}` : `${wordId}|${pos}|${senseIndex}`

export const exampleKey = (sentence) => `ex|${crypto.createHash('sha1').update(sentence).digest('hex').slice(0, 10)}`

// Dosya değişince (yeni grup üretilince) yeniden okunur
const cache = {}
function manifestOf(voice) {
  const file = path.join(DIR, `${voice}.json`)
  try {
    const mtime = fs.statSync(file).mtimeMs
    if (cache[voice]?.mtime !== mtime) cache[voice] = { mtime, data: JSON.parse(fs.readFileSync(file, 'utf8')) }
    return cache[voice].data
  } catch {
    return null
  }
}

function clipOf(manifest, key, supabaseUrl) {
  const item = manifest?.items[key]
  const batch = item && manifest.batches[item[0]]
  return batch ? { url: publicAudioUrl(supabaseUrl, batch.path), start: item[1], end: item[2] } : null
}

/**
 * Kelimenin her anlamına { audio: { female: { word, example }, male: {...} } } ekler.
 * Seslendirmesi olmayan ses ya da öğe atlanır; istemci o durumda cihaz sesini kullanır.
 */
export function withWordAudio(word) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!supabaseUrl || !word) return word
  const manifests = Object.fromEntries(VOICE_KEYS.map((v) => [v, manifestOf(v)]).filter(([, m]) => m))
  if (!Object.keys(manifests).length) return word

  return {
    ...word,
    senses: word.senses.map((sense, i) => {
      const audio = {}
      for (const [voice, manifest] of Object.entries(manifests)) {
        const wordClip =
          clipOf(manifest, wordAudioKey(word.id, sense.pos, i), supabaseUrl) ||
          clipOf(manifest, wordAudioKey(word.id, sense.pos), supabaseUrl)
        const exampleClip = sense.example ? clipOf(manifest, exampleKey(sense.example), supabaseUrl) : null
        if (wordClip || exampleClip) audio[voice] = { word: wordClip, example: exampleClip }
      }
      return Object.keys(audio).length ? { ...sense, audio } : sense
    })
  }
}
