// Hikaye işaretlemelerinde listeye bağlı olmayan kelimeleri, kelime listesine eklenen hikaye
// kelimelerine bağlar (wordId ve anlam sırası). buildVocabulary.js'ten sonra çalıştırılır.
//
// Kullanım: node server/scripts/linkStoryWords.js

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const ANNOTATIONS_DIR = path.join(DATA_DIR, 'story-annotations')

const words = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'oxford3000.json'), 'utf8')).words
const known = new Set(words.map((w) => w.id))

// "kelime|tür" → { wordId, sense }; yalnızca hikayelerden eklenen anlamlar
const storySenses = new Map()
for (const w of words) {
  w.senses.forEach((s, i) => {
    if (s.source === 'story') storySenses.set(`${w.word.toLowerCase()}|${s.pos}`, { wordId: w.id, sense: i })
  })
}

let linked = 0
let files = 0
for (const file of fs.readdirSync(ANNOTATIONS_DIR).filter((f) => f.endsWith('.json'))) {
  const full = path.join(ANNOTATIONS_DIR, file)
  const annotation = JSON.parse(fs.readFileSync(full, 'utf8'))
  let changed = false
  for (const token of annotation.tokens) {
    if (!token?.lemma || (token.wordId && known.has(token.wordId))) continue
    const match = storySenses.get(`${token.lemma.toLowerCase()}|${token.pos}`)
    if (!match) continue
    token.wordId = match.wordId
    token.sense = match.sense
    // Listeye bağlanan kelimenin temel anlamı listeden gelir
    token.base = null
    changed = true
    linked += 1
  }
  if (changed) {
    fs.writeFileSync(full, JSON.stringify(annotation, null, 1) + '\n')
    files += 1
  }
}
console.log(`${linked} kelime bağlandı (${files} hikaye)`)
