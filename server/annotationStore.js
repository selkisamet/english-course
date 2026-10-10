// Hikaye işaretlemelerini okur/yazar ve istemciye temel anlamlarla zenginleştirilmiş halde verir.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { textHash } from './storyText.js'
import { getWordById } from './vocabularyManager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ANN_DIR = path.join(__dirname, 'data', 'story-annotations')

const fileOf = (storyId) => path.join(ANN_DIR, `${path.basename(storyId)}.json`)

export function readAnnotation(storyId) {
  try {
    return JSON.parse(fs.readFileSync(fileOf(storyId), 'utf8'))
  } catch {
    return null
  }
}

// İşaretlemeler her değiştiğinde artar; türetilmiş dizinler (kelime → hikayeler) buna bakar
let version = 0
export const getAnnotationVersion = () => version

export function writeAnnotation(annotation) {
  version++
  fs.mkdirSync(ANN_DIR, { recursive: true })
  fs.writeFileSync(fileOf(annotation.storyId), JSON.stringify(annotation, null, 1) + '\n', 'utf8')
}

export function deleteAnnotation(storyId) {
  version++
  fs.rmSync(fileOf(storyId), { force: true })
}

// Hikaye metni değiştiyse eski işaretleme geçersizdir
export const isCurrent = (annotation, story) => annotation?.textHash === textHash(story.text)

/** İstemci için: her kelimeye Oxford listesindeki temel anlamı ekler */
export function getAnnotationForClient(story) {
  const annotation = readAnnotation(story.id)
  if (!annotation || !isCurrent(annotation, story)) return null

  return {
    storyId: annotation.storyId,
    source: annotation.source,
    sentences: annotation.sentences,
    tokens: annotation.tokens.map(({ wordId, sense, base, ...token }) => {
      const word = wordId ? getWordById(wordId) : null
      const s = word?.senses[sense]
      return {
        ...token,
        base: s
          ? { wordId, word: word.word, translation: s.translation, pos: s.pos, level: s.level, senseCount: word.senses.length }
          : { wordId: null, translation: base }
      }
    })
  }
}
