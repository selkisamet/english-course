import { useEffect, useState } from 'react'
import { BookmarkCheck, BookmarkPlus, Volume2, X } from 'lucide-react'
import { analyzeWord, findOxfordWord } from '../utils/api'
import { formatTr, translatePOS, translateTense } from '../utils/format'
import { speak } from '../utils/speech'
import { findWordByText, setWordContext, updateWordProgress } from '../utils/vocabularyStorage'
import styles from './WordPanel.module.css'

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Cümle içinde seçili kelimeyi fosforlu kalemle işaretle
export function HighlightedSentence({ sentence, word }) {
  const parts = sentence.split(new RegExp(`\\b(${escapeRegExp(word)})\\b`, 'i'))
  return parts.map((part, i) =>
    i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
  )
}

// Kelimenin hikayede karşılaşıldığı anlam: kart tekrarında sözlükteki
// genel anlam yerine bu gösterilir
const contextOf = (data, surface) => ({
  translation: data?.translation || '',
  pos: data?.nlp?.pos || '',
  surface,
  sentence: data?.sentence || '',
  sentenceTranslation: data?.contextTranslation || ''
})

function WordPanel({ word, sentence, onClose }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const lemma = (data?.nlp?.root || word).toLowerCase()

  useEffect(() => {
    let active = true
    setStatus('loading')
    setData(null)

    analyzeWord(word, sentence)
      .then((result) => {
        if (!active) return
        setData(result)
        setStatus('done')
      })
      .catch(() => active && setStatus('error'))

    return () => {
      active = false
    }
  }, [word, sentence])

  // Kayıtlı kelimeye tekrar dokunulursa bağlamını güncelle
  // (eski sürümde bağlamsız kaydedilen kelimeler de böylece düzelir)
  useEffect(() => {
    const entry = findWordByText(lemma)
    setSaved(Boolean(entry))
    if (entry && status === 'done' && data?.translation) {
      setWordContext(entry.wordId, contextOf(data, word))
    }
  }, [lemma, status, data, word])

  const handleSave = async () => {
    if (saved || saving) return
    setSaving(true)
    let oxford = null
    try {
      oxford = (await findOxfordWord(lemma)) || (lemma !== word.toLowerCase() && (await findOxfordWord(word)))
    } catch {
      // Ağ hatasında yine de yerel olarak kaydet
    }
    updateWordProgress(oxford?.id || `story:${lemma}`, oxford?.word || lemma, contextOf(data, word))
    setSaved(true)
    setSaving(false)
  }

  const nlp = data?.nlp
  const chips = [
    nlp?.pos && translatePOS(nlp.pos),
    nlp?.tense && translateTense(nlp.tense),
    nlp?.isModal ? 'Modal fiil' : nlp?.isAuxiliary ? 'Yardımcı fiil' : null
  ].filter(Boolean)

  return (
    <div className={styles.panel} role="dialog" aria-label={`${word} kelimesinin anlamı`}>
      <div className={styles.handle} aria-hidden="true" />

      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h2 className={styles.word}>{word}</h2>
          <button className="icon-btn icon-btn-soft" onClick={() => speak(word, { rate: 0.8 })} aria-label="Kelimeyi dinle">
            <Volume2 size={20} />
          </button>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Kapat">
          <X size={20} />
        </button>
      </header>

      <div className={styles.body}>
        {status === 'loading' && (
          <div className={styles.loading}>
            <div className={`skeleton ${styles.skLine}`} style={{ width: '55%' }} />
            <div className={`skeleton ${styles.skBlock}`} />
          </div>
        )}

        {status === 'error' && <p className={styles.error}>Anlam yüklenemedi. Tekrar dene.</p>}

        {status === 'done' && (
          <>
            <p className={styles.translation}>{formatTr(data.translation) || '—'}</p>

            {(chips.length > 0 || (nlp?.root && nlp.root.toLowerCase() !== word.toLowerCase())) && (
              <div className={styles.chips}>
                {chips.map((c) => (
                  <span key={c} className="badge">{c}</span>
                ))}
                {nlp?.root && nlp.root.toLowerCase() !== word.toLowerCase() && (
                  <span className="badge">Kök: {nlp.root}</span>
                )}
              </div>
            )}

            {data.sentence && (
              <section className={styles.context}>
                <div className={styles.contextHead}>
                  <span className="eyebrow">Cümlede</span>
                  <button
                    className="icon-btn"
                    onClick={() => speak(data.sentence, { rate: 0.85 })}
                    aria-label="Cümleyi dinle"
                    title="Cümleyi dinle"
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
                <p className={styles.sentence}>
                  <HighlightedSentence sentence={data.sentence} word={word} />
                </p>
                {data.contextTranslation && (
                  <p className={styles.sentenceTr}>{formatTr(data.contextTranslation)}</p>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <footer className={styles.foot}>
        <button
          className={`btn btn-block ${saved ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleSave}
          disabled={saving || status === 'loading'}
        >
          {saved ? <BookmarkCheck size={18} /> : <BookmarkPlus size={18} />}
          {saved ? 'Kelimelerinde kayıtlı' : 'Kelimelerime ekle'}
        </button>
      </footer>
    </div>
  )
}

export default WordPanel
