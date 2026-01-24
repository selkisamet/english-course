import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OXFORD_FILE = path.join(__dirname, '..', 'data', 'oxford3000.json')

// Very common basic words for A1 level
const A1_COMMON_WORDS = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'may', 'might', 'must', 'shall', 'should',
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'and', 'but', 'or', 'so', 'if', 'when', 'where', 'who', 'what', 'which', 'how', 'why',
  'not', 'no', 'yes', 'please', 'thank', 'hello', 'hi', 'bye', 'goodbye',
  'in', 'on', 'at', 'to', 'from', 'of', 'for', 'with', 'by', 'about', 'up', 'down', 'out',
  'go', 'come', 'get', 'make', 'take', 'see', 'know', 'think', 'look', 'want', 'give',
  'use', 'find', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave', 'call',
  'good', 'new', 'first', 'last', 'long', 'great', 'little', 'big', 'small', 'old', 'young',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'time', 'year', 'day', 'week', 'month', 'hour', 'minute', 'today', 'now', 'then',
  'man', 'woman', 'child', 'boy', 'girl', 'person', 'people', 'friend', 'family',
  'home', 'house', 'room', 'door', 'window', 'table', 'chair', 'bed',
  'food', 'water', 'eat', 'drink', 'book', 'read', 'write', 'name', 'number',
  'all', 'some', 'many', 'much', 'more', 'most', 'very', 'here', 'there', 'now',
  'say', 'said', 'part', 'place', 'back', 'put', 'hand', 'eye', 'head', 'right', 'left',
  'way', 'well', 'also', 'too', 'only', 'just', 'like', 'help', 'love', 'live'
])

// Common A2 words (basic but slightly more complex)
const A2_COMMON_WORDS = new Set([
  'because', 'before', 'after', 'again', 'during', 'between', 'under', 'over',
  'become', 'show', 'need', 'begin', 'bring', 'keep', 'mean', 'turn', 'follow',
  'different', 'important', 'possible', 'large', 'next', 'early', 'few', 'public',
  'same', 'bad', 'late', 'hard', 'real', 'best', 'better', 'sure', 'own', 'high',
  'thing', 'world', 'life', 'hand', 'part', 'place', 'case', 'week', 'number',
  'point', 'problem', 'fact', 'question', 'lot', 'right', 'money', 'business',
  'service', 'office', 'street', 'city', 'school', 'car', 'shop', 'store',
  'never', 'always', 'often', 'sometimes', 'once', 'still', 'however', 'really',
  'change', 'move', 'play', 'run', 'open', 'close', 'talk', 'speak', 'read',
  'learn', 'listen', 'watch', 'wait', 'stop', 'buy', 'sell', 'pay', 'cost'
])

function categorizeWord(word) {
  const text = word.word.toLowerCase()
  const length = text.length

  // A1: Very basic words
  if (A1_COMMON_WORDS.has(text)) {
    return 'A1'
  }

  // A1: Very short common words
  if (length <= 3 && word.frequency === 'high') {
    return 'A1'
  }

  // A2: Common basic words
  if (A2_COMMON_WORDS.has(text)) {
    return 'A2'
  }

  // A2: Short words with high frequency
  if (length <= 5 && word.frequency === 'high') {
    return 'A2'
  }

  // A2: Basic categories
  if (word.categories && (
    word.categories.includes('general') ||
    word.categories.includes('time') ||
    word.categories.includes('body')
  ) && length <= 6) {
    return 'A2'
  }

  // C2: Extremely long or very specialized words (14+ characters)
  if (length >= 14) {
    return 'C2'
  }

  // C1: Very long complex words (12-13 characters)
  if (length >= 12) {
    return 'C1'
  }

  // C1: Academic/specialized categories with medium-long words
  if (length >= 11 && word.categories && (
    word.categories.includes('science') ||
    word.categories.includes('technology')
  )) {
    return 'C1'
  }

  // B2: Long complex words (10-12 characters)
  if (length >= 10) {
    return 'B2'
  }

  // B2: Academic or professional categories
  if (word.categories && (
    word.categories.includes('technology') ||
    word.categories.includes('science') ||
    word.categories.includes('business')
  ) && length >= 8) {
    return 'B2'
  }

  // Default to B1 for remaining words
  return 'B1'
}

function redistributeWords() {
  console.log('📖 Reading oxford3000.json...')
  const data = JSON.parse(fs.readFileSync(OXFORD_FILE, 'utf8'))
  const words = data.words

  console.log(`📊 Total words: ${words.length}`)
  console.log('🔄 Categorizing words by CEFR level...\n')

  // Categorize each word
  const levelCounts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 }

  words.forEach(word => {
    const newLevel = categorizeWord(word)
    word.cefrLevel = newLevel
    levelCounts[newLevel]++
  })

  console.log('✅ Categorization complete!')
  console.log('\n📈 Distribution:')
  console.log(`   A1: ${levelCounts.A1} words`)
  console.log(`   A2: ${levelCounts.A2} words`)
  console.log(`   B1: ${levelCounts.B1} words`)
  console.log(`   B2: ${levelCounts.B2} words`)
  console.log(`   C1: ${levelCounts.C1} words`)
  console.log(`   Total: ${words.length} words\n`)

  // Save updated data
  console.log('💾 Saving updated oxford3000.json...')
  fs.writeFileSync(OXFORD_FILE, JSON.stringify(data, null, 2), 'utf8')
  console.log('✅ Done! Words have been redistributed across CEFR levels.')
}

redistributeWords()