import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OXFORD_FILE = path.join(__dirname, '..', 'data', 'oxford3000.json')

const data = JSON.parse(fs.readFileSync(OXFORD_FILE, 'utf8'))

console.log('C2 kelimeleri:')
const c2Words = data.words.filter(w => w.cefrLevel === 'C2')
c2Words.forEach(w => {
  console.log(`  - ${w.word} (${w.word.length} chars)`)
})

console.log(`\nToplam C2: ${c2Words.length} kelime`)

console.log('\n15+ karakter olan kelimeler:')
const longWords = data.words.filter(w => w.word.length >= 15).slice(0, 20)
longWords.forEach(w => {
  console.log(`  - ${w.word} (${w.word.length} chars, ${w.cefrLevel})`)
})