import { useState, useEffect } from 'react'
import { getProgress, getProgressStats, getWeakWords } from '../../utils/vocabularyStorage'
import { calculateOverallProgress } from '../../utils/spacedRepetition'
import './ProgressTracker.css'

function ProgressTracker({ onBack, onStartFlashcards }) {
  const [stats, setStats] = useState(null)
  const [weakWords, setWeakWords] = useState([])
  const [levelBreakdown, setLevelBreakdown] = useState({})
  const [overallProgress, setOverallProgress] = useState(0)

  useEffect(() => {
    loadProgressData()
  }, [])

  const loadProgressData = () => {
    const progress = getProgress()
    const progressStats = getProgressStats()
    const weak = getWeakWords(10)
    const overall = calculateOverallProgress(progress)

    // Calculate level breakdown
    const breakdown = {}
    Object.values(progress.words || {}).forEach(word => {
      // We'd need to fetch word details to get cefrLevel
      // For now, just count by status
    })

    setStats(progressStats)
    setWeakWords(weak)
    setOverallProgress(overall)
    setLevelBreakdown(breakdown)
  }

  if (!stats) {
    return (
      <div className="progress-tracker">
        <div className="tracker-header">
          <button onClick={onBack} className="back-button">← Geri</button>
          <h2>📈 İlerleme Raporu</h2>
        </div>
        <div className="loading">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="progress-tracker">
      {/* Header */}
      <div className="tracker-header">
        <button onClick={onBack} className="back-button">← Geri</button>
        <h2>📈 İlerleme Raporu</h2>
      </div>

      {/* Overall Statistics */}
      <section className="tracker-section">
        <h3>📊 Genel İstatistikler</h3>
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-value">{stats.totalWordsStudied}</div>
            <div className="stat-label">Çalışılan Kelime</div>
          </div>

          <div className="stat-box">
            <div className="stat-value">{stats.statusCounts.mastered}</div>
            <div className="stat-label">Öğrenildi</div>
          </div>

          <div className="stat-box">
            <div className="stat-value">{stats.statusCounts.learning}</div>
            <div className="stat-label">Öğreniliyor</div>
          </div>

          <div className="stat-box">
            <div className="stat-value">{stats.statusCounts.reviewing}</div>
            <div className="stat-label">Gözden Geçiriliyor</div>
          </div>

          <div className="stat-box">
            <div className="stat-value">{stats.totalReviews}</div>
            <div className="stat-label">Toplam Tekrar</div>
          </div>

          <div className="stat-box">
            <div className="stat-value">{stats.dueForReview}</div>
            <div className="stat-label">Bugün Çalışılacak</div>
          </div>
        </div>
      </section>

      {/* Streak Info */}
      <section className="tracker-section">
        <h3>🔥 Çalışma Serisi</h3>
        <div className="streak-display">
          <div className="streak-number">{stats.currentStreak}</div>
          <div className="streak-label">Gün üst üste çalıştın!</div>
          {stats.lastStudyDate && (
            <p className="last-study">
              Son çalışma: {new Date(stats.lastStudyDate).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>
      </section>

      {/* Progress by Status */}
      <section className="tracker-section">
        <h3>📚 Durum Bazında İlerleme</h3>
        <div className="status-breakdown">
          <div className="status-item">
            <div className="status-header">
              <span className="status-icon">🆕</span>
              <span className="status-name">Yeni</span>
            </div>
            <div className="status-bar">
              <div
                className="status-fill new"
                style={{
                  width: `${(stats.statusCounts.new / Math.max(stats.totalWords, 1)) * 100}%`
                }}
              ></div>
            </div>
            <span className="status-count">{stats.statusCounts.new}</span>
          </div>

          <div className="status-item">
            <div className="status-header">
              <span className="status-icon">📖</span>
              <span className="status-name">Öğreniliyor</span>
            </div>
            <div className="status-bar">
              <div
                className="status-fill learning"
                style={{
                  width: `${(stats.statusCounts.learning / Math.max(stats.totalWords, 1)) * 100}%`
                }}
              ></div>
            </div>
            <span className="status-count">{stats.statusCounts.learning}</span>
          </div>

          <div className="status-item">
            <div className="status-header">
              <span className="status-icon">🔄</span>
              <span className="status-name">Gözden Geçiriliyor</span>
            </div>
            <div className="status-bar">
              <div
                className="status-fill reviewing"
                style={{
                  width: `${(stats.statusCounts.reviewing / Math.max(stats.totalWords, 1)) * 100}%`
                }}
              ></div>
            </div>
            <span className="status-count">{stats.statusCounts.reviewing}</span>
          </div>

          <div className="status-item">
            <div className="status-header">
              <span className="status-icon">⭐</span>
              <span className="status-name">Öğrenildi</span>
            </div>
            <div className="status-bar">
              <div
                className="status-fill mastered"
                style={{
                  width: `${(stats.statusCounts.mastered / Math.max(stats.totalWords, 1)) * 100}%`
                }}
              ></div>
            </div>
            <span className="status-count">{stats.statusCounts.mastered}</span>
          </div>
        </div>
      </section>

      {/* Overall Progress Circle */}
      <section className="tracker-section">
        <h3>🎯 Toplam İlerleme</h3>
        <div className="progress-circle-container">
          <div className="progress-circle">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" className="progress-circle-bg" />
              <circle
                cx="50"
                cy="50"
                r="45"
                className="progress-circle-fill"
                style={{
                  strokeDasharray: `${overallProgress * 2.827}, 282.7`
                }}
              />
            </svg>
            <div className="progress-percentage">{overallProgress}%</div>
          </div>
          <p className="progress-description">
            {overallProgress < 25 && 'Harika bir başlangıç yaptın! Devam et.'}
            {overallProgress >= 25 && overallProgress < 50 && 'İyi gidiyorsun! Çalışmaya devam et.'}
            {overallProgress >= 50 && overallProgress < 75 && 'Mükemmel! Yarı yolu geçtin.'}
            {overallProgress >= 75 && overallProgress < 100 && 'Harika ilerleme! Az kaldı!'}
            {overallProgress === 100 && 'Tebrikler! Tüm kelimeleri öğrendin!'}
          </p>
        </div>
      </section>

      {/* Weak Words */}
      {weakWords.length > 0 && (
        <section className="tracker-section">
          <h3>🎯 Zayıf Kelimeler (Tekrar Et!)</h3>
          <p className="weak-words-description">
            Bu kelimelerde zorlanıyorsun. Tekrar etmek için flashcard çalışması önerilir.
          </p>
          <div className="weak-words-list">
            {weakWords.map((wordProgress, index) => {
              const accuracy = wordProgress.reviewCount > 0
                ? Math.round((wordProgress.correctCount / wordProgress.reviewCount) * 100)
                : 0

              return (
                <div key={wordProgress.wordId} className="weak-word-item">
                  <div className="weak-word-rank">{index + 1}</div>
                  <div className="weak-word-details">
                    <strong>{wordProgress.word}</strong>
                    <div className="weak-word-stats">
                      <span>Başarı: {accuracy}%</span>
                      <span>Yanlış: {wordProgress.incorrectCount}x</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => onStartFlashcards(weakWords)}
            className="practice-weak-button"
          >
            Bu Kelimeleri Çalış
          </button>
        </section>
      )}

      {/* Empty State */}
      {stats.totalWordsStudied === 0 && (
        <section className="tracker-section empty-state">
          <div className="empty-icon">📊</div>
          <h3>Henüz istatistik yok</h3>
          <p>Kelime çalışmaya başladığında ilerleme raporun burada görünecek.</p>
        </section>
      )}
    </div>
  )
}

export default ProgressTracker
