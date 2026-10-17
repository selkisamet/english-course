// Hikaye seslendirmelerinde her cümlenin son kelimesinin bittiği anı ses dosyasından bulur.
//
// Kelime zamanlamalarında yalnızca kelimelerin başlangıcı var. Tek bir cümleyi çalarken (kelime
// paneli, kelime çalışması) bitişi "sonraki cümlenin başı" saymak, ses çıkışı gecikmeli cihazlarda
// (Android) sonraki kelimenin başının duyulmasına yol açıyordu. Burada son kelimenin başından sonraki
// cümlenin başına kadar olan aralıkta sesin konuşma seviyesinde olduğu son an bulunur ve
// voices.<ses>.sentenceEnds = { <son kelimenin sırası>: ms } olarak kaydedilir.
//
// Kullanım: node --env-file=.env.local server/scripts/computeSentenceEnds.js [hikayeKimliği …] [--force]
// Seslendirme yeniden üretilince (generateStoryAudio.js) bu betik de yeniden çalıştırılmalı.

import { MPEGDecoder } from 'mpg123-decoder'
import { getAllStories } from '../storyManager.js'
import { analyzeStory, textHash } from '../storyText.js'
import { publicAudioUrl, readStoryAudio, VOICE_KEYS, writeStoryAudio } from '../storyAudio.js'

const FRAME_MS = 10
// Konuşma sayılan en düşük seviye: dosyanın en yüksek seviyesinin -35 dB altı
const SILENCE_DB = -35

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = new Set(args.filter((a) => !a.startsWith('--')))
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
if (!supabaseUrl) throw new Error('SUPABASE_URL / VITE_SUPABASE_URL tanımlı değil')

/** 10 ms'lik dilimlerin ses seviyesi (RMS) */
function frameLevels(samples, sampleRate) {
  const size = Math.round((sampleRate * FRAME_MS) / 1000)
  const levels = new Float32Array(Math.ceil(samples.length / size))
  for (let f = 0; f < levels.length; f++) {
    let sum = 0
    const end = Math.min(samples.length, (f + 1) * size)
    for (let i = f * size; i < end; i++) sum += samples[i] * samples[i]
    levels[f] = Math.sqrt(sum / Math.max(1, end - f * size))
  }
  return levels
}

async function decode(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  const decoder = new MPEGDecoder()
  await decoder.ready
  try {
    const { channelData, sampleRate } = decoder.decode(new Uint8Array(await response.arrayBuffer()))
    return { samples: channelData[0], sampleRate }
  } finally {
    decoder.free()
  }
}

/** Her cümlenin son kelimesinin sırası */
function sentenceLastTokens(text) {
  const { sentenceOfToken } = analyzeStory(text)
  const last = []
  sentenceOfToken.forEach((s, i) => {
    if (sentenceOfToken[i + 1] !== s) last.push(i)
  })
  return last
}

async function processVoice(voice, lastTokens) {
  const { samples, sampleRate } = await decode(publicAudioUrl(supabaseUrl, voice.path))
  const levels = frameLevels(samples, sampleRate)
  const peak = levels.reduce((m, v) => Math.max(m, v), 0)
  const threshold = peak * Math.pow(10, SILENCE_DB / 20)
  const ends = {}
  for (const t of lastTokens) {
    const from = voice.starts[t]
    const to = voice.starts[t + 1] ?? voice.durationMs
    if (from === undefined || to === undefined || to <= from) continue
    // Aralıkta konuşma seviyesindeki son dilim = son kelimenin bitişi
    let lastLoud = -1
    for (let f = Math.floor(from / FRAME_MS); f < Math.min(levels.length, Math.ceil(to / FRAME_MS)); f++) {
      if (levels[f] >= threshold) lastLoud = f
    }
    if (lastLoud < 0) continue
    const end = Math.min(to, (lastLoud + 1) * FRAME_MS)
    if (end > from + 80) ends[t] = end
  }
  return ends
}

let done = 0
let skipped = 0
for (const story of getAllStories()) {
  if (only.size && !only.has(story.id)) continue
  const audio = readStoryAudio(story.id)
  if (!audio || audio.textHash !== textHash(story.text)) {
    skipped += 1
    continue
  }
  const lastTokens = sentenceLastTokens(story.text)
  let changed = false
  for (const key of VOICE_KEYS) {
    const voice = audio.voices?.[key]
    if (!voice?.path || (voice.sentenceEnds && !force)) continue
    voice.sentenceEnds = await processVoice(voice, lastTokens)
    changed = true
  }
  if (changed) {
    writeStoryAudio(audio)
    done += 1
    if (done % 25 === 0) console.log(`${done} hikaye işlendi…`)
  }
}
console.log(`tamam: ${done} hikaye güncellendi, ${skipped} hikayenin sesi yok ya da metni değişmiş`)
