// Kelime çalışması sorularını bütün kelime listesi için üretir ve denetler:
// hiçbir yanlış seçenek doğru cevapla aynı anlama gelmemeli.
//
// Kullanım: node server/scripts/checkExercises.js [--samples]

import { getWordPool, loadOxford3000 } from '../vocabularyManager.js'
import { buildExercise, describeWord, meaningUnits, meaningsOverlap, checkTyped } from '../../src/utils/exercises.js'

const pool = getWordPool()
const byId = new Map(pool.map((w) => [w.id, w]))
const unitsOf = (id) => byId.get(id).senses.flatMap((s) => meaningUnits(s.translation))

// Sabit tohumlu rastgelelik: sonuç her çalıştırmada aynı
let seed = 42
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

const TYPES = ['meaning', 'toEnglish', 'cloze', 'typing']
const made = Object.fromEntries(TYPES.map((t) => [t, 0]))
const problems = []
const samples = []

for (const oxford of loadOxford3000().words) {
  const info = describeWord({ wordId: oxford.id, word: oxford.word }, oxford)
  for (const type of TYPES) {
    const ex = buildExercise(type, info, pool, random)
    if (!ex) continue
    made[type]++
    if (type !== 'typing' && samples.length < 40 && random() < 0.02) samples.push(ex)

    if (type === 'typing') {
      if (checkTyped(ex, oxford.word).result !== 'ok') problems.push(`${oxford.id}: kendi yazımı kabul edilmedi`)
      continue
    }
    if (ex.options.length !== 4 || new Set(ex.options).size !== 4) problems.push(`${oxford.id} ${type}: seçenekler eksik ya da tekrarlı`)
    const inParens = (ex.options[ex.answer].match(/\(([^)]*)\)/g) || []).join(' ').toLowerCase()
    if (type === 'meaning' && inParens.split(/[^a-z]+/).includes(oxford.word.toLowerCase())) {
      problems.push(`${oxford.id} ${type}: cevap parantez içinde İngilizcesini içeriyor`)
    }
    ex.options.forEach((opt, i) => {
      if (i === ex.answer) return
      if (type === 'meaning') {
        // Ekranda görünen Türkçe metin, sorulan kelimenin hiçbir anlamıyla örtüşmemeli
        if (meaningsOverlap(unitsOf(oxford.id), meaningUnits(opt))) problems.push(`${oxford.id} meaning: "${opt}" doğru cevapla örtüşüyor`)
        return
      }
      // İngilizce seçenek: bu yazılışa sahip bütün kelimelerin anlamları sorulanla örtüşmemeli
      const same = pool.filter((w) => w.word.toLowerCase() === opt.toLowerCase())
      if (!same.length) return problems.push(`${oxford.id} ${type}: seçenek listede yok: ${opt}`)
      for (const w of same) {
        if (meaningsOverlap(unitsOf(oxford.id), unitsOf(w.id))) problems.push(`${oxford.id} ${type}: "${opt}" doğru cevapla örtüşüyor`)
      }
    })
  }
}

console.log('Üretilen sorular:', made, 'kelime sayısı:', pool.length)
console.log('Sorun:', problems.length)
problems.slice(0, 30).forEach((p) => console.log('  ' + p))

if (process.argv.includes('--samples')) {
  for (const ex of samples) {
    const shown = ex.type === 'cloze' ? `${ex.before}___${ex.after} (${ex.translation})` : ex.type === 'toEnglish' ? ex.meaning : ex.word
    console.log(`\n[${ex.type}] ${shown}`)
    ex.options.forEach((o, i) => console.log(`   ${i === ex.answer ? '✓' : ' '} ${o}`))
  }
}
if (problems.length) process.exitCode = 1
