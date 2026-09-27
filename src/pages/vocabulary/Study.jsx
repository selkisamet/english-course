import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Layers, Trophy, Volume2, X } from 'lucide-react'
import { HighlightedSentence } from '../../components/WordPanel'
import { fetchWord } from '../../utils/api'
import { capitalize, formatTr, translatePOS } from '../../utils/format'
import { speak } from '../../utils/speech'
import {
  calculateNextReview,
  DIFFICULTY,
  getTimeUntilReview,
  updateWordProgress as applyReview
} from '../../utils/spacedRepetition'
import {
  createNewWordProgress,
  getWordProgress,
  getWordsDueForReview,
  removeWordProgress,
  updateWordProgress as saveWordProgress
} from '../../utils/vocabularyStorage'
import page from '../../styles/page.module.css'
import styles from './Study.module.css'

const SESSION_LIMIT = 20

const RATINGS = [
  { key: '1', difficulty: DIFFICULTY.HARD, label: 'Bilmiyorum', tone: 'hard' },
  { key: '2', difficulty: DIFFICULTY.MEDIUM, label: 'Zor', tone: 'medium' },
  { key: '3', difficulty: DIFFICULTY.EASY, label: 'Biliyorum', tone: 'easy' }
]

const initialQueue = (state) => {
  if (state?.queue?.length) return state.queue
  return getWordsDueForReview()
    .slice(0, SESSION_LIMIT)
    .map(({ wordId, word }) => ({ wordId, word }))
}

function Example({ english, turkish, label, highlight }) {
  return (
    <div className={styles.example}>
      {label && <p className={`eyebrow ${styles.exampleLabel}`}>{label}</p>}
      <p>
        {highlight ? <HighlightedSentence sentence={english} word={highlight} /> : english}
        <button
          className={styles.inlineSpeak}
          onClick={() => speak(english)}
          aria-label="Örnek cümleyi dinle"
        >
          <Volume2 size={16} />
        </button>
      </p>
      {turkish && <p className={styles.exampleTr}>{formatTr(turkish)}</p>}
    </div>
  )
}

function CardBack({ info }) {
  if (!info || info.loading) {
    return (
      <div className={styles.back}>
        <div className="skeleton" style={{ height: 32, width: '60%' }} />
      </div>
    )
  }

  if (info.story) {
    const { story } = info
    return (
      <div className={styles.back}>
        <p className={styles.translation}>{formatTr(story.translation) || '—'}</p>
        {story.pos && <span className="badge">{translatePOS(story.pos)}</span>}
        <Example
          english={story.sentence}
          turkish={story.sentenceTranslation}
          label="Hikayede gördüğün cümle"
          highlight={story.highlight}
        />
      </div>
    )
  }

  if (info.senses) {
    const [main, ...others] = info.senses
    return (
      <div className={styles.back}>
        <p className={styles.translation}>{formatTr(main.translation)}</p>
        <span className="badge">{translatePOS(main.pos)}</span>
        <p className={styles.definition}>{capitalize(main.definition)}</p>
        <Example english={main.example} turkish={main.exampleTranslation} />
        {others.length > 0 && (
          <ul className={styles.otherSenses}>
            {others.map((s) => (
              <li key={`${s.pos}-${s.homonym || ''}-${s.note || ''}`}>
                <span className="badge">{translatePOS(s.pos)}</span>
                {formatTr(s.translation)}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className={styles.back}>
      {info.fallback ? (
        <p className={styles.translation}>{formatTr(info.fallback)}</p>
      ) : (
        <p className="muted">Bu kelimenin anlamı bulunamadı.</p>
      )}
    </div>
  )
}

const nextReviewLabel = (wordId, difficulty) => {
  const reviewCount = (getWordProgress(wordId)?.reviewCount || 0) + 1
  return getTimeUntilReview(calculateNextReview({ reviewCount }, difficulty)).description
}

function Study() {
  const location = useLocation()
  const navigate = useNavigate()
  const [queue] = useState(() => initialQueue(location.state))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState({ easy: 0, medium: 0, hard: 0 })
  const [done, setDone] = useState(false)
  const [details, setDetails] = useState({})

  const current = queue[index]
  const info = current ? details[current.wordId] : null

  const loadDetails = useCallback((item) => {
    const set = (value) => setDetails((prev) => ({ ...prev, [item.wordId]: value }))
    const saved = getWordProgress(item.wordId)

    // Hikayeden kaydedilen kelime: hikayede karşılaşılan anlamı göster
    if (saved?.sentence) {
      set({
        story: {
          translation: saved.translation,
          pos: saved.pos,
          sentence: saved.sentence,
          sentenceTranslation: saved.sentenceTranslation,
          highlight: saved.surface
        }
      })
      return
    }

    // Kelime listesindeki kelime: doğrulanmış bütün anlamları
    set({ loading: true })
    fetchWord(item.wordId)
      .then((word) => set({ senses: word.senses }))
      .catch(() => set(saved?.translation ? { fallback: saved.translation } : { orphan: true }))
  }, [])

  useEffect(() => {
    ;[queue[index], queue[index + 1]].forEach((item) => {
      if (item && !details[item.wordId]) loadDetails(item)
    })
  }, [index, queue, details, loadDetails])

  // Eski sürümden kalan, kelime listesinde artık olmayan ve anlamı bilinmeyen
  // kelimeyi gösterme: ilerlemeden kaldır ve sıradakine geç
  useEffect(() => {
    if (!info?.orphan) return
    removeWordProgress(current.wordId)
    if (index + 1 < queue.length) setIndex(index + 1)
    else setDone(true)
  }, [info, current, index, queue.length])

  const rate = useCallback(
    (difficulty) => {
      if (!current) return
      const existing =
        getWordProgress(current.wordId) || createNewWordProgress(current.wordId, current.word)
      saveWordProgress(current.wordId, current.word, applyReview(existing, difficulty))
      setResults((r) => ({ ...r, [difficulty]: r[difficulty] + 1 }))

      if (index + 1 < queue.length) {
        setIndex(index + 1)
        setFlipped(false)
      } else {
        setDone(true)
      }
    },
    [current, index, queue.length]
  )

  useEffect(() => {
    if (done) return
    const onKey = (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !flipped) {
        e.preventDefault()
        setFlipped(true)
      } else if (flipped) {
        const rating = RATINGS.find((r) => r.key === e.key)
        if (rating) rate(rating.difficulty)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, rate, done])

  const close = () => navigate(location.key === 'default' ? '/vocabulary' : -1)

  if (queue.length === 0) {
    return (
      <div className={page.page}>
        <div className={page.empty}>
          <span className={page.emptyIcon}>
            <Layers size={24} />
          </span>
          <p className={page.emptyTitle}>Şu an tekrar edilecek kelime yok</p>
          <p>Yeni kelimeler öğrenerek başla ya da hikayelerden kelime kaydet.</p>
          <Link to="/vocabulary" className="btn btn-primary">Yeni kelime öğren</Link>
        </div>
      </div>
    )
  }

  if (done) {
    const total = results.easy + results.medium + results.hard
    return (
      <div className={styles.summary}>
        <span className={styles.trophy}>
          <Trophy size={32} />
        </span>
        <h1>Oturum tamamlandı!</h1>
        <p className="muted">{total} kelime çalıştın. Tekrar zamanı gelince sana hatırlatacağız.</p>

        <div className={styles.resultGrid}>
          {RATINGS.slice().reverse().map((r) => (
            <div key={r.tone} className={styles.result} data-tone={r.tone}>
              <strong>{results[r.difficulty]}</strong>
              <span>{r.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.summaryActions}>
          <Link to="/vocabulary" className="btn btn-primary btn-lg btn-block">Kelimelere dön</Link>
          <Link to="/" className="btn btn-ghost btn-block">Hikaye oku</Link>
        </div>
      </div>
    )
  }

  const progress = (index / queue.length) * 100

  return (
    <div className={styles.study}>
      <header className={styles.top}>
        <button className="icon-btn" onClick={close} aria-label="Çalışmayı bitir">
          <X size={22} />
        </button>
        <div className={styles.bar} role="progressbar" aria-valuenow={index} aria-valuemax={queue.length}>
          <div className={styles.barFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.count}>
          {index + 1}/{queue.length}
        </span>
      </header>

      <main className={styles.stage}>
        <div
          key={current.wordId}
          className={styles.card}
          data-flipped={flipped}
          onClick={() => !flipped && setFlipped(true)}
          role={flipped ? undefined : 'button'}
          tabIndex={flipped ? undefined : 0}
          aria-label={flipped ? undefined : 'Kartı çevir'}
        >
          <div className={styles.front}>
            <span className="eyebrow">{flipped ? 'İngilizce' : 'Bu kelimenin anlamı ne?'}</span>
            <div className={styles.wordRow}>
              <h1 className={styles.word}>{current.word}</h1>
              <button
                className="icon-btn icon-btn-soft"
                onClick={(e) => {
                  e.stopPropagation()
                  speak(current.word, { rate: 0.8 })
                }}
                aria-label="Dinle"
              >
                <Volume2 size={20} />
              </button>
            </div>
          </div>

          {flipped && <CardBack info={info} />}

          {!flipped && <span className={styles.tapHint}>Cevabı görmek için dokun</span>}
        </div>
      </main>

      <footer className={styles.actions}>
        {!flipped ? (
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setFlipped(true)}>
            Cevabı göster
          </button>
        ) : (
          <>
            <p className={styles.prompt}>Ne kadar iyi biliyordun?</p>
            <div className={styles.ratings}>
              {RATINGS.map((r) => (
                <button
                  key={r.key}
                  className={styles.rating}
                  data-tone={r.tone}
                  onClick={() => rate(r.difficulty)}
                >
                  <strong>{r.label}</strong>
                  <small>{nextReviewLabel(current.wordId, r.difficulty)}</small>
                </button>
              ))}
            </div>
          </>
        )}
        <p className={styles.keys}>
          {flipped ? 'Kısayol: 1 · 2 · 3' : 'Kısayol: Boşluk tuşu'}
        </p>
      </footer>
    </div>
  )
}

export default Study
