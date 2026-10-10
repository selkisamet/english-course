import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { getStreak, getWeek } from '../utils/activity'
import { getDailyNewWords } from '../utils/storyProgress'
import { getTodayPlan } from '../utils/studySession'
import { getTodayStudy } from '../utils/vocabularyStorage'
import styles from './DailyPlan.module.css'

const weekdayShort = (date) => date.toLocaleDateString('tr-TR', { weekday: 'short' })

function Task({ done, title, detail, progress }) {
  return (
    <li className={styles.task} data-done={done}>
      <span className={styles.check} aria-hidden="true">
        {done && <Check size={16} strokeWidth={3} />}
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

/** Ana sayfa: bugünün tekrarları, yeni kelime hedefi ve bir hikaye; altta bu hafta */
function DailyPlan({ nextStory }) {
  const plan = useMemo(getTodayPlan, [])
  const today = useMemo(getTodayStudy, [])
  const goal = useMemo(getDailyNewWords, [])
  const week = useMemo(() => getWeek(), [])
  const { streak, todayActive } = useMemo(() => getStreak(), [])

  const reviewsDone = today.reviews || 0
  const reviewsLeft = plan.reviewTotal
  const learned = Math.min(today.newWords, goal)
  const storyDone = (today.stories || 0) > 0

  const tasks = [
    {
      key: 'reviews',
      done: reviewsLeft === 0,
      title: reviewsLeft > 0 ? `${reviewsLeft} kelime tekrar bekliyor` : 'Tekrarlar',
      detail:
        reviewsLeft > 0
          ? reviewsDone > 0 ? `Bugün ${reviewsDone} tekrar yaptın` : 'Unutmadan önce tekrar et'
          : reviewsDone > 0 ? `Bugün ${reviewsDone} tekrar yaptın` : 'Bugün tekrar zamanı gelen kelime yok',
      progress: reviewsDone > 0 ? Math.round((reviewsDone / (reviewsDone + reviewsLeft)) * 100) : undefined
    },
    {
      key: 'new',
      done: learned >= goal,
      title: 'Yeni kelimeler',
      detail: `${learned} / ${goal}`,
      progress: Math.round((learned / goal) * 100)
    },
    {
      key: 'story',
      done: storyDone,
      title: '1 hikaye oku',
      detail: storyDone ? 'Bugün bir hikaye okudun' : nextStory ? `Sıradaki: ${nextStory.title} · ${nextStory.level}` : null
    }
  ]
  const doneCount = tasks.filter((t) => t.done).length

  // Düğme ilk bitmemiş işe götürür
  const action =
    reviewsLeft > 0
      ? { to: '/vocabulary/study', label: `Tekrar et: ${reviewsLeft} kelime` }
      : learned < goal
        ? { to: '/vocabulary/study', label: `Öğren: ${goal - learned} yeni kelime` }
        : !storyDone && nextStory
          ? { to: `/story/${nextStory.id}`, label: 'Hikayeyi oku' }
          : null

  const streakHint = todayActive
    ? 'Bugün çalıştın, serin devam ediyor.'
    : streak > 0
      ? `Bugün çalışırsan serin ${streak + 1} güne çıkar.`
      : 'Bugün çalışarak yeni bir seri başlat.'

  return (
    <section className={`card ${styles.plan}`} aria-labelledby="plan-title">
      <div className={styles.head}>
        <h2 id="plan-title" className={styles.title}>Bugünkü plan</h2>
        <span className={styles.count}>
          {doneCount} / {tasks.length} tamam
        </span>
      </div>

      <ul className={styles.tasks}>
        {tasks.map(({ key, ...task }) => (
          <Task key={key} {...task} />
        ))}
      </ul>

      {action ? (
        <Link to={action.to} className="btn btn-primary btn-lg btn-block">
          {action.label} <ArrowRight size={18} />
        </Link>
      ) : (
        <p className={styles.allDone}>Bugünkü planı tamamladın. Yarın görüşmek üzere!</p>
      )}

      <div className={styles.week}>
        <div className={styles.weekHead}>
          <span className={styles.weekTitle}>Bu hafta</span>
          <Link to="/progress" className={styles.weekLink}>
            İlerleme
          </Link>
        </div>
        <ol className={styles.days}>
          {week.map((d) => (
            <li key={d.day} data-active={d.active} data-today={d.isToday} data-future={d.isFuture}>
              <span className={styles.dayName}>{weekdayShort(d.date)}</span>
              <span className={styles.dot} aria-hidden="true">
                {d.active && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="sr-only">{d.active ? 'çalışıldı' : d.isFuture ? '' : 'çalışılmadı'}</span>
            </li>
          ))}
        </ol>
        <p className={styles.hint}>{streakHint}</p>
      </div>
    </section>
  )
}

export default DailyPlan
