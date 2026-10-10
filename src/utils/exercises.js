// Kelime çalışmasındaki soruları üretir: seçenekler, boşluk doldurma ve yazılı cevap kontrolü.
//
// Temel kural: yanlış seçeneklerden hiçbiri doğru cevap olamaz. Bu yüzden bir kelime ancak
// Türkçe anlamlarından hiçbiri sorulan kelimenin anlamlarıyla örtüşmüyorsa seçenek olur
// ("big" sorulurken anlamı da "büyük" olan "large" seçenek olmaz).

const lower = (s) => s.toLocaleLowerCase('tr-TR')

/** "eylem, davranış; (tiyatro) perde" → ["eylem", "davranış", "perde"] */
export function meaningUnits(translation) {
  return lower(translation || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/[;,/]/)
    .map((u) => u.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const unitsCache = new WeakMap()
const unitsOfWord = (word) => {
  if (!unitsCache.has(word)) unitsCache.set(word, word.senses.flatMap((s) => meaningUnits(s.translation)))
  return unitsCache.get(word)
}

const containsWord = (text, part) => ` ${text} `.includes(` ${part} `)

/** İki anlam kümesi örtüşüyor mu ("büyük" ile "çok büyük" de örtüşür sayılır) */
export function meaningsOverlap(a, b) {
  return a.some((x) => b.some((y) => x === y || containsWord(x, y) || containsWord(y, x)))
}

// Parantez içinde kelimenin kendisini içeren İngilizce kalıp: "(be able to)", "(a lot of)"
const phraseParens = (word, translation) =>
  (translation.match(/\([^)]*\)/g) || []).filter((p) =>
    lower(p).split(/[^a-z'-]+/).includes(lower(word.word))
  )

// "(be able to) -ebilmek", "doğmak (be born)": anlam kelimenin kendisine değil bir kalıba ait
const isPhraseSense = (word, sense) => phraseParens(word, sense.translation).length > 0

/** Gösterilecek anlam: cevabı ele veren İngilizce kalıp parantezleri çıkarılır */
const withoutPhrase = (word, translation) =>
  phraseParens(word, translation)
    .reduce((t, p) => t.replace(p, ' '), translation)
    .replace(/\s+([,;])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

/** Soruda gösterilecek anlam: kalıba ait olmayan ilk anlam */
export function mainSense(word) {
  return word.senses.find((s) => !isPhraseSense(word, s)) || word.senses[0]
}

/** Seçenekte gösterilecek kısa anlam: "eylem, davranış; perde" → "eylem, davranış" */
export const shortMeaning = (translation) => (translation || '').split(';')[0].trim()

// ---------- Rastgelelik (testte sabitlenebilir) ----------

export function shuffle(items, random = Math.random) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2']
const levelGap = (a, b) => Math.abs(LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))

/**
 * Yanlış seçenek olabilecek kelimeler: aynı türden, anlamı örtüşmeyen, mümkünse yakın seviyeden.
 * @param {string[]} answerUnits doğru cevabın bütün anlamları
 * @param {(w:object)=>string} label seçenekte görünecek metin
 */
function pickDistractors({ pool, excludeIds, answerUnits, pos, level, label, answerLabel, count = 3, random }) {
  const taken = new Set([lower(answerLabel)])
  const candidates = shuffle(pool, random)
  // Önce aynı tür ve yakın seviye, sonra aynı tür, en son herhangi biri
  const tiers = [
    (w) => mainSense(w).pos === pos && (!level || levelGap(w.level, level) <= 1),
    (w) => mainSense(w).pos === pos,
    () => true
  ]
  const picked = []
  const pickedUnits = []
  for (const inTier of tiers) {
    for (const w of candidates) {
      if (picked.length === count) return picked
      if (excludeIds.has(w.id) || isPhraseSense(w, mainSense(w)) || !inTier(w)) continue
      if (meaningsOverlap(answerUnits, unitsOfWord(w))) continue
      const text = label(w)
      const units = unitsOfWord(w)
      // Seçenekler birbirinin aynısı ya da eş anlamlısı olmasın
      if (!text || taken.has(lower(text)) || pickedUnits.some((u) => meaningsOverlap(u, units))) continue
      taken.add(lower(text))
      pickedUnits.push(units)
      picked.push(text)
    }
  }
  return picked.length === count ? picked : null
}

const withAnswer = (answer, distractors, random) => {
  const options = shuffle([answer, ...distractors], random)
  return { options, answer: options.indexOf(answer) }
}

// ---------- Soru türleri ----------

/**
 * Çalışılan kelimenin soru üretmek için gereken bilgisi.
 * @param {object} entry   kullanıcının kaydı (hikayeden kaydedildiyse bağlamı da içerir)
 * @param {object|null} oxford  kelime listesindeki kaydı (listede yoksa null)
 */
export function describeWord(entry, oxford) {
  const sense = oxford ? mainSense(oxford) : null
  // Anlamı yalnızca bir kalıp için verilmiş kelime ("(be able to) -ebilmek"): parantezdeki
  // İngilizce cevabı ele verir, o yüzden gizlenir ve İngilizcesini soran türler sorulmaz
  const phraseOnly = Boolean(oxford && isPhraseSense(oxford, sense))
  const listMeaning = sense && withoutPhrase(oxford, sense.translation)
  // Hikayede karşılaşılan anlamın temel karşılığı varsa onu sor; yoksa listedeki ilk anlamı
  const meaning = entry.base || listMeaning || entry.translation || ''
  return {
    phraseOnly,
    wordId: entry.wordId,
    word: oxford?.word || entry.word,
    pos: entry.pos || sense?.pos || '',
    level: oxford?.level || null,
    meaning,
    units: oxford ? unitsOfWord(oxford) : meaningUnits(meaning),
    inOxford: Boolean(oxford),
    example: entry.sentence
      ? { text: entry.sentence, tr: entry.sentenceTranslation, form: entry.surface }
      : sense?.example
        ? { text: sense.example, tr: sense.exampleTranslation, form: oxford.word }
        : null
  }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Cümlede kelimenin birebir geçtiği yer; yoksa null (boşluk doldurma sorulmaz) */
export function findInSentence(sentence, form) {
  if (!sentence || !form) return null
  const m = new RegExp(`(^|[^\\p{L}'’-])(${escapeRe(form)})(?=$|[^\\p{L}'’-])`, 'iu').exec(sentence)
  if (!m) return null
  const start = m.index + m[1].length
  return { before: sentence.slice(0, start), match: m[2], after: sentence.slice(start + m[2].length) }
}

/**
 * Bir kelime için istenen türde soru üretir. Üretilemezse (ör. yeterli güvenli seçenek yok,
 * cümlede kelime birebir geçmiyor) null döner; çağıran başka bir türe geçer.
 */
export function buildExercise(type, info, pool, random = Math.random) {
  const excludeIds = new Set([info.wordId])
  const base = { type, wordId: info.wordId, word: info.word, pos: info.pos, meaning: info.meaning, example: info.example }

  if (type === 'meaning' || type === 'listen') {
    const distractors = pickDistractors({
      pool, excludeIds, answerUnits: info.units, pos: info.pos, level: info.level,
      label: (w) => shortMeaning(mainSense(w).translation), answerLabel: shortMeaning(info.meaning), random
    })
    return distractors && info.meaning ? { ...base, ...withAnswer(shortMeaning(info.meaning), distractors, random) } : null
  }

  if (type === 'toEnglish') {
    if (!info.inOxford || info.phraseOnly) return null
    const distractors = pickDistractors({
      pool, excludeIds, answerUnits: info.units, pos: info.pos, level: info.level,
      label: (w) => w.word, answerLabel: info.word, random
    })
    return distractors ? { ...base, ...withAnswer(info.word, distractors, random) } : null
  }

  if (type === 'cloze') {
    const found = info.example && findInSentence(info.example.text, info.example.form)
    // Birden çok kelimelik cevapta tek kelimelik seçenekler cevabı ele verir
    if (!found || /\s/.test(found.match)) return null
    const answer = found.match
    // Seçenekler cümledeki biçimle aynı yazılsın (büyük harfle başlıyorsa onlar da)
    const capital = /^\p{Lu}/u.test(answer)
    const style = (w) => (capital ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    const distractors = pickDistractors({
      pool, excludeIds, answerUnits: info.units, pos: info.pos, level: info.level,
      label: (w) => (/\s/.test(w.word) ? null : style(w.word)), answerLabel: answer, random
    })
    if (!distractors) return null
    return { ...base, before: found.before, after: found.after, translation: info.example.tr, ...withAnswer(answer, distractors, random) }
  }

  if (type === 'typing') {
    if (!info.inOxford || info.phraseOnly || /[,]/.test(info.word)) return null
    // Aynı Türkçe anlama sahip başka bir kelime de doğru kabul edilir
    const promptUnits = meaningUnits(info.meaning)
    const alsoCorrect = pool
      .filter((w) => w.id !== info.wordId && unitsOfWord(w).some((u) => promptUnits.includes(u)))
      .map((w) => w.word)
    return { ...base, accepted: [info.word, ...alsoCorrect] }
  }

  return null
}

// ---------- Yazılı cevap ----------

export const normalizeAnswer = (s) =>
  s.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim()

// İngiliz ve Amerikan yazımları ikisi de doğru sayılır
const SPELLING_PAIRS = { grey: 'gray', tyre: 'tire', cheque: 'check', aluminium: 'aluminum', mum: 'mom', maths: 'math', pyjamas: 'pajamas', programme: 'program', practise: 'practice', licence: 'license', defence: 'defense', offence: 'offense', jewellery: 'jewelry', plough: 'plow', cosy: 'cozy', mould: 'mold', moustache: 'mustache', kerb: 'curb' }

export function spellingVariants(word) {
  const w = normalizeAnswer(word)
  const out = new Set([w])
  const add = (v) => v && out.add(v)
  add(SPELLING_PAIRS[w])
  for (const [uk, us] of Object.entries(SPELLING_PAIRS)) if (us === w) add(uk)
  add(w.replace(/our\b/g, 'or'))
  add(w.replace(/([^aeiou])re\b/g, '$1er'))
  add(w.replace(/ise\b/g, 'ize'))
  add(w.replace(/isation\b/g, 'ization'))
  add(w.replace(/yse\b/g, 'yze'))
  add(w.replace(/ogue\b/g, 'og'))
  return [...out]
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

/**
 * Yazılan cevabı değerlendirir.
 * @returns {{result:'ok'|'almost'|'bad', other?:string}} other: sorulandan farklı ama doğru kelime
 */
export function checkTyped(exercise, typed) {
  const t = normalizeAnswer(typed)
  if (!t) return { result: 'bad' }
  const [target, ...others] = exercise.accepted
  if (spellingVariants(target).includes(t)) return { result: 'ok' }
  const other = others.find((w) => spellingVariants(w).includes(t))
  if (other) return { result: 'ok', other }
  // Uzun kelimelerde tek harflik yazım hatası "neredeyse doğru" sayılır
  if (t.length >= 5 && spellingVariants(target).some((v) => editDistance(v, t) <= 1)) return { result: 'almost' }
  return { result: 'bad' }
}
