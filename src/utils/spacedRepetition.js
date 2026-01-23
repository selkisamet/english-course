// Spaced Repetition Algorithm (SM-0 variant)
// Simple interval-based system for vocabulary learning

// Review intervals in days based on difficulty
const INTERVALS = {
  HARD: [1, 1, 3, 7, 14],           // Struggling words - more frequent reviews
  MEDIUM: [1, 3, 7, 14, 30],        // Normal progress
  EASY: [3, 7, 14, 30, 60, 90]      // Easy words - longer intervals
}

// Difficulty levels
export const DIFFICULTY = {
  HARD: 'hard',       // User doesn't know the word
  MEDIUM: 'medium',   // User finds it difficult but remembers
  EASY: 'easy'        // User knows the word well
}

/**
 * Calculate next review date based on word progress and difficulty rating
 * @param {Object} wordProgress - Current word progress object
 * @param {string} difficulty - Difficulty rating (hard/medium/easy)
 * @returns {string} ISO timestamp for next review
 */
export function calculateNextReview(wordProgress, difficulty) {
  const { reviewCount = 0 } = wordProgress

  let intervalDays

  // Select interval based on difficulty
  if (difficulty === DIFFICULTY.HARD) {
    const maxIndex = INTERVALS.HARD.length - 1
    intervalDays = INTERVALS.HARD[Math.min(reviewCount, maxIndex)]
  } else if (difficulty === DIFFICULTY.MEDIUM) {
    const maxIndex = INTERVALS.MEDIUM.length - 1
    intervalDays = INTERVALS.MEDIUM[Math.min(reviewCount, maxIndex)]
  } else { // EASY
    const maxIndex = INTERVALS.EASY.length - 1
    intervalDays = INTERVALS.EASY[Math.min(reviewCount, maxIndex)]
  }

  // Calculate next review date
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + intervalDays)

  return nextReview.toISOString()
}

/**
 * Update word progress after a review session
 * @param {Object} wordProgress - Current word progress
 * @param {string} difficulty - How difficult the user found it
 * @returns {Object} Updated word progress
 */
export function updateWordProgress(wordProgress, difficulty) {
  const now = new Date().toISOString()

  const reviewCount = (wordProgress.reviewCount || 0) + 1
  const correctCount = difficulty !== DIFFICULTY.HARD
    ? (wordProgress.correctCount || 0) + 1
    : (wordProgress.correctCount || 0)

  const incorrectCount = difficulty === DIFFICULTY.HARD
    ? (wordProgress.incorrectCount || 0) + 1
    : (wordProgress.incorrectCount || 0)

  // Calculate recognition score (0-100)
  const recognitionScore = calculateRecognitionScore({
    ...wordProgress,
    reviewCount,
    correctCount,
    incorrectCount
  }, difficulty)

  // Determine status based on performance
  const status = determineWordStatus({
    ...wordProgress,
    reviewCount,
    recognitionScore
  })

  // Calculate confidence level (0-5)
  const confidenceLevel = calculateConfidenceLevel(recognitionScore, reviewCount)

  return {
    ...wordProgress,
    lastReviewed: now,
    nextReview: calculateNextReview({ reviewCount }, difficulty),
    reviewCount,
    correctCount,
    incorrectCount,
    recognitionScore,
    status,
    confidenceLevel
  }
}

/**
 * Calculate recognition score (0-100) based on performance
 * @param {Object} wordProgress - Word progress with stats
 * @param {string} currentDifficulty - Current review difficulty
 * @returns {number} Score from 0-100
 */
function calculateRecognitionScore(wordProgress, currentDifficulty) {
  const { correctCount = 0, reviewCount = 1, recognitionScore = 0 } = wordProgress

  // Base accuracy percentage
  const accuracy = (correctCount / Math.max(reviewCount, 1)) * 100

  // Apply bonus/penalty based on current performance
  let adjustment = 0
  if (currentDifficulty === DIFFICULTY.EASY && accuracy > 70) {
    adjustment = 5 // Bonus for consistent easy answers
  } else if (currentDifficulty === DIFFICULTY.HARD) {
    adjustment = -10 // Penalty for struggling
  }

  // Calculate new score (weighted average with adjustment)
  const newScore = Math.min(100, Math.max(0, accuracy + adjustment))

  // Smooth transition (70% old score, 30% new score) to avoid dramatic swings
  const smoothedScore = recognitionScore * 0.7 + newScore * 0.3

  return Math.round(smoothedScore)
}

/**
 * Determine word status based on performance
 * @param {Object} wordProgress - Word progress object
 * @returns {string} Status: new/learning/reviewing/mastered
 */
function determineWordStatus(wordProgress) {
  const { reviewCount = 0, recognitionScore = 0 } = wordProgress

  if (reviewCount === 0) {
    return 'new'
  }

  if (recognitionScore >= 95 && reviewCount >= 5) {
    return 'mastered'
  }

  if (recognitionScore >= 80) {
    return 'reviewing'
  }

  return 'learning'
}

/**
 * Calculate confidence level (0-5 stars)
 * @param {number} recognitionScore - Current recognition score
 * @param {number} reviewCount - Number of reviews
 * @returns {number} Confidence level 0-5
 */
function calculateConfidenceLevel(recognitionScore, reviewCount) {
  // Need minimum reviews for higher confidence
  if (reviewCount < 2) return 0
  if (reviewCount < 4 && recognitionScore < 50) return 1

  // Map score to 0-5 scale
  if (recognitionScore >= 95) return 5
  if (recognitionScore >= 85) return 4
  if (recognitionScore >= 70) return 3
  if (recognitionScore >= 50) return 2
  return 1
}

/**
 * Get words due for review today
 * @param {Object} allProgress - All vocabulary progress
 * @returns {Array} Words that need review
 */
export function getWordsDueToday(allProgress) {
  const today = new Date().toISOString().split('T')[0]

  return Object.values(allProgress.words || {}).filter(word => {
    if (!word.nextReview) return false

    const dueDate = new Date(word.nextReview).toISOString().split('T')[0]
    return dueDate <= today
  })
}

/**
 * Get recommended study count for today
 * @param {Object} allProgress - All vocabulary progress
 * @returns {number} Recommended number of words to study
 */
export function getRecommendedStudyCount(allProgress) {
  const dueWords = getWordsDueToday(allProgress)
  const newWords = Object.values(allProgress.words || {}).filter(w => w.status === 'new').length

  // Review due words + add 5-10 new words if there's capacity
  const dueCount = dueWords.length
  const newWordsToAdd = Math.min(newWords, Math.max(0, 20 - dueCount))

  return dueCount + newWordsToAdd
}

/**
 * Get optimal next words to study (mix of due + new)
 * @param {Object} allProgress - All vocabulary progress
 * @param {number} count - Number of words to get
 * @returns {Array} Word IDs to study
 */
export function getNextWordsToStudy(allProgress, count = 20) {
  const dueWords = getWordsDueToday(allProgress)
  const newWords = Object.values(allProgress.words || {})
    .filter(w => w.status === 'new')
    .slice(0, Math.max(0, count - dueWords.length))

  return [...dueWords, ...newWords].slice(0, count)
}

/**
 * Calculate overall progress percentage
 * @param {Object} allProgress - All vocabulary progress
 * @returns {number} Progress percentage (0-100)
 */
export function calculateOverallProgress(allProgress) {
  const words = Object.values(allProgress.words || {})
  if (words.length === 0) return 0

  const masteredCount = words.filter(w => w.status === 'mastered').length
  const reviewingCount = words.filter(w => w.status === 'reviewing').length

  // Mastered = 100%, Reviewing = 75%, Learning = 40%, New = 0%
  const totalScore = words.reduce((sum, word) => {
    if (word.status === 'mastered') return sum + 100
    if (word.status === 'reviewing') return sum + 75
    if (word.status === 'learning') return sum + 40
    return sum
  }, 0)

  return Math.round(totalScore / words.length)
}

/**
 * Get interval description for display
 * @param {number} days - Number of days
 * @returns {string} Human-readable interval
 */
export function getIntervalDescription(days) {
  if (days === 0) return 'Bugün'
  if (days === 1) return 'Yarın'
  if (days < 7) return `${days} gün sonra`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${weeks} hafta sonra`
  }
  const months = Math.floor(days / 30)
  return `${months} ay sonra`
}

/**
 * Get time until next review
 * @param {string} nextReviewISO - Next review date in ISO format
 * @returns {Object} { days, hours, isPast, description }
 */
export function getTimeUntilReview(nextReviewISO) {
  const now = new Date()
  const nextReview = new Date(nextReviewISO)
  const diffMs = nextReview - now
  const isPast = diffMs < 0

  const diffDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24))
  const diffHours = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60))

  let description
  if (isPast) {
    description = 'Şimdi çalış!'
  } else if (diffHours < 24) {
    description = `${diffHours} saat sonra`
  } else {
    description = getIntervalDescription(diffDays)
  }

  return {
    days: diffDays,
    hours: diffHours,
    isPast,
    description
  }
}
