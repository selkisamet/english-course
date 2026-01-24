import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OXFORD_FILE = path.join(__dirname, '..', 'data', 'oxford3000.json')

console.log('📖 Reading oxford3000.json...')
const data = JSON.parse(fs.readFileSync(OXFORD_FILE, 'utf8'))

const originalCount = data.words.length
const wordsWithoutTranslation = data.words.filter(w => !w.basicTranslation || w.basicTranslation.trim() === '')

console.log(`📊 Toplam kelime: ${originalCount}`)
console.log(`❌ Türkçe çevirisi olmayan: ${wordsWithoutTranslation.length}`)

// Filter out words without translations
data.words = data.words.filter(w => w.basicTranslation && w.basicTranslation.trim() !== '')

console.log(`✅ Kalan kelime: ${data.words.length}`)
console.log(`🗑️  Silinen kelime: ${originalCount - data.words.length}`)

// Show distribution after filtering
const levelCounts = {}
data.words.forEach(w => {
  levelCounts[w.cefrLevel] = (levelCounts[w.cefrLevel] || 0) + 1
})

console.log('\n📈 Yeni dağılım:')
Object.keys(levelCounts).sort().forEach(level => {
  console.log(`   ${level}: ${levelCounts[level]} kelime`)
})

// Save filtered data
console.log('\n💾 Saving filtered oxford3000.json...')
fs.writeFileSync(OXFORD_FILE, JSON.stringify(data, null, 2), 'utf8')
console.log('✅ Done! Words without Turkish translations have been removed.')