import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CircleCheck, Flame, Layers, PartyPopper, Search, Target } from 'lucide-react'
import { LEVEL_NAMES, VOCAB_LEVELS } from '../../utils/format'
import {
  DAILY_NEW_OPTIONS,
  getDailyNewWords,
  getPreferredLevel,
  setDailyNewWords,
  setPreferredLevel
} from '../../utils/storyProgress'
import { getTodayPlan, nextStoryWords } from '../../utils/studySession'
import { getProgress, getProgressStats, getTodayStudy } from '../../utils/vocabularyStorage'
import page from '../../styles/page.module.css'
import styles from './VocabularyHome.module.css'

// Bir cevap ortalama ~15 sn; yeni kelimede tanıtım + soru
const estimateMinutes = (reviews, fresh) => Math.max(1, Math.round((reviews * 15 + fresh * 35) / 60))

/** Son 30 günde ilk denemede doğru cevap oranı */
function recentAccuracy() {
  const daily = getProgress().stats.daily || {}
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  let answers = 0
  let correct = 0
  for (const [day, counts] of Object.entries(daily)) {
    if (day < since) continue
    answers += counts.answers || 0
    correct += counts.correct || 0
  }
  return answers ? Math.round((correct / answers) * 100) : null
}

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
  // Hikaye seviyesi C1/C2 olabilir; kelime listesi B2'de biter
  const [level, setLevel] = useState(() => {
    const preferred = getPreferredLevel() || 'A1'
    return VOCAB_LEVELS.includes(preferred) ? preferred : 'B2'
  })
  const [dailyNew, setDailyNew] = useState(getDailyNewWords)

  const stats = useMemo(getProgressStats, [])
  const accuracy = useMemo(recentAccuracy, [])
  const plan = useMemo(getTodayPlan, [dailyNew])
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
      <header className={page.header}>
        <h1 className={page.title}>Kelimeler</h1>
        <p className={page.subtitle}>
          Oxford 3000 listesinden öğren, akılda kalsın diye doğru zamanda tekrar et.
        </p>
      </header>

      <div className={styles.grid}>
        <section className={styles.today} data-done={nothingLeft || undefined}>
          {nothingLeft ? (
            <>
              <span className={styles.todayEyebrow}>
                <PartyPopper size={16} /> Bugünlük tamam
              </span>
              <h2>Bugünkü çalışmanı bitirdin</h2>
              <p>Yarın tekrar zamanı gelen kelimeler burada olacak. İstersen birkaç yeni kelime daha öğrenebilirsin.</p>
              <DailyGoal learned={learnedToday} goal={dailyNew} />
              <Link to="/vocabulary/study" state={{ extraNew: 5 }} className={`btn btn-lg btn-block ${styles.todayBtn}`}>
                5 yeni kelime daha <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <span className={styles.todayEyebrow}>Bugünkü çalışman</span>
              <h2>
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
              <Link to="/vocabulary/study" className={`btn btn-lg btn-block ${styles.todayBtn}`}>
                Başla <ArrowRight size={18} />
              </Link>
            </>
          )}
        </section>

        <section className={`card ${styles.settings}`}>
          <div>
            <h2 className={styles.settingTitle}>Yeni kelimeler</h2>
            <p className="muted">Seviyeni ve günde kaç yeni kelime öğrenmek istediğini seç.</p>
          </div>

          <div className={styles.levels} role="group" aria-label="Seviye seç">
            {VOCAB_LEVELS.map((l) => (
              <button key={l} className={styles.level} aria-pressed={l === level} onClick={() => handleLevel(l)}>
                <strong>{l}</strong>
                <small>{LEVEL_NAMES[l]}</small>
              </button>
            ))}
          </div>

          <div>
            <p className={styles.segLabel} id="daily-new-label">Günlük yeni kelime</p>
            <div className={styles.seg} role="group" aria-labelledby="daily-new-label">
              {DAILY_NEW_OPTIONS.map((n) => (
                <button key={n} aria-pressed={n === dailyNew} onClick={() => handleDailyNew(n)}>
                  {n}
                </button>
              ))}
            </div>
            <p className={styles.segHint}>
              Tekrarlar her gün zamanı gelen kelimelerden oluşur; bu ayar yalnızca yeni kelime sayısını belirler.
            </p>
          </div>
        </section>
      </div>

      <section className={page.section}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <Flame size={18} className={styles.flame} />
            <strong>{stats.currentStreak || 0}</strong>
            <span>gün seri</span>
          </div>
          <div className={styles.stat}>
            <CircleCheck size={18} className={styles.check} />
            <strong>{stats.statusCounts.mastered}</strong>
            <span>öğrenildi</span>
          </div>
          {accuracy !== null ? (
            <div className={styles.stat}>
              <Target size={18} className={styles.layers} />
              <strong>%{accuracy}</strong>
              <span title="Son 30 gün, ilk denemede doğru">doğruluk</span>
            </div>
          ) : (
            <div className={styles.stat}>
              <Layers size={18} className={styles.layers} />
              <strong>{stats.totalWords}</strong>
              <span>kelimen</span>
            </div>
          )}
        </div>
      </section>

      <Link to="/vocabulary/words" className={styles.browse}>
        <Search size={20} />
        <span>
          <strong>Kelime listesine göz at</strong>
          <small>Ara, seviyeye göre filtrele, detayları incele</small>
        </span>
        <ArrowRight size={18} />
      </Link>
    </div>
  )
}

export default VocabularyHome
