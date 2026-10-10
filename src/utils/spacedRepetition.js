// Kelime ilerlemesinin gösterimi için yardımcılar.
// Tekrar takvimi srs.js içinde (FSRS).

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
