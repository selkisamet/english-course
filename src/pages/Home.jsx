import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Flame, Play, Sparkles } from 'lucide-react'
import DailyPlan from '../components/DailyPlan'
import { fetchStories } from '../utils/api'
import { LEVELS, LEVEL_NAMES, readingMinutes } from '../utils/format'
import {
  getLastStoryId,
  getPreferredLevel,
  getReadStories,
  setPreferredLevel
} from '../utils/storyProgress'
import { getStreak } from '../utils/activity'
import page from '../styles/page.module.css'
import styles from './Home.module.css'

// Kütüphane kapalıyken sıradaki (ilk okunmamış) hikayeden başlayarak gösterilen hikaye sayısı
const UPCOMING_COUNT = 6

function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 5) return 'İyi geceler'
  if (hour < 12) return 'Günaydın'
  if (hour < 18) return 'İyi günler'
  if (hour < 22) return 'İyi akşamlar'
  return 'İyi geceler'
}

function Home() {
  const [stories, setStories] = useState(null)
  const [error, setError] = useState(false)
  const [level, setLevel] = useState(getPreferredLevel() || 'A1')
  const [expanded, setExpanded] = useState(false)

  const readIds = useMemo(() => new Set(getReadStories()), [])
  const { streak } = useMemo(() => getStreak(), [])
  const todayLabel = useMemo(
    () => {
      const now = new Date()
      const weekday = now.toLocaleDateString('tr-TR', { weekday: 'long' })
      return `${weekday}, ${now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`
    },
    []
  )

  useEffect(() => {
    fetchStories().then(setStories).catch(() => setError(true))
  }, [])

  const handleLevel = (next) => {
    setLevel(next)
    setPreferredLevel(next)
    setExpanded(false)
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

  // Kapalıyken: ilk okunmamış hikayeden başlayan kısa liste (hepsi okunduysa baştan)
  const firstUnread = levelStories.findIndex((s) => !readIds.has(s.id))
  const start = expanded ? 0 : Math.max(0, firstUnread)
  const visible = expanded ? levelStories : levelStories.slice(start, start + UPCOMING_COUNT)
  const hidden = levelStories.length - visible.length

  return (
    <div className={page.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.date}>{todayLabel}</p>
          <h1 className={styles.greeting}>{greeting()}</h1>
        </div>
        {streak > 0 && (
          <Link to="/progress" className={styles.streak} aria-label={`Seri: ${streak} gün`}>
            <Flame size={16} strokeWidth={2.4} aria-hidden="true" /> {streak} gün
          </Link>
        )}
      </header>

      <div className={styles.today}>
        <DailyPlan nextStory={nextStory?.story} />

        <section className={styles.next} aria-labelledby="next-title">
          <h2 id="next-title" className={styles.sectionTitle}>
            {nextStory?.resume ? 'Kaldığın yer' : 'Sıradaki hikaye'}
          </h2>
          {stories === null && !error ? (
            <div className={`skeleton ${styles.nextSkeleton}`} />
          ) : nextStory ? (
            <Link to={`/story/${nextStory.story.id}`} className={styles.nextCard}>
              <span className={styles.nextCover} aria-hidden="true">
                {nextStory.story.title.charAt(0)}
              </span>
              <span className={styles.nextBody}>
                <span className={styles.nextMeta}>
                  <span className={`badge badge-${nextStory.story.level.toLowerCase()}`}>
                    {nextStory.story.level}
                  </span>
                  {readingMinutes(nextStory.story.text)} dk okuma
                </span>
                <span className={styles.nextTitle}>{nextStory.story.title}</span>
                <span className={styles.nextExcerpt}>{nextStory.story.text}</span>
              </span>
              <span className={styles.nextPlay} aria-hidden="true">
                <Play size={18} fill="currentColor" strokeWidth={0} />
              </span>
            </Link>
          ) : stories?.length ? (
            <div className={styles.nextCard}>
              <span className={styles.nextCover} aria-hidden="true">
                <Sparkles size={22} />
              </span>
              <span className={styles.nextBody}>
                <span className={styles.nextTitle}>Tüm hikayeleri okudun!</span>
              </span>
            </div>
          ) : null}
        </section>
      </div>

      <section className={page.section} aria-labelledby="library-title">
        <h2 id="library-title" className={`${styles.sectionTitle} ${styles.libraryTitle}`}>
          Kütüphane
        </h2>

        <div className="segmented" role="group" aria-label="Seviye seç">
          {(availableLevels.length ? availableLevels : LEVELS).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={l === level}
              title={LEVEL_NAMES[l]}
              onClick={() => handleLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>

        {levelStories.length > 0 && (
          <div className={styles.levelInfo}>
            <span className={styles.levelName}>{LEVEL_NAMES[level]}</span>
            <span className={styles.levelBar} aria-hidden="true">
              <span style={{ width: `${(readInLevel / levelStories.length) * 100}%` }} />
            </span>
            <span className={styles.levelCount}>
              {readInLevel} / {levelStories.length} okundu
            </span>
          </div>
        )}

        {error ? (
          <div className={page.empty}>
            <p className={page.emptyTitle}>Hikayeler yüklenemedi</p>
            <p>İnternet bağlantını kontrol edip sayfayı yenile.</p>
          </div>
        ) : stories === null ? (
          <div className={`skeleton ${styles.listSkeleton}`} />
        ) : levelStories.length === 0 ? (
          <div className={page.empty}>
            <p>Bu seviyede henüz hikaye yok.</p>
          </div>
        ) : (
          <>
            <ol className={styles.list}>
              {visible.map((story, i) => {
                const isRead = readIds.has(story.id)
                return (
                  <li key={story.id}>
                    <Link to={`/story/${story.id}`} className={styles.row} data-read={isRead}>
                      <span className={styles.rowIndex}>
                        {isRead ? (
                          <>
                            <Check size={16} strokeWidth={3} aria-hidden="true" />
                            <span className="sr-only">Okundu:</span>
                          </>
                        ) : (
                          start + i + 1
                        )}
                      </span>
                      <span className={styles.rowTitle}>{story.title}</span>
                      <span className={styles.rowMeta}>{readingMinutes(story.text)} dk</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
            {hidden > 0 && (
              <button type="button" className={`btn btn-secondary btn-block ${styles.more}`} onClick={() => setExpanded(true)}>
                Tüm {level} hikayeleri ({levelStories.length}) <ChevronDown size={18} />
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default Home
