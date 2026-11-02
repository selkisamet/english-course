// Hikayelerde geçip kelime listesinde olmayan kelimeleri çıkarır (yeni kelime adayları).
//
// Her kelimenin seviyesi, geçtiği en düşük hikaye seviyesidir: "bu seviyedeki hikayeleri okumak için
// gereken kelime". Özel isimler ve sayılar alınmaz. Listede olan bir kelime başka bir türde geçiyorsa
// (ör. listede isim, hikayede fiil) yeni anlam adayı olarak işaretlenir.
//
// Çıktı: server/data/vocabulary/story-words.json (her aday için ilk geçtiği cümle ve çevirisi, hikayedeki
// anlamı ve kaç hikayede geçtiği). İçerik (Türkçe karşılık, tanım, örnek) ayrıca hazırlanır.
//
// Kullanım: node server/scripts/extractStoryWords.js

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getAllStories } from '../storyManager.js'
import { analyzeStory, textHash } from '../storyText.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const ANNOTATIONS_DIR = path.join(DATA_DIR, 'story-annotations')
const OUTPUT_FILE = path.join(DATA_DIR, 'vocabulary', 'story-words.json')

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const SKIP_POS = new Set(['proper noun', 'number'])

// Hikayelerden eklenen anlamlar (source: 'story') da aday sayılır; böylece betik yeniden
// çalıştırıldığında önceki hikaye kelimeleri listeden düşmez.
const vocabulary = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'oxford3000.json'), 'utf8')).words
const byId = new Map(vocabulary.map((w) => [w.id, w]))
const isListSense = (wordId, sense) => {
  const s = byId.get(wordId)?.senses[sense]
  return Boolean(s) && s.source !== 'story'
}
const knownPos = new Map()
for (const w of vocabulary) {
  const pos = w.senses.filter((s) => s.source !== 'story').map((s) => s.pos)
  if (pos.length) knownPos.set(w.word.toLowerCase(), new Set(pos))
}

const stories = getAllStories()
  .slice()
  .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.id.localeCompare(b.id))

const candidates = new Map()
let skippedStories = 0

for (const story of stories) {
  const file = path.join(ANNOTATIONS_DIR, `${story.id}.json`)
  if (!fs.existsSync(file)) {
    skippedStories += 1
    continue
  }
  const annotation = JSON.parse(fs.readFileSync(file, 'utf8'))
  // Metni değişmiş hikayenin işaretlemesi güvenilmez
  if (annotation.textHash !== textHash(story.text)) {
    skippedStories += 1
    continue
  }
  const { sentences, sentenceOfToken } = analyzeStory(story.text)

  for (const token of annotation.tokens) {
    if (!token?.lemma || SKIP_POS.has(token.pos)) continue
    if (token.wordId && isListSense(token.wordId, token.sense)) continue
    // Yazımı korunur (English, CEO); eşleştirme küçük harfle
    const word = token.lemma
    const key = `${word.toLowerCase()}|${token.pos}`
    const entry = candidates.get(key)
    if (entry) {
      if (!entry.stories.includes(story.id)) entry.stories.push(story.id)
      entry.count += 1
      continue
    }
    const s = sentenceOfToken[token.i]
    candidates.set(key, {
      word,
      pos: token.pos,
      // Kelime listede var ama bu türü yok: yeni anlam
      kind: knownPos.has(word.toLowerCase()) ? 'sense' : 'word',
      level: story.level,
      context: token.context,
      note: token.note,
      sentence: sentences[s],
      sentenceTr: annotation.sentences[s]?.tr || null,
      stories: [story.id],
      count: 1
    })
  }
}

const list = [...candidates.values()].sort(
  (a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.word.toLowerCase().localeCompare(b.word.toLowerCase())
)
fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), words: list }, null, 2) + '\n')

const byLevel = Object.fromEntries(LEVELS.map((l) => [l, list.filter((w) => w.level === l).length]))
console.log(`${list.length} aday (${list.filter((w) => w.kind === 'sense').length} yeni anlam):`, byLevel)
if (skippedStories) console.log(`${skippedStories} hikayenin işaretlemesi yok ya da metni değişmiş`)
