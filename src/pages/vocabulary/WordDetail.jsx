import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Layers, Volume2 } from 'lucide-react'
import { fetchWord } from '../../utils/api'
import { capitalize, formatTr, STATUS_LABELS, translatePOS } from '../../utils/format'
import { speak } from '../../utils/speech'
import { getTimeUntilReview } from '../../utils/spacedRepetition'
import { getWordProgress } from '../../utils/vocabularyStorage'
import page from '../../styles/page.module.css'
import styles from './WordDetail.module.css'

function WordDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [word, setWord] = useState(location.state?.word?.id === id ? location.state.word : null)
  const [error, setError] = useState(false)
  const progress = getWordProgress(id)

  useEffect(() => {
    if (word?.id === id) return
    let active = true
    fetchWord(id)
      .then((w) => active && setWord(w))
      .catch(() => active && setError(true))
    return () => {
      active = false
    }
  }, [id])

  const goBack = () => (location.key === 'default' ? navigate('/vocabulary/words') : navigate(-1))

  if (error) {
    return (
      <div className={page.page}>
        <div className={page.empty}>
          <p className={page.emptyTitle}>
            {navigator.onLine ? 'Kelime bulunamadı' : 'Bu kelime çevrimdışı kullanılamıyor'}
          </p>
          {!navigator.onLine && <p>Daha önce açmadığın kelimeler için internet bağlantısı gerekiyor.</p>}
          <Link to="/vocabulary/words" className="btn btn-secondary">Listeye dön</Link>
        </div>
      </div>
    )
  }

  if (!word) {
    return (
      <div className={page.page}>
        <div className="skeleton" style={{ height: 48, width: '50%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    )
  }

  const [main] = word.senses

  return (
    <div className={page.page}>
      <button className={page.backLink} onClick={goBack}>
        <ArrowLeft size={18} /> Geri
      </button>

      <header className={styles.hero}>
        <div className={styles.badges}>
          <span className={`badge badge-${word.level.toLowerCase()}`}>{word.level}</span>
          {progress && (
            <span className={styles.status} data-status={progress.status}>
              {STATUS_LABELS[progress.status]}
            </span>
          )}
        </div>

        <div className={styles.wordRow}>
          <h1 className={styles.word}>{word.word}</h1>
          <button className="icon-btn icon-btn-soft" onClick={() => speak(word.word, { rate: 0.8 })} aria-label="Dinle">
            <Volume2 size={22} />
          </button>
        </div>
        <p className={styles.translation}>{formatTr(main.translation)}</p>
      </header>

      <div className={styles.sections}>
        <section className={styles.section}>
          <h2 className="eyebrow">{word.senses.length > 1 ? `${word.senses.length} anlam` : 'Anlamı'}</h2>
          <ol className={styles.senses}>
            {word.senses.map((sense) => (
              <li key={`${sense.pos}-${sense.homonym || ''}-${sense.note || ''}`} className={styles.sense}>
                <div className={styles.senseHead}>
                  <span className="badge">{translatePOS(sense.pos)}</span>
                  <span className={`badge badge-${sense.level.toLowerCase()}`}>{sense.level}</span>
                </div>
                <p className={styles.senseTr}>{formatTr(sense.translation)}</p>
                <p className={styles.senseDef}>{capitalize(sense.definition)}</p>
                <div className={styles.example}>
                  <div>
                    <p className={styles.exEn}>{sense.example}</p>
                    <p className={styles.exTr}>{formatTr(sense.exampleTranslation)}</p>
                  </div>
                  <button className="icon-btn" onClick={() => speak(sense.example)} aria-label="Örnek cümleyi dinle">
                    <Volume2 size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {progress?.reviewCount > 0 && (
          <section className={styles.section}>
            <h2 className="eyebrow">İlerlemen</h2>
            <dl className={styles.progress}>
              <div>
                <dt>Tekrar</dt>
                <dd>{progress.reviewCount}</dd>
              </div>
              <div>
                <dt>Başarı</dt>
                <dd>{Math.round((progress.correctCount / progress.reviewCount) * 100)}%</dd>
              </div>
              <div>
                <dt>Sıradaki</dt>
                <dd>{getTimeUntilReview(progress.nextReview).description}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>

      <div className={styles.cta}>
        <Link
          to="/vocabulary/study"
          state={{ queue: [{ wordId: word.id, word: word.word }] }}
          className="btn btn-primary btn-lg btn-block"
        >
          <Layers size={18} /> Bu kelimeyi çalış
        </Link>
      </div>
    </div>
  )
}

export default WordDetail
