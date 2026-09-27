import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChartNoAxesColumn, Flame, Layers, Target } from 'lucide-react'
import { fetchStories } from '../utils/api'
import { STATUS_LABELS } from '../utils/format'
import { calculateOverallProgress } from '../utils/spacedRepetition'
import { getReadStories } from '../utils/storyProgress'
import { getProgress, getProgressStats, getWeakWords } from '../utils/vocabularyStorage'
import page from '../styles/page.module.css'
import styles from './Progress.module.css'

const STATUS_ORDER = ['mastered', 'reviewing', 'learning', 'new']

function Progress() {
  const [storyTotal, setStoryTotal] = useState(null)
  const stats = useMemo(getProgressStats, [])
  const overall = useMemo(() => calculateOverallProgress(getProgress()), [])
  const readCount = useMemo(() => getReadStories().length, [])
  const weakWords = useMemo(
    () => getWeakWords(8).filter((w) => w.incorrectCount > 0),
    []
  )

  useEffect(() => {
    fetchStories().then((s) => setStoryTotal(s.length)).catch(() => {})
  }, [])

  const isEmpty = stats.totalWords === 0 && readCount === 0

  return (
    <div className={page.page}>
      <header className={page.header}>
        <h1 className={page.title}>İlerlemen</h1>
        <p className={page.subtitle}>Küçük ama düzenli adımlar en hızlı yoldur.</p>
      </header>

      {isEmpty ? (
        <div className={`card ${page.empty}`}>
          <span className={page.emptyIcon}>
            <ChartNoAxesColumn size={24} />
          </span>
          <p className={page.emptyTitle}>Henüz istatistik yok</p>
          <p>Bir hikaye okuduğunda ya da kelime çalıştığında ilerlemen burada görünecek.</p>
          <Link to="/" className="btn btn-primary">İlk hikayeni oku</Link>
        </div>
      ) : (
        <>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <Flame size={20} className={styles.flame} />
              <strong>{stats.currentStreak || 0}</strong>
              <span>gün seri</span>
            </div>
            <div className={styles.kpi}>
              <BookOpen size={20} className={styles.book} />
              <strong>
                {readCount}
                {storyTotal !== null && <small>/{storyTotal}</small>}
              </strong>
              <span>hikaye okundu</span>
            </div>
            <div className={styles.kpi}>
              <Layers size={20} className={styles.layers} />
              <strong>{stats.totalReviews}</strong>
              <span>kart tekrarı</span>
            </div>
          </div>

          {stats.totalWords > 0 && (
            <section className={`card ${styles.words}`}>
              <div className={styles.ringWrap}>
                <svg viewBox="0 0 100 100" className={styles.ring} aria-hidden="true">
                  <circle cx="50" cy="50" r="42" className={styles.ringBg} />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className={styles.ringFill}
                    style={{ strokeDasharray: `${overall * 2.639} 263.9` }}
                  />
                </svg>
                <span className={styles.ringValue}>{overall}%</span>
              </div>

              <div className={styles.breakdown}>
                <h2 className={page.sectionTitle}>{stats.totalWords} kelime</h2>
                <div className={styles.stack} role="img" aria-label="Kelimelerin durum dağılımı">
                  {STATUS_ORDER.map((s) =>
                    stats.statusCounts[s] > 0 ? (
                      <span
                        key={s}
                        data-status={s}
                        style={{ flexGrow: stats.statusCounts[s] }}
                      />
                    ) : null
                  )}
                </div>
                <ul className={styles.legend}>
                  {STATUS_ORDER.map((s) => (
                    <li key={s} data-status={s}>
                      {STATUS_LABELS[s]} <strong>{stats.statusCounts[s]}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {weakWords.length > 0 && (
            <section className={page.section}>
              <div className={page.sectionHead}>
                <h2 className={page.sectionTitle}>Zorlandığın kelimeler</h2>
              </div>
              <ul className={styles.weak}>
                {weakWords.map((w) => (
                  <li key={w.wordId}>
                    <span className={styles.weakWord}>{w.word}</span>
                    <span className={styles.weakStat}>
                      %{Math.round((w.correctCount / w.reviewCount) * 100)} başarı
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/vocabulary/study"
                state={{ queue: weakWords.map(({ wordId, word }) => ({ wordId, word })) }}
                className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: 14 }}
              >
                <Target size={18} /> Bunları tekrar et
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default Progress
