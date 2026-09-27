export const capitalize = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : ''

// Türkçe metin: tamamı büyük harfse düzelt, baş harfi Türkçe kuralla büyüt
export const formatTr = (text) => {
  if (!text) return ''
  const t = text.trim()
  const normalized = /[A-ZÇĞİÖŞÜ]{2}/.test(t) && t === t.toLocaleUpperCase('tr') ? t.toLocaleLowerCase('tr') : t
  return normalized.charAt(0).toLocaleUpperCase('tr') + normalized.slice(1)
}

export const cleanWord = (token) =>
  token.replace(/[^A-Za-z'’-]/g, '').replace(/^['’-]+|['’-]+$/g, '')

const POS_TR = {
  noun: 'İsim',
  verb: 'Fiil',
  adjective: 'Sıfat',
  adverb: 'Zarf',
  pronoun: 'Zamir',
  preposition: 'Edat',
  adposition: 'Edat',
  conjunction: 'Bağlaç',
  interjection: 'Ünlem',
  exclamation: 'Ünlem',
  determiner: 'Belirteç',
  modal: 'Modal fiil',
  'modal verb': 'Modal fiil',
  'auxiliary verb': 'Yardımcı fiil',
  'definite article': 'Belirli tanımlık',
  'indefinite article': 'Belirsiz tanımlık',
  'infinitive marker': 'Mastar eki',
  'proper noun': 'Özel isim',
  number: 'Sayı',
  unknown: 'Bilinmiyor'
}

export const translatePOS = (pos) => {
  if (!pos) return ''
  return pos
    .split(',')
    .map((p) => POS_TR[p.trim().toLowerCase()] || capitalize(p.trim()))
    .join(', ')
}

const TENSE_TR = {
  past: 'Geçmiş zaman',
  present: 'Geniş / şimdiki zaman',
  future: 'Gelecek zaman',
  'gerund (-ing)': '-ing hali',
  gerund: '-ing hali',
  participle: 'Ortaç',
  'base form': 'Yalın hal'
}

export const translateTense = (tense) =>
  TENSE_TR[tense?.toLowerCase()] || tense

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export const LEVEL_NAMES = {
  A1: 'Başlangıç',
  A2: 'Temel',
  B1: 'Orta',
  B2: 'Orta üstü',
  C1: 'İleri',
  C2: 'Uzman'
}

export const readingMinutes = (text) =>
  Math.max(1, Math.round(text.split(/\s+/).length / 130))

export const wordCount = (text) => text.split(/\s+/).filter(Boolean).length

// server/storyText.js ile aynı kural: hikaye işaretlemeleri bu bölmeye göre yapılır
const ABBREVIATIONS = /\b(Mr|Mrs|Ms|Dr|St|Prof|Jr|Sr)\.(?=\s)/g

export const splitSentences = (text) => {
  const masked = text.replace(ABBREVIATIONS, (m) => m.replace('.', '\u0000'))
  const parts = masked.match(/[^.!?]+[.!?]+["”’']?|[^.!?]+$/g) || [masked]
  return parts.map((s) => s.replace(/\u0000/g, '.').trim()).filter(Boolean)
}

export const STATUS_LABELS = {
  new: 'Yeni',
  learning: 'Öğreniliyor',
  reviewing: 'Pekişiyor',
  mastered: 'Öğrenildi'
}

// Sunucudaki server/scripts/buildVocabulary.js ile aynı kural
export const slugify = (word) =>
  word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Kelime listesi (Oxford 3000) A1–B2 aralığını kapsar
export const VOCAB_LEVELS = ['A1', 'A2', 'B1', 'B2']
