import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronRight, PartyPopper, Search, SlidersHorizontal } from 'lucide-react'
import Sheet, { SheetRow } from '../../components/Sheet'
import { LEVEL_NAMES, STATUS_LABELS, VOCAB_LEVELS } from '../../utils/format'
import {
  DAILY_NEW_OPTIONS,
  getDailyNewWords,
  getPreferredLevel,
  setDailyNewWords,
  setPreferredLevel
} from '../../utils/storyProgress'
import { getTodayPlan, nextStoryWords } from '../../utils/studySession'
import { getProgressStats, getTodayStudy } from '../../utils/vocabularyStorage'
import page from '../../styles/page.module.css'
import styles from './VocabularyHome.module.css'

// Bir cevap ortalama ~15 sn; yeni kelimede tanıtım + soru
const estimateMinutes = (reviews, fresh) => Math.max(1, Math.round((reviews * 15 + fresh * 35) / 60))

// Kelimenin durumu tekrar aralığına göre belirlenir (utils/srs.js › statusOf)
const STATUS_CARDS = [
  { key: 'learning', hint: 'Haftadan sık tekrar' },
  { key: 'reviewing', hint: '1–4 haftada bir tekrar' },
  { key: 'mastered', hint: 'Ayda bir ya da daha seyrek' }
]

/** Günlük yeni kelime hedefi: bugün kaç tanesi öğrenildi */
function DailyGoal({ learned, goal }) {
  const percent = Math.min(100, Math.round((learned / goal) * 100))
  return (
    <div className={styles.goal}>
      <div className={styles.goalText}>
        <span>Günlük yeni kelime hedefi</span>
        <strong>
          {learned}/{goal}
        </strong>
      </div>
      <div className={styles.goalBar} role="progressbar" aria-label="Günlük yeni kelime hedefi" aria-valuenow={learned} aria-valuemax={goal}>
        <div style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function VocabularyHome() {
  const [level, setLevel] = useState(() => {
    const preferred = getPreferredLevel() || 'A1'
    return VOCAB_LEVELS.includes(preferred) ? preferred : 'A1'
  })
  const [dailyNew, setDailyNew] = useState(getDailyNewWords)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const stats = useMemo(getProgressStats, [])
  const plan = useMemo(getTodayPlan, [dailyNew, level])
  const learnedToday = useMemo(() => getTodayStudy().newWords, [])
  const newCount = plan.newLeft
  const reviewCount = plan.reviews.length
  const nothingLeft = reviewCount === 0 && newCount === 0

  // Yeni kelimelerin kaçı sıradaki hikayeden gelecek
  const [fromStory, setFromStory] = useState(null)
  useEffect(() => {
    let active = true
    const wanted = Math.max(0, newCount - plan.saved.length)
    nextStoryWords(wanted).then(({ story, words }) => active && setFromStory(story && words.length ? { story, count: words.length } : null))
    return () => {
      active = false
    }
  }, [newCount, plan])

  const handleLevel = (next) => {
    setLevel(next)
    setPreferredLevel(next)
  }

  const handleDailyNew = (count) => {
    setDailyNew(count)
    setDailyNewWords(count)
  }

  return (
    <div className={page.page}>
      <header className={styles.header}>
        <h1 className={page.title}>Kelimeler</h1>
        <button type="button" className={styles.settingsBtn} onClick={() => setSettingsOpen(true)} aria-label={`Kelime ayarları: ${level}, günde ${dailyNew} yeni kelime`}>
          <SlidersHorizontal size={17} />
          {level} · günde {dailyNew}
        </button>
      </header>

      <div className={styles.grid}>
        <section className={styles.today} data-done={nothingLeft || undefined} aria-labelledby="today-title">
          {nothingLeft ? (
            <>
              <span className={styles.todayEyebrow}>
                <PartyPopper size={16} /> Bugünlük tamam
              </span>
              <h2 id="today-title">Bugünkü çalışmanı bitirdin</h2>
              <p>Yarın tekrar zamanı gelen kelimeler burada olacak. İstersen birkaç yeni kelime daha öğrenebilirsin.</p>
              <DailyGoal learned={learnedToday} goal={dailyNew} />
              <Link to="/vocabulary/study" state={{ extraNew: 5 }} className={styles.todayBtn}>
                5 yeni kelime daha <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <span className={styles.todayEyebrow}>Bugünkü çalışman</span>
              <h2 id="today-title">
                {[reviewCount > 0 && `${reviewCount} tekrar`, newCount > 0 && `${newCount} yeni kelime`]
                  .filter(Boolean)
                  .join(' · ')}
              </h2>
              <p>
                Yaklaşık {estimateMinutes(reviewCount, newCount)} dakika
                {plan.reviewTotal > reviewCount && ` · ${plan.reviewTotal - reviewCount} tekrar sonraki oturuma kalacak`}
              </p>
              {fromStory && (
                <p className={styles.fromStory}>
                  <BookOpen size={18} />
                  <span>
                    Yeni kelimelerin {fromStory.count} tanesi sıradaki hikayende geçiyor:{' '}
                    <strong>{fromStory.story.title}</strong>. Önce kelimeleri öğren, sonra hikayede tanı.
                  </span>
                </p>
              )}
              <DailyGoal learned={learnedToday} goal={dailyNew} />
              <Link to="/vocabulary/study" className={styles.todayBtn}>
                Çalışmaya başla <ArrowRight size={18} />
              </Link>
            </>
          )}
        </section>

        <div className={styles.side}>
          <section aria-labelledby="status-title">
            <div className={styles.sectionHead}>
              <h2 id="status-title" className={styles.sectionTitle}>
                Kelimelerin
              </h2>
              <Link to="/progress" className={styles.sectionLink}>
                İlerleme <ChevronRight size={16} />
              </Link>
            </div>
            <ul className={styles.stats}>
              {STATUS_CARDS.map(({ key, hint }) => (
                <li key={key} className={styles.stat}>
                  <strong>{stats.statusCounts[key]}</strong>
                  <span className={styles.statLabel}>{STATUS_LABELS[key]}</span>
                  <span className={styles.statHint}>{hint}</span>
                </li>
              ))}
            </ul>
          </section>

          <Link to="/vocabulary/words" className={styles.browse}>
            <Search size={20} />
            <span>
              <strong>Kelime listesi</strong>
              <small>Ara, seviyeye göre filtrele, detayları incele</small>
            </span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Kelime ayarları">
        <SheetRow label="Yeni kelimeler hangi seviyeden?" hint={LEVEL_NAMES[level]} stacked>
          <div className="segmented" role="group" aria-label="Seviye">
            {VOCAB_LEVELS.map((l) => (
              <button key={l} type="button" aria-pressed={l === level} onClick={() => handleLevel(l)}>
                {l}
              </button>
            ))}
          </div>
        </SheetRow>
        <SheetRow
          label="Günde kaç yeni kelime?"
          hint="Tekrarlar her gün zamanı gelen kelimelerden oluşur; bu ayar yalnızca yeni kelime sayısını belirler."
          stacked
        >
          <div className="segmented" role="group" aria-label="Günlük yeni kelime">
            {DAILY_NEW_OPTIONS.map((n) => (
              <button key={n} type="button" aria-pressed={n === dailyNew} onClick={() => handleDailyNew(n)}>
                {n}
              </button>
            ))}
          </div>
        </SheetRow>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setSettingsOpen(false)}>
          Tamam
        </button>
      </Sheet>
    </div>
  )
}

export default VocabularyHome
