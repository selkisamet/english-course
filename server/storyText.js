// Hikaye metnini kelimelere ve cümlelere böler.
// src/utils/format.js ve src/pages/StoryReader.jsx ile aynı kuralları kullanır;
// işaretlemeler (story-annotations) bu bölmeye göre yapılır, değiştirilirse ikisi birlikte değişmeli.

import crypto from 'crypto'

// Cümle sonu sanılmaması gereken kısaltmalar
const ABBREVIATIONS = /\b(Mr|Mrs|Ms|Dr|St|Prof|Jr|Sr)\.(?=\s)/g

export function splitSentences(text) {
  const masked = text.replace(ABBREVIATIONS, (m) => m.replace('.', '\u0000'))
  const parts = masked.match(/[^.!?]+[.!?]+["”’']?|[^.!?]+$/g) || [masked]
  return parts.map((s) => s.replace(/\u0000/g, '.').trim()).filter(Boolean)
}

export function tokenize(text) {
  const tokens = text.split(/\s+/).filter(Boolean)
  let pos = 0
  const offsets = tokens.map((t) => {
    const i = text.indexOf(t, pos)
    pos = i + t.length
    return i
  })
  return { tokens, offsets }
}

// Her kelimenin hangi cümlede olduğu
export function analyzeStory(text) {
  const { tokens, offsets } = tokenize(text)
  const sentences = splitSentences(text)
  let pos = 0
  const starts = sentences.map((s) => {
    const i = text.indexOf(s, pos)
    pos = i + s.length
    return i
  })
  const sentenceOfToken = offsets.map((o) => {
    let found = 0
    starts.forEach((start, j) => {
      if (start <= o) found = j
    })
    return found
  })
  return { tokens, offsets, sentences, starts, sentenceOfToken }
}

export const textHash = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)

// Kelimenin çıplak hali (baştaki/sondaki noktalama olmadan)
export const coreOf = (token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
