import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartNoAxesColumn, Flame, Layers, Target, CircleCheck } from 'lucide-react'
import ActivityChart from '../components/ActivityChart'
import { fetchStories, fetchWordPool } from '../utils/api'
import { getActivity, getLevelProgress, getReviewForecast, getStreak, percentAccusative } from '../utils/activity'
import { LEVELS, STATUS_LABELS, VOCAB_LEVELS } from '../utils/format'
import { calculateOverallProgress } from '../utils/spacedRepetition'
import { getPreferredLevel, getReadStories } from '../utils/storyProgress'
import { getProgress, getProgressStats, getWeakWords } from '../utils/vocabularyStorage'
import page from '../styles/page.module.css'
import styles from './Progress.module.css'

const STATUS_ORDER = ['mastered', 'reviewing', 'learning', 'new']

const dayName = (date, i) =>
  i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : date.toLocaleDateString('tr-TR', { weekday: 'long' })

/** Oxford listesinde seviye seviye bilinen kelimeler */
function LevelProgress() {
  const [levels, setLevels] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetchWordPool()
      .then((pool) => setLevels(getLevelProgress(pool)))
      .catch(() => setFailed(true))
  }, [])

  if (failed) return null
  if (!levels) return <div className={`skeleton ${styles.levelsSkeleton}`} />

  const preferred = getPreferredLevel()
  const focus = levels.find((l) => l.level === (VOCAB_LEVELS.includes(preferred) ? preferred : 'B2'))

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="levels-title">
      <div className={styles.panelHead}>
        <h2 id="levels-title" className={styles.panelTitle}>Seviye ilerlemesi</h2>
        <p className={styles.panelCaption}>Oxford 3000 listesinde bildiğin kelimeler</p>
      </div>
      <ul className={styles.levels}>
        {levels.map((l) => (
          <li key={l.level}>
            <div className={styles.levelRow}>
              <strong>{l.level}</strong>
              <span>
                {l.known} / {l.total} · <b>%{l.percent}</b>
              </span>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-label={`${l.level} kelimeleri`}
              aria-valuenow={l.known}
              aria-valuemin={0}
              aria-valuemax={l.total}
            >
              <span style={{ width: `${(l.known / l.total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {focus && focus.known > 0 && (
        <p className={styles.levelNote}>
          {focus.level} kelimelerinin <strong>{percentAccusative(focus.percent)}</strong> biliyorsun.
        </p>
      )}
      <p className={styles.footnote}>
        Bir kelime en az bir hafta sonra yeniden sorulacak kadar iyi öğrenildiğinde bilinen sayılır.
      </p>
    </section>
  )
}

/** Önümüzdeki 7 günde tekrar zamanı gelecek kelimeler */
function ReviewForecast({ days }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <section className={`card ${styles.panel}`} aria-labelledby="forecast-title">
      <div className={styles.panelHead}>
        <h2 id="forecast-title" className={styles.panelTitle}>Yaklaşan tekrarlar</h2>
        <p className={styles.panelCaption}>Önümüzdeki 7 günde tekrar zamanı gelecek kelimeler</p>
      </div>
      <ul className={styles.forecast}>
        {days.map((d, i) => (
          <li key={i}>
            <span className={styles.forecastDay}>{dayName(d.date, i)}</span>
            <span className={styles.forecastTrack}>
              <span style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className={styles.forecastCount}>{d.count}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Seviyelere göre okunan hikayeler */
function StoriesRead({ stories, readIds }) {
  const levels = LEVELS.map((level) => {
    const list = stories.filter((s) => s.level === level)
    return { level, total: list.length, read: list.filter((s) => readIds.has(s.id)).length }
  }).filter((l) => l.total > 0)

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="stories-title">
      <div className={styles.panelHead}>
        <h2 id="stories-title" className={styles.panelTitle}>Okunan hikayeler</h2>
      </div>
      <ul className={styles.storyLevels}>
        {levels.map((l) => (
          <li key={l.level} data-complete={l.read === l.total}>
            <span>{l.level}</span>
            <strong>
              {l.read} <small>/ {l.total}</small>
            </strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Progress() {
  const [stories, setStories] = useState(null)
  const stats = useMemo(getProgressStats, [])
  const overall = useMemo(() => calculateOverallProgress(getProgress()), [])
  const readIds = useMemo(() => new Set(getReadStories()), [])
  const { streak } = useMemo(() => getStreak(), [])
  const week = useMemo(() => getActivity(7), [])
  const forecast = useMemo(() => getReviewForecast(7), [])
  const weakWords = useMemo(() => getWeakWords(8).filter((w) => w.incorrectCount > 0), [])

  useEffect(() => {
    fetchStories().then(setStories).catch(() => {})
  }, [])

  const answers = week.reduce((sum, d) => sum + d.answers, 0)
  const correct = week.reduce((sum, d) => sum + d.correct, 0)
  const hasCards = forecast.some((d) => d.count > 0) || stats.totalReviews > 0
  const isEmpty = stats.totalWords === 0 && readIds.size === 0 && streak === 0

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
        <div className={styles.sections}>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <Flame size={20} className={styles.flame} />
              <strong>{streak}</strong>
              <span>gün seri</span>
            </div>
            <div className={styles.kpi}>
              <Layers size={20} className={styles.layers} />
              <strong>{answers}</strong>
              <span>cevap (7 gün)</span>
            </div>
            <div className={styles.kpi}>
              <CircleCheck size={20} className={styles.book} />
              <strong>{answers ? `%${Math.round((correct / answers) * 100)}` : '–'}</strong>
              <span>doğruluk (7 gün)</span>
            </div>
          </div>

          <ActivityChart />

          <LevelProgress />

          {hasCards && <ReviewForecast days={forecast} />}

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
                      <span key={s} data-status={s} style={{ flexGrow: stats.statusCounts[s] }} />
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

          {stories && <StoriesRead stories={stories} readIds={readIds} />}

          {weakWords.length > 0 && (
            <section>
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
        </div>
      )}
    </div>
  )
}

export default Progress
