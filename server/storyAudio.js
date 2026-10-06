// Hikayelerin önceden üretilmiş seslendirmeleri (server/scripts/generateStoryAudio.js).
// MP3'ler Supabase Storage'da, kelime zamanlamaları server/data/story-audio/<id>.json dosyalarında durur.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { textHash } from './storyText.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const AUDIO_DIR = path.join(__dirname, 'data', 'story-audio')
export const AUDIO_BUCKET = 'story-audio'

// Okuyucuda gösterilen sıra ve adlar
export const VOICE_KEYS = ['female', 'male']

const fileOf = (storyId) => path.join(AUDIO_DIR, `${path.basename(storyId)}.json`)

export function readStoryAudio(storyId) {
  try {
    return JSON.parse(fs.readFileSync(fileOf(storyId), 'utf8'))
  } catch {
    return null
  }
}

export function writeStoryAudio(audio) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true })
  fs.writeFileSync(fileOf(audio.storyId), JSON.stringify(audio) + '\n', 'utf8')
}

export const publicAudioUrl = (supabaseUrl, filePath) =>
  `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${AUDIO_BUCKET}/${filePath}`

/**
 * İstemci için: metin değişmemişse her sesin adresi, süresi ve her kelimenin başladığı milisaniye.
 * Ses yoksa ya da hikaye metni değiştiyse null döner (okuyucu cihaz sesine geri döner).
 */
export function getStoryAudioForClient(story) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const audio = readStoryAudio(story.id)
  if (!supabaseUrl || !audio || audio.textHash !== textHash(story.text)) return null

  const voices = {}
  for (const key of VOICE_KEYS) {
    const v = audio.voices?.[key]
    if (v?.path && Array.isArray(v.starts)) {
      voices[key] = { url: publicAudioUrl(supabaseUrl, v.path), durationMs: v.durationMs, starts: v.starts }
    }
  }
  return Object.keys(voices).length ? { storyId: story.id, voices } : null
}
