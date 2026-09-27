// Oxford 3000 kelime verisini kaynak dosyalardan üretir.
//
//   Liste, tür ve seviyeler: server/data/vocabulary/oxford3000-list.json
//     (Oxford University Press'in yayımladığı "The Oxford 3000 by CEFR level" PDF'inden)
//   Türkçe karşılık, tanım ve örnekler: server/data/vocabulary/content.tsv
//
// Çıktı: server/data/oxford3000.json
// Kullanım: node server/scripts/buildVocabulary.js

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const LIST_FILE = path.join(DATA_DIR, 'vocabulary', 'oxford3000-list.json')
const CONTENT_FILE = path.join(DATA_DIR, 'vocabulary', 'content.tsv')
const OUTPUT_FILE = path.join(DATA_DIR, 'oxford3000.json')

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2']

export const slugify = (word) =>
  word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const keyOf = (e) => [e.word, e.homonym || '', e.sense || '', e.pos].join('|')

const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'))

const content = new Map()
const lines = fs.readFileSync(CONTENT_FILE, 'utf8').split(/\r?\n/).filter(Boolean)
for (const [i, line] of lines.slice(1).entries()) {
  const [key, tr, definition, example, exampleTr, ...rest] = line.split('\t')
  if (rest.length || !exampleTr) throw new Error(`content.tsv satır ${i + 2}: 5 sütun olmalı`)
  if (content.has(key)) throw new Error(`content.tsv: tekrar eden anahtar ${key}`)
  content.set(key, { tr, definition, example, exampleTr })
}

const missing = list.entries.filter((e) => !content.has(keyOf(e)))
if (missing.length) {
  throw new Error(`İçeriği eksik ${missing.length} kayıt var, ör. ${missing.slice(0, 5).map(keyOf).join(', ')}`)
}
const known = new Set(list.entries.map(keyOf))
const unused = [...content.keys()].filter((k) => !known.has(k))
if (unused.length) throw new Error(`Listede olmayan içerik: ${unused.slice(0, 5).join(', ')}`)

// Kimlik: kelimenin küçük harfli hali. "May/may", "IT/it" gibi yalnızca büyük-küçük harfle
// ayrılan kelimelerde büyük harfli olana türü eklenir (may-noun, it-noun).
const lowerVariants = new Set(list.entries.filter((e) => e.word === e.word.toLowerCase()).map((e) => slugify(e.word)))
const idOf = (entry) =>
  entry.word !== entry.word.toLowerCase() && lowerVariants.has(slugify(entry.word))
    ? `${slugify(entry.word)}-${slugify(entry.pos)}`
    : slugify(entry.word)

// Aynı kelimenin bütün anlamlarını tek kayıtta topla
const byWord = new Map()
for (const entry of list.entries) {
  const id = idOf(entry)
  if (!byWord.has(id)) byWord.set(id, { id, word: entry.word, senses: [] })
  const c = content.get(keyOf(entry))
  byWord.get(id).senses.push({
    pos: entry.pos,
    level: entry.level,
    ...(entry.homonym && { homonym: Number(entry.homonym) }),
    ...(entry.sense && { note: entry.sense }),
    translation: c.tr,
    definition: c.definition,
    example: c.example,
    exampleTranslation: c.exampleTr
  })
}

const words = [...byWord.values()]
  .map((w) => {
    w.senses.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
    return { ...w, level: w.senses[0].level }
  })
  .sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }))

const output = {
  metadata: {
    version: '2.0',
    source: list.source,
    sourceUrl: list.sourceUrl,
    translations: 'Türkçe karşılıklar, tanımlar ve örnekler elle hazırlanıp Wiktionary çevirileriyle karşılaştırıldı.',
    totalWords: words.length,
    totalSenses: list.entries.length,
    generatedAt: new Date().toISOString()
  },
  words
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 1) + '\n', 'utf8')
console.log(`✅ ${words.length} kelime, ${list.entries.length} anlam → ${path.relative(process.cwd(), OUTPUT_FILE)}`)
