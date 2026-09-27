// Hikaye işaretlemelerini doğrular (server/data/story-annotations/*.json).
// Kullanım: node server/scripts/validateAnnotations.js [storyId ...]
// Hata varsa çıkış kodu 1 olur. Uyarılar insan incelemesi içindir.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { analyzeStory, coreOf, textHash } from '../storyText.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, '..', 'data')
const ANN_DIR = path.join(DATA, 'story-annotations')

export const POS_VALUES = [
  'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'determiner', 'pronoun',
  'number', 'exclamation', 'modal verb', 'auxiliary verb', 'definite article', 'indefinite article',
  'infinitive marker', 'proper noun'
]

let vocabCache = null
const vocab = () => {
  if (!vocabCache) {
    const words = JSON.parse(fs.readFileSync(path.join(DATA, 'oxford3000.json'), 'utf8')).words
    vocabCache = new Map(words.map((w) => [w.id, w]))
  }
  return vocabCache
}

/** Tek bir işaretlemeyi hikaye metnine göre doğrular. { errors, warnings } döner. */
export function validateAnnotation(story, ann) {
  const errors = []
  const warnings = []
  const { tokens, sentences, sentenceOfToken } = analyzeStory(story.text)
  const words = vocab()

  if (ann.storyId !== story.id) errors.push(`storyId uyuşmuyor: ${ann.storyId}`)
  if (ann.textHash !== textHash(story.text)) errors.push('textHash uyuşmuyor: hikaye metni değişmiş')
  if (!Array.isArray(ann.sentences) || ann.sentences.length !== sentences.length) {
    errors.push(`cümle sayısı ${ann.sentences?.length} ≠ ${sentences.length}`)
  } else {
    ann.sentences.forEach((s, k) => {
      if (!s?.tr?.trim()) errors.push(`S${k}: çeviri boş`)
    })
  }
  if (!Array.isArray(ann.tokens) || ann.tokens.length !== tokens.length) {
    errors.push(`kelime sayısı ${ann.tokens?.length} ≠ ${tokens.length}`)
    return { errors, warnings }
  }

  const seenNote = new Map()
  ann.tokens.forEach((t, i) => {
    const where = `#${i} "${tokens[i]}"`
    if (t.i !== i) errors.push(`${where}: sıra numarası ${t.i}`)
    if (!t.lemma?.trim()) errors.push(`${where}: lemma boş`)
    if (!POS_VALUES.includes(t.pos)) errors.push(`${where}: geçersiz tür "${t.pos}"`)
    if (!t.context?.trim()) errors.push(`${where}: context boş`)

    if (t.wordId) {
      const w = words.get(t.wordId)
      if (!w) errors.push(`${where}: listede olmayan wordId "${t.wordId}"`)
      else if (!Number.isInteger(t.sense) || !w.senses[t.sense]) errors.push(`${where}: geçersiz sense ${t.sense} (${t.wordId})`)
      else {
        const sensePos = w.senses[t.sense].pos
        const compatible =
          sensePos === t.pos ||
          (t.pos === 'verb' && ['auxiliary verb', 'modal verb'].includes(sensePos)) ||
          (t.pos === 'auxiliary verb' && sensePos === 'verb')
        if (!compatible) warnings.push(`${where}: tür ${t.pos}, seçilen anlam ${sensePos}`)
      }
      if (t.base) warnings.push(`${where}: listede olan kelimede base gereksiz`)
    } else {
      if (!t.base?.trim()) errors.push(`${where}: liste dışı kelimede base boş`)
      const slug = (t.lemma || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (t.pos !== 'proper noun' && words.has(slug)) warnings.push(`${where}: "${t.lemma}" listede var ama bağlanmamış`)
    }

    if (t.phrase) {
      const { from, to, text, meaning } = t.phrase
      if (!(from <= i && i <= to && to < tokens.length)) errors.push(`${where}: kalıp aralığı ${from}-${to} geçersiz`)
      if (!text || !meaning) errors.push(`${where}: kalıp metni/anlamı eksik`)
      if (sentenceOfToken[from] !== sentenceOfToken[to]) warnings.push(`${where}: kalıp iki cümleye yayılıyor`)
    }

    // Kök ile yüzey biçimi farklıysa biçim açıklaması beklenir
    const surface = coreOf(tokens[i]).toLowerCase()
    const lemmaForms = (t.lemma || '').toLowerCase().split(/,\s*/)
    if (t.lemma && surface && !lemmaForms.includes(surface) && !t.form && t.pos !== 'proper noun' && !t.phrase) {
      warnings.push(`${where}: kök "${t.lemma}" ama biçim açıklaması yok`)
    }
    if (t.note) {
      const key = `${t.lemma}|${t.note}`
      if (seenNote.has(key)) warnings.push(`${where}: aynı not tekrar ediyor (ilk: #${seenNote.get(key)})`)
      else seenNote.set(key, i)
    }
  })

  return { errors, warnings }
}

// Komut satırından çalıştırıldığında
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const stories = JSON.parse(fs.readFileSync(path.join(DATA, 'stories.json'), 'utf8')).stories
  const only = process.argv.slice(2)
  let errorCount = 0
  let warningCount = 0
  let checked = 0
  for (const story of stories) {
    if (only.length && !only.includes(story.id)) continue
    const file = path.join(ANN_DIR, `${story.id}.json`)
    if (!fs.existsSync(file)) {
      if (only.length) console.log(`✗ ${story.id}: işaretleme yok`)
      continue
    }
    checked++
    const { errors, warnings } = validateAnnotation(story, JSON.parse(fs.readFileSync(file, 'utf8')))
    errorCount += errors.length
    warningCount += warnings.length
    if (errors.length || warnings.length) {
      console.log(`${errors.length ? '✗' : '•'} ${story.id}`)
      errors.forEach((e) => console.log(`   HATA  ${e}`))
      warnings.forEach((w) => console.log(`   uyarı ${w}`))
    }
  }
  const missing = stories.filter((s) => !fs.existsSync(path.join(ANN_DIR, `${s.id}.json`))).length
  console.log(`\n${checked} hikaye kontrol edildi, ${errorCount} hata, ${warningCount} uyarı; işaretlemesi olmayan: ${missing}`)
  process.exit(errorCount ? 1 : 0)
}
