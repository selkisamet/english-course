// Elle yazılmış işaretleme kaynağını (<kaynak>/<storyId>.txt) JSON'a çevirir ve doğrular.
// Kullanım: node server/scripts/annotationTools/build.js --src <klasör> <storyId> [storyId ...]
//
// Kaynak dosya biçimi (alanlar "¦" ile ayrılır, boş alan boş bırakılır):
//   S<k> ¦ <k. cümlenin Türkçe çevirisi>
//   P <ilk>-<son> ¦ <kalıbın İngilizcesi> ¦ <Türkçe anlamı>
//   <i> ¦ <kök> ¦ <tür> ¦ <anlam> ¦ <bu cümlede> ¦ <not> ¦ <biçim> ¦ <temel anlam>
// <anlam>: "N" → kimlik kökten türetilir (kökün N. anlamı), "kimlik:N" → açık kimlik
// (ör. a-an:0, colour:0), "-" → listede yok; bu durumda <temel anlam> zorunludur.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { analyzeStory, textHash } from '../../storyText.js'
import { validateAnnotation } from '../validateAnnotations.js'
import { writeAnnotation } from '../../annotationStore.js'
import { slug } from '../../vocabLookup.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const stories = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'stories.json'), 'utf8')).stories
const clean = (v) => (v && v.trim() ? v.trim() : null)

const args = process.argv.slice(2)
const srcIndex = args.indexOf('--src')
if (srcIndex < 0) {
  console.error('Kullanım: build.js --src <klasör> <storyId> [storyId ...]')
  process.exit(1)
}
const src = args[srcIndex + 1]
const ids = args.filter((_, i) => i !== srcIndex && i !== srcIndex + 1)

let errorCount = 0
let warningCount = 0
for (const id of ids) {
  const story = stories.find((s) => s.id === id)
  if (!story) {
    console.log(`✗ ${id}: hikaye yok`)
    errorCount++
    continue
  }
  const { tokens } = analyzeStory(story.text)
  const sentences = []
  const toks = []
  const phrases = []
  for (const raw of fs.readFileSync(path.join(src, `${id}.txt`), 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const f = line.split(/\s*¦\s*/)
    if (/^S\d+$/.test(f[0])) sentences[Number(f[0].slice(1))] = { tr: f[1].trim() }
    else if (/^P \d+-\d+$/.test(f[0])) {
      const [from, to] = f[0].slice(2).split('-').map(Number)
      phrases.push({ from, to, text: f[1].trim(), meaning: f[2].trim() })
    } else {
      const [i, lemma, pos, sense, context, note, form, base] = f
      let wordId = null
      let senseIdx = null
      const s = sense?.trim()
      if (s && s !== '-') {
        if (s.includes(':')) {
          const [wid, n] = s.split(':')
          wordId = wid
          senseIdx = Number(n)
        } else {
          wordId = slug(lemma.trim())
          senseIdx = Number(s)
        }
      }
      toks[Number(i)] = {
        i: Number(i), lemma: lemma.trim(), pos: pos.trim(), wordId, sense: senseIdx,
        context: clean(context), note: clean(note), form: clean(form), base: clean(base), phrase: null
      }
    }
  }
  for (const p of phrases) for (let k = p.from; k <= p.to; k++) if (toks[k]) toks[k].phrase = p
  for (let k = 0; k < tokens.length; k++) if (!toks[k]) toks[k] = { i: k, missing: true }

  const annotation = { storyId: id, textHash: textHash(story.text), source: 'manual', sentences, tokens: toks }
  const { errors, warnings } = validateAnnotation(story, annotation)
  errorCount += errors.length
  warningCount += warnings.length
  if (!errors.length) writeAnnotation(annotation)
  if (errors.length || warnings.length) {
    console.log(`${errors.length ? '✗ (kaydedilmedi)' : '•'} ${id}`)
    errors.forEach((e) => console.log(`   HATA  ${e}`))
    warnings.forEach((w) => console.log(`   uyarı ${w}`))
  }
}
console.log(`${ids.length} hikaye: ${errorCount} hata, ${warningCount} uyarı`)
process.exit(errorCount ? 1 : 0)
