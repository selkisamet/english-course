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
        verbForms: null,
        number: null,
        isModal: false,
        isAuxiliary: false,
        root: word,
        isNegative: false,
        isPast: false,
        isPresent: false,
        isFuture: false,
        isGerund: false,
        isParticiple: false
      }
    }

    // Part of Speech
    const pos = getPartOfSpeech(token)

    // Verb bilgileri
    const isVerb = pos === 'Verb'
    const tense = isVerb ? getTense(token) : null
    const verbForms = isVerb ? getVerbForms(word) : null

    // Number (Singular/Plural)
    const number = getNumber(token, pos)

    // Root form
    const root = getRoot(token, word)

    const analysis = {
      word,
      pos,
      tense,
      verbForms,
      number,
      isModal: isModal(word),
      isAuxiliary: isAuxiliary(word),
      root,
      isNegative: word.includes('not') || word.includes("n't"),
      isPast: tense === 'Past',
      isPresent: tense === 'Present',
      isFuture: tense === 'Future',
      isGerund: tense === 'Gerund (-ing)',
      isParticiple: tense === 'Participle'
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

function getVerbForms(word) {
  // Temel verb formları için basit kurallar
  const lowerWord = word.toLowerCase()

  // Düzensiz fiiller sözlüğü
  const irregularVerbs = {
    'go': { infinitive: 'go', pastTense: 'went', presentTense: 'goes', gerund: 'going', future: 'will go', presentContinuous: 'is going', pastContinuous: 'was going', presentPerfect: 'has gone', pastPerfect: 'had gone' },
    'went': { infinitive: 'go', pastTense: 'went', presentTense: 'goes', gerund: 'going', future: 'will go', presentContinuous: 'is going', pastContinuous: 'was going', presentPerfect: 'has gone', pastPerfect: 'had gone' },
    'goes': { infinitive: 'go', pastTense: 'went', presentTense: 'goes', gerund: 'going', future: 'will go', presentContinuous: 'is going', pastContinuous: 'was going', presentPerfect: 'has gone', pastPerfect: 'had gone' },
    'going': { infinitive: 'go', pastTense: 'went', presentTense: 'goes', gerund: 'going', future: 'will go', presentContinuous: 'is going', pastContinuous: 'was going', presentPerfect: 'has gone', pastPerfect: 'had gone' },
    'take': { infinitive: 'take', pastTense: 'took', presentTense: 'takes', gerund: 'taking', future: 'will take', presentContinuous: 'is taking', pastContinuous: 'was taking', presentPerfect: 'has taken', pastPerfect: 'had taken' },
    'takes': { infinitive: 'take', pastTense: 'took', presentTense: 'takes', gerund: 'taking', future: 'will take', presentContinuous: 'is taking', pastContinuous: 'was taking', presentPerfect: 'has taken', pastPerfect: 'had taken' },
    'took': { infinitive: 'take', pastTense: 'took', presentTense: 'takes', gerund: 'taking', future: 'will take', presentContinuous: 'is taking', pastContinuous: 'was taking', presentPerfect: 'has taken', pastPerfect: 'had taken' },
    'taking': { infinitive: 'take', pastTense: 'took', presentTense: 'takes', gerund: 'taking', future: 'will take', presentContinuous: 'is taking', pastContinuous: 'was taking', presentPerfect: 'has taken', pastPerfect: 'had taken' },
    'feel': { infinitive: 'feel', pastTense: 'felt', presentTense: 'feels', gerund: 'feeling', future: 'will feel', presentContinuous: 'is feeling', pastContinuous: 'was feeling', presentPerfect: 'has felt', pastPerfect: 'had felt' },
    'feels': { infinitive: 'feel', pastTense: 'felt', presentTense: 'feels', gerund: 'feeling', future: 'will feel', presentContinuous: 'is feeling', pastContinuous: 'was feeling', presentPerfect: 'has felt', pastPerfect: 'had felt' },
    'felt': { infinitive: 'feel', pastTense: 'felt', presentTense: 'feels', gerund: 'feeling', future: 'will feel', presentContinuous: 'is feeling', pastContinuous: 'was feeling', presentPerfect: 'has felt', pastPerfect: 'had felt' },
    'feeling': { infinitive: 'feel', pastTense: 'felt', presentTense: 'feels', gerund: 'feeling', future: 'will feel', presentContinuous: 'is feeling', pastContinuous: 'was feeling', presentPerfect: 'has felt', pastPerfect: 'had felt' },
    'live': { infinitive: 'live', pastTense: 'lived', presentTense: 'lives', gerund: 'living', future: 'will live', presentContinuous: 'is living', pastContinuous: 'was living', presentPerfect: 'has lived', pastPerfect: 'had lived' },
    'lives': { infinitive: 'live', pastTense: 'lived', presentTense: 'lives', gerund: 'living', future: 'will live', presentContinuous: 'is living', pastContinuous: 'was living', presentPerfect: 'has lived', pastPerfect: 'had lived' },
    'lived': { infinitive: 'live', pastTense: 'lived', presentTense: 'lives', gerund: 'living', future: 'will live', presentContinuous: 'is living', pastContinuous: 'was living', presentPerfect: 'has lived', pastPerfect: 'had lived' },
    'living': { infinitive: 'live', pastTense: 'lived', presentTense: 'lives', gerund: 'living', future: 'will live', presentContinuous: 'is living', pastContinuous: 'was living', presentPerfect: 'has lived', pastPerfect: 'had lived' }
  }

  // Düzensiz fiil kontrolü
  if (irregularVerbs[lowerWord]) {
    return irregularVerbs[lowerWord]
  }

  // Düzenli fiiller için kurallar
  let infinitive = lowerWord
  let pastTense = lowerWord
  let presentTense = lowerWord
  let gerund = lowerWord

  // -ing formundan infinitive'i bul
  if (lowerWord.endsWith('ing')) {
    infinitive = lowerWord.slice(0, -3)
    // Çift ünsüz kontrolü (running -> run)
    if (infinitive.length > 1 && infinitive[infinitive.length - 1] === infinitive[infinitive.length - 2]) {
      infinitive = infinitive.slice(0, -1)
    }
    gerund = lowerWord
    pastTense = infinitive + 'ed'
    presentTense = infinitive + 's'
  }
  // -ed formundan infinitive'i bul
  else if (lowerWord.endsWith('ed')) {
    infinitive = lowerWord.slice(0, -2)
    if (infinitive.endsWith('i')) {
      infinitive = infinitive.slice(0, -1) + 'y'
    }
    pastTense = lowerWord
    gerund = infinitive + 'ing'
    presentTense = infinitive + 's'
  }
  // -s/-es formundan infinitive'i bul
  else if (lowerWord.endsWith('es')) {
    infinitive = lowerWord.slice(0, -2)
    presentTense = lowerWord
    pastTense = infinitive + 'ed'
    gerund = infinitive + 'ing'
  }
  else if (lowerWord.endsWith('s') && !lowerWord.endsWith('ss')) {
    infinitive = lowerWord.slice(0, -1)
    presentTense = lowerWord
    pastTense = infinitive + 'ed'
    gerund = infinitive + 'ing'
  }
  // Temel form
  else {
    infinitive = lowerWord
    pastTense = lowerWord + 'ed'
    presentTense = lowerWord + 's'
    gerund = lowerWord + 'ing'
  }

  return {
    infinitive,
    pastTense,
    presentTense,
    gerund,
    // Ek formlar
    future: 'will ' + infinitive,
    presentContinuous: 'is ' + gerund,
    pastContinuous: 'was ' + gerund,
    presentPerfect: 'has ' + pastTense,
    pastPerfect: 'had ' + pastTense
  }
}

function getNumber(token, pos) {
  if (pos !== 'Noun') return null

  const word = token.out()
  const lemma = token.out(nlp.its.lemma)

  // Eğer kelime lemma'dan farklıysa ve -s ile bitiyorsa genellikle çoğuldur
  if (word !== lemma && word.endsWith('s')) {
    return 'Plural'
  }

  return 'Singular'
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
