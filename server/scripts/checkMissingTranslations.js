import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OXFORD_FILE = path.join(__dirname, '..', 'data', 'oxford3000.json')

const data = JSON.parse(fs.readFileSync(OXFORD_FILE, 'utf8'))

const wordsWithoutTranslation = data.words.filter(w => !w.basicTranslation || w.basicTranslation.trim() === '')

console.log(`📊 Toplam kelime: ${data.words.length}`)
console.log(`❌ Türkçe çevirisi olmayan: ${wordsWithoutTranslation.length}`)
console.log(`✅ Türkçe çevirisi olan: ${data.words.length - wordsWithoutTranslation.length}`)

if (wordsWithoutTranslation.length > 0) {
  console.log('\nTürkçe çevirisi olmayan kelimeler (ilk 50):')
  wordsWithoutTranslation.slice(0, 50).forEach(w => {
    console.log(`  - ${w.word} (${w.cefrLevel})`)
  })
}

// CEFR seviye dağılımı
const levelDistribution = {}
wordsWithoutTranslation.forEach(w => {
  levelDistribution[w.cefrLevel] = (levelDistribution[w.cefrLevel] || 0) + 1
})

if (Object.keys(levelDistribution).length > 0) {
  console.log('\nÇevirisi olmayan kelimelerin seviye dağılımı:')
  Object.keys(levelDistribution).sort().forEach(level => {
    console.log(`  ${level}: ${levelDistribution[level]} kelime`)
  })
}