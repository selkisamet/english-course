import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, Clock, Layers, Sparkles } from 'lucide-react'
import { fetchStories } from '../utils/api'
import { LEVELS, LEVEL_NAMES, readingMinutes } from '../utils/format'
import {
  getLastStoryId,
  getPreferredLevel,
  getReadStories,
  setPreferredLevel
} from '../utils/storyProgress'
import { getTodayPlan } from '../utils/studySession'
import page from '../styles/page.module.css'
import styles from './Home.module.css'

function Home() {
  const [stories, setStories] = useState(null)
  const [error, setError] = useState(false)
  const [level, setLevel] = useState(getPreferredLevel() || 'A1')

  const readIds = useMemo(() => new Set(getReadStories()), [])
  const plan = useMemo(getTodayPlan, [])
  const dueCount = plan.reviewTotal

  useEffect(() => {
    fetchStories().then(setStories).catch(() => setError(true))
  }, [])

  const handleLevel = (next) => {
    setLevel(next)
    setPreferredLevel(next)
  }

  const levelStories = useMemo(
    () => (stories || []).filter((s) => s.level === level),
    [stories, level]
  )

  const nextStory = useMemo(() => {
    if (!stories) return null
    const last = stories.find((s) => s.id === getLastStoryId())
    if (last && !readIds.has(last.id)) return { story: last, resume: true }
    const unread =
      levelStories.find((s) => !readIds.has(s.id)) || stories.find((s) => !readIds.has(s.id))
    return unread ? { story: unread, resume: false } : null
  }, [stories, levelStories, readIds])

  const availableLevels = LEVELS.filter((l) => stories?.some((s) => s.level === l))
  const readInLevel = levelStories.filter((s) => readIds.has(s.id)).length

  return (
    <div className={page.page}>
      <header className={page.header}>
        <h1 className={page.title}>Bugün ne öğreniyoruz?</h1>
        <p className={page.subtitle}>Kısa bir hikaye oku, bilmediğin kelimeye dokun, tekrar et.</p>
      </header>

      <section className={styles.today} aria-label="Bugün">
        {stories === null && !error ? (
          <div className={`skeleton ${styles.heroSkeleton}`} />
        ) : nextStory ? (
          <Link to={`/story/${nextStory.story.id}`} className={styles.hero}>
            <span className={styles.heroEyebrow}>
              <BookOpen size={16} />
              {nextStory.resume ? 'Kaldığın yerden devam et' : 'Sıradaki hikaye'}
            </span>
            <h2 className={styles.heroTitle}>{nextStory.story.title}</h2>
            <p className={styles.heroExcerpt}>{nextStory.story.text}</p>
            <span className={styles.heroFooter}>
              <span className={styles.heroMeta}>
                {nextStory.story.level} · {LEVEL_NAMES[nextStory.story.level]} ·{' '}
                {readingMinutes(nextStory.story.text)} dk
              </span>
              <span className={styles.heroCta}>
                Oku <ArrowRight size={18} />
              </span>
            </span>
          </Link>
        ) : (
          <div className={styles.hero}>
            <span className={styles.heroEyebrow}>
              <Sparkles size={16} /> Tebrikler
            </span>
            <h2 className={styles.heroTitle}>Tüm hikayeleri okudun!</h2>
          </div>
        )}

        <Link
          to={dueCount > 0 ? '/vocabulary/study' : '/vocabulary'}
          className={styles.review}
        >
          <span className={styles.reviewIcon}>
            <Layers size={22} />
          </span>
          <span className={styles.reviewText}>
            <strong>{dueCount > 0 ? `${dueCount} kelime tekrarı bekliyor` : 'Kelime çalış'}</strong>
            <small>
              {dueCount > 0
                ? 'Unutmadan önce birkaç dakika ayır'
                : plan.newLeft > 0
                  ? `Bugün ${plan.newLeft} yeni kelime seni bekliyor`
                  : 'Bugünlük kelime çalışmanı bitirdin'}
            </small>
          </span>
          <ArrowRight size={18} className={styles.reviewArrow} />
        </Link>
      </section>

      <section className={page.section}>
        <div className={page.sectionHead}>
          <h2 className={page.sectionTitle}>Hikaye kütüphanesi</h2>
          {levelStories.length > 0 && (
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              {readInLevel}/{levelStories.length} okundu
            </span>
          )}
        </div>

        <div className="chip-row" role="group" aria-label="Seviye seç">
          {(availableLevels.length ? availableLevels : LEVELS).map((l) => (
            <button
              key={l}
              className="chip"
              aria-pressed={l === level}
              onClick={() => handleLevel(l)}
            >
              {l}
              <span className={styles.chipName}>{LEVEL_NAMES[l]}</span>
            </button>
          ))}
        </div>

        {error ? (
          <div className={page.empty}>
            <p className={page.emptyTitle}>Hikayeler yüklenemedi</p>
            <p>İnternet bağlantını kontrol edip sayfayı yenile.</p>
          </div>
        ) : stories === null ? (
          <div className={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`skeleton ${styles.cardSkeleton}`} />
            ))}
          </div>
        ) : levelStories.length === 0 ? (
          <div className={page.empty}>
            <p>Bu seviyede henüz hikaye yok.</p>
          </div>
        ) : (
          <ol className={styles.grid}>
            {levelStories.map((story, index) => {
              const isRead = readIds.has(story.id)
              return (
                <li key={story.id}>
                  <Link to={`/story/${story.id}`} className={styles.card} data-read={isRead}>
                    <span className={styles.cardIndex}>
                      {isRead ? <Check size={16} strokeWidth={3} /> : index + 1}
                    </span>
                    <span className={styles.cardBody}>
                      <span className={styles.cardTitle}>{story.title}</span>
                      <span className={styles.cardExcerpt}>{story.text}</span>
                      <span className={styles.cardMeta}>
                        <Clock size={13} /> {readingMinutes(story.text)} dk
                        {isRead && <span className={styles.readTag}>Okundu</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}

export default Home
