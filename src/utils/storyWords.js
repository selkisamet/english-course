// Hikaye ile kelime çalışması arasındaki bağ: bir hikayede hangi kelimelerin geçtiği,
// okumadan önce hangilerinin çalışılacağı ve hikayeden sonra hangilerinin sorulacağı.

import { cleanWord } from './format'
import { isNewWord } from './srs'
import { getProgress } from './vocabularyStorage'

const CONTENT_POS = new Set(['noun', 'verb', 'adjective', 'adverb'])
const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }

export const PREP_MAX = 5
export const PREP_MIN = 2
export const QUIZ_MAX = 5
export const QUIZ_MIN = 3

// "biraz (a bit)", "(get dressed: giyinmek)": parantezde kelimenin kendisini içeren İngilizce kalıp
const meaningFromPhrase = (token) =>
  (token.context || '').match(/\([^)]*\)/g)?.some((p) => p.toLowerCase().split(/[^a-z']+/).includes(token.lemma.toLowerCase())) ||
  false

/** Kelimenin ilerleme kaydındaki kimliği: listedeyse liste kimliği, değilse "story:lemma" */
export const entryIdOf = (token) => token.base?.wordId || `story:${token.lemma.toLowerCase()}`

/**
 * Hikayede çalışılabilecek kelimeler: isim, fiil, sıfat, zarf; her kelime bir kez, ilk geçtiği yerle.
 * Liste dışı kelimeler yalnızca Türkçe temel anlamı varsa alınır; özel adlar alınmaz.
 * Hikayedeki anlamı bir kalıptan gelen kelime alınmaz: işaretlemede bu durumda kalıp parantez
 * içinde yazılır ("bit" için "biraz (a bit)") ve kelimenin kendi anlamı ("parça") yanıltıcı olur.
 * @param {object} annotation  /api/stories/:id/annotations yanıtı
 * @param {ReturnType<import('./storyText').analyzeStoryText>} text
 */
export function storyWords(annotation, text) {
  const words = new Map()
  annotation.tokens.forEach((token, index) => {
    if (!token?.lemma || !CONTENT_POS.has(token.pos) || meaningFromPhrase(token)) return
    const offList = !token.base?.wordId
    if (offList && (!token.base?.translation || /^\p{Lu}/u.test(token.lemma))) return
    const wordId = entryIdOf(token)
    if (words.has(wordId)) return
    const sentenceIndex = text.sentenceIndexOf(index)
    words.set(wordId, {
      wordId,
      word: token.base?.word || token.lemma,
      level: token.base?.level || null,
      offList,
      index,
      // Kelime çalışmasında gösterilecek hikaye bağlamı (WordPanel'deki kayıtla aynı alanlar)
      context: {
        translation: token.context,
        base: token.base?.translation || null,
        pos: token.pos,
        note: token.note,
        surface: cleanWord(text.tokens[index] || ''),
        sentence: text.sentenceOf(index),
        sentenceTranslation: annotation.sentences[sentenceIndex]?.tr || ''
      }
    })
  })
  return [...words.values()]
}

const isStudied = (entry) => Boolean(entry) && !isNewWord(entry)

// Liste dışı kelime, hikayenin kendi seviyesinde sayılır (C1–C2 hikayelerinde çoğunlukla bunlar zor kelimelerdir)
const rankOf = (word, storyLevel) => (word.offList ? LEVEL_RANK[storyLevel] : LEVEL_RANK[word.level]) || 0

/** Okumadan önce çalışılacak kelimeler: henüz çalışılmamış, en zordan kolaya, en fazla 5 */
export function prepWords(words, storyLevel) {
  const progress = getProgress().words
  return words
    .filter((w) => !isStudied(progress[w.wordId]))
    .sort((a, b) => rankOf(b, storyLevel) - rankOf(a, storyLevel) || a.index - b.index)
    .slice(0, PREP_MAX)
}

/** Hikayede çalışılmış kelimelerin kimlikleri (metinde işaretlemek için) */
export function studiedIds(words) {
  const progress = getProgress().words
  return new Set(words.filter((w) => isStudied(progress[w.wordId])).map((w) => w.wordId))
}

/**
 * Hikaye sonundaki mini test: önce öğrencinin bu hikayede çalıştığı ya da kaydettiği kelimeler,
 * eksik kalırsa hikayenin zor kelimeleri. En az 3 kelime yoksa test önerilmez.
 */
export function quizWords(words, storyLevel) {
  const progress = getProgress().words
  const byRank = (a, b) => rankOf(b, storyLevel) - rankOf(a, storyLevel) || a.index - b.index
  const known = words.filter((w) => progress[w.wordId]).sort(byRank)
  const others = words.filter((w) => !progress[w.wordId]).sort(byRank)
  const picked = [...known, ...others].slice(0, QUIZ_MAX)
  return picked.length >= QUIZ_MIN ? picked : []
}

/** Kelime çalışması ekranına gönderilecek liste ve her kelimenin hikaye bağlamı */
export const toStudyState = (words) => ({
  queue: words.map(({ wordId, word }) => ({ wordId, word })),
  contexts: Object.fromEntries(words.map((w) => [w.wordId, w.context]))
})
