// localStorage manager for vocabulary progress

const STORAGE_KEY = 'vocabularyProgress'
const STORAGE_VERSION = '1.0'

// Initialize progress structure
export function initializeProgress() {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) {
    try {
      return JSON.parse(existing)
    } catch (error) {
      console.error('Failed to parse vocabulary progress:', error)
    }
  }

  const initial = {
    version: STORAGE_VERSION,
    userId: `local-user-${Date.now()}`,
    words: {},
    stats: {
      totalWordsStudied: 0,
      totalReviews: 0,
      currentStreak: 0,
      lastStudyDate: null
    }
  }

  saveProgress(initial)
  return initial
}

// Save progress to localStorage
export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch (error) {
    console.error('Failed to save vocabulary progress:', error)
    throw error
  }
}

// Get all progress data
export function getProgress() {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) {
    return initializeProgress()
  }

  try {
    const progress = JSON.parse(data)

    // Version check
    if (progress.version !== STORAGE_VERSION) {
      console.warn('Progress version mismatch, migrating...')
      return migrateProgress(progress)
    }

    return progress
  } catch (error) {
    console.error('Failed to get progress:', error)
    return initializeProgress()
  }
}

// Get progress for a specific word
export function getWordProgress(wordId) {
  const progress = getProgress()
  return progress.words[wordId] || null
}

// Create new word progress entry
export function createNewWordProgress(wordId, word) {
  return {
    wordId,
    word,
    status: 'new',
    firstSeen: new Date().toISOString(),
    lastReviewed: null,
    nextReview: new Date().toISOString(), // Due immediately
    recognitionScore: 0,
    productionScore: 0,
    reviewCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    confidenceLevel: 0
  }
}

// Update word progress
export function updateWordProgress(wordId, word, updates) {
  const progress = getProgress()

  if (!progress.words[wordId]) {
    progress.words[wordId] = createNewWordProgress(wordId, word)
  }

  progress.words[wordId] = {
    ...progress.words[wordId],
    ...updates
  }

  // Update global stats
  updateGlobalStats(progress)

  saveProgress(progress)
  return progress.words[wordId]
}

// Update global statistics
function updateGlobalStats(progress) {
  const words = Object.values(progress.words)

  progress.stats.totalWordsStudied = words.filter(w => w.reviewCount > 0).length
  progress.stats.totalReviews = words.reduce((sum, w) => sum + w.reviewCount, 0)

  // Calculate streak
  const lastStudyDate = progress.stats.lastStudyDate
  const today = new Date().toISOString().split('T')[0]

  if (lastStudyDate) {
    const lastDate = new Date(lastStudyDate).toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    if (lastDate === today) {
      // Already studied today, keep streak
    } else if (lastDate === yesterday) {
      // Studied yesterday, increment streak
      progress.stats.currentStreak += 1
      progress.stats.lastStudyDate = new Date().toISOString()
    } else {
      // Streak broken
      progress.stats.currentStreak = 1
      progress.stats.lastStudyDate = new Date().toISOString()
    }
  } else {
    // First study session
    progress.stats.currentStreak = 1
    progress.stats.lastStudyDate = new Date().toISOString()
  }
}

// Get words by status
export function getWordsByStatus(status) {
  const progress = getProgress()
  return Object.values(progress.words).filter(w => w.status === status)
}

// Get words due for review
export function getWordsDueForReview() {
  const progress = getProgress()
  const now = new Date().toISOString()

  return Object.values(progress.words).filter(word => {
    return word.nextReview && word.nextReview <= now
  })
}

// Get weak words (high incorrect count)
export function getWeakWords(limit = 10) {
  const progress = getProgress()
  const words = Object.values(progress.words)

  return words
    .filter(w => w.reviewCount > 0)
    .sort((a, b) => {
      const aRatio = a.incorrectCount / Math.max(a.reviewCount, 1)
      const bRatio = b.incorrectCount / Math.max(b.reviewCount, 1)
      return bRatio - aRatio
    })
    .slice(0, limit)
}

// Get progress statistics
export function getProgressStats() {
  const progress = getProgress()
  const words = Object.values(progress.words)

  const statusCounts = {
    new: words.filter(w => w.status === 'new').length,
    learning: words.filter(w => w.status === 'learning').length,
    reviewing: words.filter(w => w.status === 'reviewing').length,
    mastered: words.filter(w => w.status === 'mastered').length
  }

  const levelCounts = {}

  return {
    ...progress.stats,
    statusCounts,
    levelCounts,
    totalWords: words.length,
    dueForReview: getWordsDueForReview().length
  }
}

// Export progress to JSON file
export function exportProgress() {
  const progress = getProgress()
  const json = JSON.stringify(progress, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vocabulary-progress-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Import progress from JSON file
export function importProgress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)

        if (data.version === STORAGE_VERSION) {
          saveProgress(data)
          resolve(data)
        } else {
          reject(new Error('Incompatible progress file version'))
        }
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

// Reset all progress (with confirmation)
export function resetProgress() {
  if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY)
    return initializeProgress()
  }
  return getProgress()
}

// Migrate progress from old version (future-proofing)
function migrateProgress(oldProgress) {
  console.log('Migrating progress data...')

  // For now, just update version
  const migrated = {
    ...oldProgress,
    version: STORAGE_VERSION
  }

  saveProgress(migrated)
  return migrated
}

// Debug: Get storage size
export function getStorageSize() {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return 0

  // Size in bytes
  const bytes = new Blob([data]).size
  const kb = (bytes / 1024).toFixed(2)

  return { bytes, kb }
}
