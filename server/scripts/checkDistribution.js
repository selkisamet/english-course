import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OXFORD_FILE = path.join(__dirname, '..', 'data', 'oxford3000.json')

const data = JSON.parse(fs.readFileSync(OXFORD_FILE, 'utf8'))
const levels = {}

data.words.forEach(w => {
  levels[w.cefrLevel] = (levels[w.cefrLevel] || 0) + 1
})

console.log('Kelime dağılımı:')
Object.keys(levels).sort().forEach(level => {
  console.log(`  ${level}: ${levels[level]} kelime`)
})

console.log('\nÖrnek A1 kelimeleri (ilk 15):')
data.words.filter(w => w.cefrLevel === 'A1').slice(0, 15).forEach(w => {
  console.log(`  - ${w.word}`)
})

console.log('\nÖrnek A2 kelimeleri (ilk 15):')
data.words.filter(w => w.cefrLevel === 'A2').slice(0, 15).forEach(w => {
  console.log(`  - ${w.word}`)
})

console.log('\nÖrnek B2 kelimeleri (ilk 15):')
data.words.filter(w => w.cefrLevel === 'B2').slice(0, 15).forEach(w => {
  console.log(`  - ${w.word}`)
})

console.log('\nC1 kelimeleri:')
data.words.filter(w => w.cefrLevel === 'C1').forEach(w => {
  console.log(`  - ${w.word}`)
})