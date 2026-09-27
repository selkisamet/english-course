import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleCheck, Flame, Layers, Search, Sparkles } from 'lucide-react'
import { pickNewWords } from '../../utils/api'
import { LEVEL_NAMES, VOCAB_LEVELS } from '../../utils/format'
import { getPreferredLevel, setPreferredLevel } from '../../utils/storyProgress'
import { getProgressStats, getWordsDueForReview } from '../../utils/vocabularyStorage'
import page from '../../styles/page.module.css'
import styles from './VocabularyHome.module.css'

const NEW_WORD_COUNT = 10

function VocabularyHome() {
  const navigate = useNavigate()
  // Hikaye seviyesi C1/C2 olabilir; kelime listesi B2'de biter
  const [level, setLevel] = useState(() => {
    const preferred = getPreferredLevel() || 'A1'
    return VOCAB_LEVELS.includes(preferred) ? preferred : 'B2'
  })
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const stats = useMemo(getProgressStats, [])
  const dueCount = useMemo(() => getWordsDueForReview().length, [])

  const handleLevel = (next) => {
    setLevel(next)
    setPreferredLevel(next)
  }

  const startNewWords = async () => {
    setStarting(true)
    setError('')
    try {
      const queue = await pickNewWords(level, NEW_WORD_COUNT)
      if (queue.length === 0) {
        setError('Bu seviyede yeni kelime kalmadı. Bir üst seviyeyi dene.')
        return
      }
      navigate('/vocabulary/study', { state: { queue } })
    } catch {
      setError('Kelimeler yüklenemedi. Bağlantını kontrol et.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className={page.page}>
      <header className={page.header}>
        <h1 className={page.title}>Kelimeler</h1>
        <p className={page.subtitle}>
          Oxford 3000 listesinden öğren, aralıklı tekrarla kalıcı hale getir.
        </p>
      </header>

      <div className={styles.grid}>
        {dueCount > 0 && (
          <section className={styles.due}>
            <span className={styles.dueIcon}>
              <Layers size={22} />
            </span>
            <div className={styles.dueText}>
              <h2>{dueCount} kelime tekrar bekliyor</h2>
              <p>Unutma eğrisini kırmanın en iyi zamanı şimdi.</p>
            </div>
            <Link to="/vocabulary/study" className="btn btn-primary btn-lg">
              Tekrara başla <ArrowRight size={18} />
            </Link>
          </section>
        )}

        <section className={`card ${styles.learn}`}>
          <div className={styles.learnHead}>
            <span className={styles.learnIcon}>
              <Sparkles size={20} />
            </span>
            <div>
              <h2>Yeni kelime öğren</h2>
              <p className="muted">Seviyeni seç, {NEW_WORD_COUNT} kelimelik kısa bir set başlat.</p>
            </div>
          </div>

          <div className={styles.levels} role="group" aria-label="Seviye seç">
            {VOCAB_LEVELS.map((l) => (
              <button
                key={l}
                className={styles.level}
                aria-pressed={l === level}
                onClick={() => handleLevel(l)}
              >
                <strong>{l}</strong>
                <small>{LEVEL_NAMES[l]}</small>
              </button>
            ))}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={`btn btn-lg btn-block ${styles.start}`} onClick={startNewWords} disabled={starting}>
            {starting ? 'Hazırlanıyor…' : `${level} seviyesinden ${NEW_WORD_COUNT} kelime başlat`}
          </button>
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
          <div className={styles.stat}>
            <Layers size={18} className={styles.layers} />
            <strong>{stats.totalWords}</strong>
            <span>kelimen</span>
          </div>
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
