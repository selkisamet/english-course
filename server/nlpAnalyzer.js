import winkNLP from 'wink-nlp'
import model from 'wink-eng-lite-web-model'

// Wink-NLP instance oluştur
const nlp = winkNLP(model)

export function analyzeWord(word) {
  try {
    // Kelimeyi analiz et
    const doc = nlp.readDoc(word)

    // İlk token'ı al (çoğu zaman tek kelime)
    const token = doc.tokens().itemAt(0)

    if (!token) {
      return {
        word,
        pos: 'Unknown',
        tense: null,
        isModal: false,
        isAuxiliary: false,
        root: word
      }
    }

    // Part of Speech
    const pos = getPartOfSpeech(token)

    // Verb bilgileri
    const isVerb = pos === 'Verb'
    const tense = isVerb ? getTense(token) : null

    // Root form
    const root = getRoot(token, word)

    const analysis = {
      word,
      pos,
      tense,
      isModal: isModal(word),
      isAuxiliary: isAuxiliary(word),
      root
    }

    return analysis
  } catch (error) {
    console.error('NLP analysis error:', error)
    return {
      word,
      pos: 'Unknown',
      error: error.message
    }
  }
}

function getPartOfSpeech(token) {
  const posTag = token.out(nlp.its.pos)

  // Wink-NLP POS etiketlerini basit kategorilere dönüştür
  const posMap = {
    'NOUN': 'Noun',
    'PROPN': 'Noun',
    'VERB': 'Verb',
    'ADJ': 'Adjective',
    'ADV': 'Adverb',
    'ADP': 'Preposition',
    'PRON': 'Pronoun',
    'DET': 'Determiner',
    'CONJ': 'Conjunction',
    'CCONJ': 'Conjunction',
    'SCONJ': 'Conjunction',
    'AUX': 'Verb',
    'PART': 'Particle',
    'NUM': 'Number',
    'INTJ': 'Interjection'
  }

  return posMap[posTag] || 'Unknown'
}

function getTense(token) {
  const word = token.out()
  const lemma = token.out(nlp.its.lemma)

  // -ing ile biten kelimeler
  if (word.endsWith('ing') && word !== lemma) {
    return 'Gerund (-ing)'
  }

  // -ed ile biten kelimeler (düzenli geçmiş zaman)
  if (word.endsWith('ed') && word !== lemma) {
    return 'Past'
  }

  // Düzensiz geçmiş zaman fiilleri
  const irregularPast = ['went', 'took', 'had', 'was', 'were', 'did', 'said', 'got', 'made', 'came', 'saw', 'felt', 'knew', 'thought', 'found', 'gave', 'told', 'became', 'left', 'put', 'meant', 'kept', 'let', 'began', 'seemed', 'helped', 'showed', 'heard', 'played', 'ran', 'moved', 'lived', 'believed', 'brought', 'happened', 'wrote', 'sat', 'stood', 'lost', 'paid', 'met', 'included', 'continued', 'set', 'learned', 'led', 'understood', 'watched', 'followed', 'stopped', 'created', 'spoke', 'read', 'spent', 'grew', 'opened', 'walked', 'won', 'taught', 'offered', 'remembered', 'considered', 'appeared', 'bought', 'waited', 'served', 'died', 'sent', 'built', 'stayed', 'fell', 'cut', 'reached', 'killed', 'raised', 'passed', 'sold', 'decided', 'returned', 'explained', 'hoped', 'developed', 'carried', 'broke', 'received', 'agreed', 'supported', 'hit', 'produced', 'ate', 'covered', 'caught', 'drew', 'chose', 'wore', 'cast', 'sought', 'arose', 'slept', 'bore', 'led', 'lay', 'rode', 'shot', 'sang', 'sank', 'sprang', 'stole', 'swam', 'threw', 'woke', 'froze', 'hung']

  if (irregularPast.includes(word.toLowerCase())) {
    return 'Past'
  }

  // Participle formları (-en, -ed son ekli)
  if ((word.endsWith('en') || word.endsWith('ed')) && word !== lemma) {
    return 'Participle'
  }

  // 3. tekil şahıs şimdiki zaman (-s, -es)
  if ((word.endsWith('s') || word.endsWith('es')) && word !== lemma && !word.endsWith('ss')) {
    return 'Present'
  }

  // Temel form
  if (word === lemma) {
    return 'Base form'
  }

  return 'Present'
}

function getRoot(token, word) {
  try {
    const lemma = token.out(nlp.its.lemma)
    return lemma || word
  } catch (error) {
    return word
  }
}

function isModal(word) {
  const modals = ['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would']
  return modals.includes(word.toLowerCase())
}

function isAuxiliary(word) {
  const auxiliaries = ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did']
  return auxiliaries.includes(word.toLowerCase())
}

// Context'ten cümleyi çıkarmak için yardımcı fonksiyon
export function extractSentence(word, fullText) {
  try {
    const doc = nlp.readDoc(fullText)
    const sentences = doc.sentences().out()

    // Kelimeyi içeren cümleyi bul
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(word.toLowerCase())) {
        return sentence
      }
    }

    return ''
  } catch (error) {
    return ''
  }
}
