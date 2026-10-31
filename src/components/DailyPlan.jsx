import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { getStreak } from '../utils/activity'
import { getDailyNewWords } from '../utils/storyProgress'
import { getTodayPlan } from '../utils/studySession'
import { getTodayStudy } from '../utils/vocabularyStorage'
import styles from './DailyPlan.module.css'

const RING_RADIUS = 23
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

function Ring({ done, total }) {
  const filled = total ? (done / total) * RING_LENGTH : 0
  return (
    <svg className={styles.ring} viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r={RING_RADIUS} className={styles.ringTrack} />
      {done > 0 && (
        <circle
          cx="28"
          cy="28"
          r={RING_RADIUS}
          className={styles.ringFill}
          strokeDasharray={`${filled} ${RING_LENGTH}`}
          transform="rotate(-90 28 28)"
        />
      )}
      <text x="28" y="33" textAnchor="middle" className={styles.ringText}>
        {done}/{total}
      </text>
    </svg>
  )
}

function Task({ done, title, detail, progress }) {
  return (
    <li className={styles.task} data-done={done}>
      <span className={styles.check} aria-hidden="true">
        {done && <Check size={14} strokeWidth={3} />}
      </span>
      <span className={styles.taskBody}>
        <span className={styles.taskTitle}>
          {title}
          {done && <span className="sr-only"> (tamamlandı)</span>}
        </span>
        {detail && <span className={styles.taskDetail}>{detail}</span>}
        {progress !== undefined && !done && (
          <span className={styles.bar} aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        )}
      </span>
    </li>
  )
}

/** Ana sayfa: bugünün tekrarları, yeni kelime hedefi ve bir hikaye; tek düğme sıradaki işe götürür */
function DailyPlan({ nextStory }) {
  const plan = useMemo(getTodayPlan, [])
  const today = useMemo(getTodayStudy, [])
  const goal = useMemo(getDailyNewWords, [])
  const { streak, todayActive } = useMemo(() => getStreak(), [])

  const reviewsDone = today.reviews || 0
  const reviewsLeft = plan.reviewTotal
  const learned = Math.min(today.newWords, goal)
  const storyDone = (today.stories || 0) > 0

  // Bugün tekrar zamanı gelen kelime yoksa ve tekrar yapılmadıysa bu iş plana girmez
  // (yapılmamış bir iş "tamamlandı" sayılmasın)
  const hasReviews = reviewsLeft > 0 || reviewsDone > 0
  const tasks = [
    hasReviews && {
      key: 'reviews',
      done: reviewsLeft === 0,
      title: reviewsLeft > 0 ? `${reviewsLeft} kelimeyi tekrar et` : 'Tekrarlar',
      detail: reviewsDone > 0 ? `Bugün ${reviewsDone} tekrar yaptın` : 'Unutmadan önce tekrar et',
      progress: reviewsDone > 0 ? Math.round((reviewsDone / (reviewsDone + reviewsLeft)) * 100) : undefined
    },
    {
      key: 'new',
      done: learned >= goal,
      title: `${goal} yeni kelime öğren`,
      detail: learned > 0 ? `${learned} / ${goal}` : null,
      progress: learned > 0 ? Math.round((learned / goal) * 100) : undefined
    },
    {
      key: 'story',
      done: storyDone,
      title: 'Bir hikaye oku',
      detail: storyDone ? 'Bugün bir hikaye okudun' : null
    }
  ].filter(Boolean)
  const doneCount = tasks.filter((t) => t.done).length
  const left = tasks.length - doneCount

  // Düğme ilk bitmemiş işe götürür
  const action =
    reviewsLeft > 0
      ? { to: '/vocabulary/study', label: `Tekrar et: ${reviewsLeft} kelime` }
      : learned < goal
        ? { to: '/vocabulary/study', label: `Öğren: ${goal - learned} yeni kelime` }
        : !storyDone && nextStory
          ? { to: `/story/${nextStory.id}`, label: 'Hikayeyi oku' }
          : null

  // Seriyi kaybetmemek için hatırlatma; bugün çalışıldıysa gerek yok
  const streakHint = !todayActive && streak > 0 ? `Bugün çalışırsan serin ${streak + 1} güne çıkar.` : null

  return (
    <section className={styles.plan} aria-labelledby="plan-title">
      <div className={styles.head}>
        <Ring done={doneCount} total={tasks.length} />
        <div className={styles.headText}>
          <h2 id="plan-title" className={styles.eyebrow}>
            Bugünün planı
          </h2>
          <p className={styles.title}>
            {left > 0 ? `${left} adım kaldı` : 'Bugünkü planı tamamladın'}
          </p>
          {streakHint && <p className={styles.hint}>{streakHint}</p>}
        </div>
      </div>

      <ul className={styles.tasks}>
        {tasks.map(({ key, ...task }) => (
          <Task key={key} {...task} />
        ))}
      </ul>

      {action ? (
        <Link to={action.to} className={styles.cta}>
          {action.label} <ArrowRight size={18} strokeWidth={2.4} />
        </Link>
      ) : (
        <p className={styles.allDone}>Yarın görüşmek üzere! İstersen bir hikaye daha okuyabilirsin.</p>
      )}
    </section>
  )
}

export default DailyPlan
