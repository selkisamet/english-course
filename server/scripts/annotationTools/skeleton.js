// Elle işaretleme için iskelet: cümleler, kelime numaraları ve Oxford 3000 anlam adayları.
// Kullanım: node server/scripts/annotationTools/skeleton.js <storyId> [storyId ...]
// Çıktıdaki numaralarla build.js'in okuduğu kaynak dosya yazılır (biçim: build.js başındaki açıklama).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { analyzeStory, coreOf } from '../../storyText.js'
import { candidateIds } from '../../vocabLookup.js'
import { getWordById } from '../../vocabularyManager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const stories = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'stories.json'), 'utf8')).stories

for (const id of process.argv.slice(2)) {
  const story = stories.find((s) => s.id === id)
  if (!story) {
    console.log(`# ${id}: hikaye yok`)
    continue
  }
  const { tokens, sentences, sentenceOfToken } = analyzeStory(story.text)
  console.log(`# ${id} — ${story.title} (${story.level}), ${tokens.length} kelime`)
  sentences.forEach((s, k) => {
    const idx = tokens.map((_, i) => i).filter((i) => sentenceOfToken[i] === k)
    console.log(`S${k}: ${s}`)
    console.log('   ' + idx.map((i) => `${i}:${tokens[i]}`).join(' '))
  })
  const seen = new Set()
  const lines = []
  for (const t of tokens) {
    for (const wid of candidateIds(coreOf(t))) {
      if (seen.has(wid)) continue
      seen.add(wid)
      const w = getWordById(wid)
      lines.push(`${wid}: ` + w.senses.map((s, i) => `${i}=${s.pos}${s.level ? ' ' + s.level : ''}: ${s.translation}`).join(' | '))
    }
  }
  const missing = [...new Set(tokens.map(coreOf).filter((t) => t && !candidateIds(t).length))]
  console.log('ADAYLAR\n' + lines.join('\n'))
  if (missing.length) console.log(`LİSTE DIŞI: ${missing.join(', ')}`)
  console.log('')
}
