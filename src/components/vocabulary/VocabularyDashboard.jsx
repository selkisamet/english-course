import { useState, useEffect } from 'react'
import { getProgress, getProgressStats, getWordsDueForReview } from '../../utils/vocabularyStorage'
import { calculateOverallProgress } from '../../utils/spacedRepetition'
import './VocabularyDashboard.css'

function VocabularyDashboard({ onNavigate, onStartFlashcards }) {
  const [stats, setStats] = useState(null)
  const [dueWords, setDueWords] = useState([])
  const [overallProgress, setOverallProgress] = useState(0)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = () => {
    const progress = getProgress()
    const progressStats = getProgressStats()
    const wordsDue = getWordsDueForReview()
    const overall = calculateOverallProgress(progress)

    setStats(progressStats)
    setDueWords(wordsDue)
    setOverallProgress(overall)
  }

  if (!stats) {
    return <div className="dashboard-loading">Yükleniyor...</div>
  }

  return (
    <div className="vocabulary-dashboard">
      {/* Progress Summary */}
      <section className="progress-summary">
        <h2>📊 İlerleme Özeti</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.statusCounts.new}</div>
            <div className="stat-label">Yeni Kelime</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{stats.statusCounts.learning}</div>
            <div className="stat-label">Öğreniliyor</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{stats.currentStreak}</div>
            <div className="stat-label">Gün Serisi</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{overallProgress}%</div>
            <div className="stat-label">Toplam İlerleme</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="overall-progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${overallProgress}%` }}
          ></div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="quick-actions">
        <h2>🎯 Hızlı İşlemler</h2>
        <div className="action-buttons">
          <button
            className="action-button primary"
            onClick={() => {
              if (dueWords.length > 0) {
                onStartFlashcards(dueWords)
              } else {
                alert('Şu an tekrar edilecek kelime yok. Kelime listesinden yeni kelimeler ekleyin!')
              }
            }}
          >
            <span className="button-icon">🎴</span>
            <span className="button-text">
              <strong>Flashcard Çalış</strong>
              <small>{dueWords.length} kelime hazır</small>
            </span>
          </button>

          <button
            className="action-button secondary"
            onClick={() => onNavigate('wordlist')}
          >
            <span className="button-icon">📖</span>
            <span className="button-text">
              <strong>Kelime Listesi</strong>
              <small>Kelimeleri incele</small>
            </span>
          </button>

          <button
            className="action-button secondary"
            onClick={() => onNavigate('progress')}
          >
            <span className="button-icon">📈</span>
            <span className="button-text">
              <strong>İlerleme Detayı</strong>
              <small>İstatistikleri gör</small>
            </span>
          </button>
        </div>
      </section>

      {/* Words Due for Review */}
      {dueWords.length > 0 && (
        <section className="due-words">
          <h2>📅 Bugün Tekrar Edilecekler ({dueWords.length})</h2>
          <div className="word-chips">
            {dueWords.slice(0, 10).map((wordProgress) => (
              <span key={wordProgress.wordId} className="word-chip">
                {wordProgress.word}
              </span>
            ))}
            {dueWords.length > 10 && (
              <span className="word-chip more">
                +{dueWords.length - 10} daha
              </span>
            )}
          </div>
          <button
            className="start-review-button"
            onClick={() => onStartFlashcards(dueWords)}
          >
            Hepsini Çalış
          </button>
        </section>
      )}

      {/* Empty State */}
      {dueWords.length === 0 && stats.totalWordsStudied === 0 && (
        <section className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>Henüz kelime eklemedin!</h3>
          <p>Kelime listesinden çalışmak istediğin kelimeleri seç ve öğrenmeye başla.</p>
          <button
            className="action-button primary"
            onClick={() => onNavigate('wordlist')}
          >
            Kelime Listesine Git
          </button>
        </section>
      )}

      {/* Recent Activity */}
      {stats.totalReviews > 0 && (
        <section className="recent-activity">
          <h2>🏆 İstatistikler</h2>
          <div className="activity-stats">
            <div className="activity-item">
              <span className="activity-label">Toplam Çalışılan:</span>
              <span className="activity-value">{stats.totalWordsStudied} kelime</span>
            </div>
            <div className="activity-item">
              <span className="activity-label">Toplam Tekrar:</span>
              <span className="activity-value">{stats.totalReviews} kez</span>
            </div>
            <div className="activity-item">
              <span className="activity-label">Öğrenildi:</span>
              <span className="activity-value">{stats.statusCounts.mastered} kelime</span>
            </div>
            <div className="activity-item">
              <span className="activity-label">Son Çalışma:</span>
              <span className="activity-value">
                {stats.lastStudyDate
                  ? new Date(stats.lastStudyDate).toLocaleDateString('tr-TR')
                  : 'Henüz yok'
                }
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default VocabularyDashboard
