import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Layers, Search, X } from 'lucide-react'
import { fetchWords } from '../../utils/api'
import { formatTr, STATUS_LABELS, translatePOS, VOCAB_LEVELS } from '../../utils/format'
import { getProgress } from '../../utils/vocabularyStorage'
import page from '../../styles/page.module.css'
import styles from './WordList.module.css'

const PAGE_SIZE = 20

function WordList() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const level = params.get('level') || 'all'
  const query = params.get('q') || ''
  const pageNo = Number(params.get('page')) || 1

  const [input, setInput] = useState(query)
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  const progress = useMemo(() => getProgress().words || {}, [])

  const update = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([key, value]) => {
      if (!value || value === 'all' || (key === 'page' && value === 1)) next.delete(key)
      else next.set(key, value)
    })
    setParams(next, { replace: true })
  }

  // Aramayı yazarken değil, kısa bir duraklamadan sonra uygula
  useEffect(() => {
    if (input === query) return
    const t = setTimeout(() => update({ q: input.trim(), page: 1 }), 250)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => {
    let active = true
    setError(false)
    fetchWords({
      page: pageNo,
      limit: PAGE_SIZE,
      ...(level !== 'all' && { level }),
      ...(query && { search: query })
    })
      .then((d) => active && setData(d))
      .catch(() => active && setError(true))
    return () => {
      active = false
    }
  }, [level, query, pageNo, retry])

  const studyPage = () => {
    const queue = data.words.map((w) => ({ wordId: w.id, word: w.word }))
    navigate('/vocabulary/study', { state: { queue } })
  }

  return (
    <div className={page.page}>
      <Link to="/vocabulary" className={page.backLink}>
        <ArrowLeft size={18} /> Kelimeler
      </Link>

      <header className={page.header}>
        <h1 className={page.title}>Kelime listesi</h1>
        {data && <p className={page.subtitle}>{data.total} kelime</p>}
      </header>

      <div className={styles.controls}>
        <label className={styles.search}>
          <Search size={18} />
          <span className="sr-only">Kelime ara</span>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="İngilizce kelime ara…"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
          />
          {input && (
            <button onClick={() => setInput('')} aria-label="Aramayı temizle">
              <X size={16} />
            </button>
          )}
        </label>

        <div className="chip-row" role="group" aria-label="Seviye filtresi">
          {['all', ...VOCAB_LEVELS].map((l) => (
            <button
              key={l}
              className="chip"
              aria-pressed={level === l}
              onClick={() => update({ level: l, page: 1 })}
            >
              {l === 'all' ? 'Tümü' : l}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className={page.empty}>
          <p className={page.emptyTitle}>Kelimeler yüklenemedi</p>
          <button className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>Tekrar dene</button>
        </div>
      ) : !data ? (
        <div className={styles.list}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`skeleton ${styles.rowSkeleton}`} />
          ))}
        </div>
      ) : data.words.length === 0 ? (
        <div className={page.empty}>
          <p className={page.emptyTitle}>Sonuç yok</p>
          <p>Farklı bir kelime ya da seviye dene.</p>
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {data.words.map((word) => {
              const status = progress[word.id]?.status
              // Seviye filtresi varsa o seviyedeki anlamı öne çıkar
              const sense = word.senses.find((s) => s.level === level) || word.senses[0]
              const posList = [...new Set(word.senses.map((s) => translatePOS(s.pos)))].join(', ')
              return (
                <li key={word.id}>
                  <Link to={`/vocabulary/words/${word.id}`} state={{ word }} className={styles.row}>
                    <span className={styles.main}>
                      <span className={styles.word}>
                        {word.word}
                        <span className={styles.pos}>{posList}</span>
                      </span>
                      <span className={styles.tr}>{formatTr(sense.translation)}</span>
                    </span>
                    {status && (
                      <span className={styles.status} data-status={status} title={STATUS_LABELS[status]}>
                        {STATUS_LABELS[status]}
                      </span>
                    )}
                    <span className={`badge badge-${sense.level.toLowerCase()}`}>{sense.level}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className={styles.footer}>
            <button className="btn btn-secondary" onClick={studyPage}>
              <Layers size={18} /> Bu sayfayı çalış
            </button>

            {data.totalPages > 1 && (
              <nav className={styles.pager} aria-label="Sayfalar">
                <button
                  className="icon-btn"
                  onClick={() => update({ page: pageNo - 1 })}
                  disabled={pageNo <= 1}
                  aria-label="Önceki sayfa"
                >
                  <ChevronLeft size={20} />
                </button>
                <span>
                  {pageNo} / {data.totalPages}
                </span>
                <button
                  className="icon-btn"
                  onClick={() => update({ page: pageNo + 1 })}
                  disabled={pageNo >= data.totalPages}
                  aria-label="Sonraki sayfa"
                >
                  <ChevronRight size={20} />
                </button>
              </nav>
            )}
          </div>
        </>
      )}

      <p className={styles.source}>
        Kelime listesi, türler ve seviyeler: The Oxford 3000™ (Oxford University Press).
      </p>
    </div>
  )
}

export default WordList
