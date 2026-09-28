// Hikayelerin seviyeye uygunluğu: uzunluk, cümle sayısı ve seviyenin üstündeki / liste dışı kelimeler.
// Kullanım: node server/scripts/storyLevelReport.js [storyId | seviye ...]   (ör. A1 ya da story-a1-011)
// Özel isimler (büyük harfle başlayan ve listede olmayan kelimeler) sayılmaz.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { analyzeStory, coreOf } from '../storyText.js'
import { levelRank, lowestLevel } from '../vocabLookup.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const stories = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'stories.json'), 'utf8')).stories

const LENGTH = { min: 55, max: 90 }
// Seviyenin üstündeki ya da listede olmayan kelimelerin oranı için üst sınır
const MAX_HARD_RATIO = { A1: 0.08, A2: 0.1, B1: 0.14, B2: 0.18, C1: 1, C2: 1 }

export function reportStory(story) {
  const { tokens, sentences, sentenceOfToken } = analyzeStory(story.text)
  const hard = []
  let counted = 0
  tokens.forEach((token, i) => {
    const word = coreOf(token)
    if (!word || /^\d/.test(word)) return
    const level = lowestLevel(word)
    const sentenceStart = i === 0 || sentenceOfToken[i - 1] !== sentenceOfToken[i]
    // Özel isim: cümle ortasında büyük harfle başlayan ya da listede olmayan büyük harfli kelime
    const isName = /^[A-Z]/.test(word) && word !== 'I' && (!sentenceStart || level === null)
    if (isName) return
    counted++
    if (level === null) hard.push(`${word} (liste dışı)`)
    else if (levelRank(level) > levelRank(story.level)) hard.push(`${word} (${level})`)
  })
  const ratio = counted ? hard.length / counted : 0
  const problems = []
  if (tokens.length < LENGTH.min || tokens.length > LENGTH.max) problems.push(`uzunluk ${tokens.length}`)
  if (ratio > (MAX_HARD_RATIO[story.level] ?? 1)) problems.push(`zor kelime oranı %${Math.round(ratio * 100)}`)
  // Tırnak içindeki ? ya da ! cümleyi böler: `"Stop!" he says.` iki cümle olur
  const split = sentences.find((s) => /^[a-z]/.test(s))
  if (split) problems.push(`küçük harfle başlayan cümle (bölünmüş alıntı): "${split.slice(0, 30)}…"`)
  return { id: story.id, title: story.title, words: tokens.length, sentences: sentences.length, ratio, hard, problems }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2)
  const selected = stories.filter((s) => !args.length || args.includes(s.id) || args.includes(s.level))
  let failing = 0
  for (const story of selected) {
    const r = reportStory(story)
    if (r.problems.length) failing++
    const mark = r.problems.length ? '✗' : '✓'
    console.log(`${mark} ${r.id} ${r.title} — ${r.words} kelime, ${r.sentences} cümle, zor %${Math.round(r.ratio * 100)}` +
      (r.problems.length ? `  [${r.problems.join('; ')}]` : ''))
    if (r.hard.length) console.log(`    ${r.hard.join(', ')}`)
  }
  const titles = stories.map((s) => s.title.toLowerCase())
  const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i)
  if (duplicates.length) console.log(`\nTekrarlanan başlıklar: ${[...new Set(duplicates)].join(', ')}`)
  console.log(`\n${selected.length} hikaye, sorunlu: ${failing}`)
}
