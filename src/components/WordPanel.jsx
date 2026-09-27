import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookmarkCheck, BookmarkPlus, Volume2, X } from 'lucide-react'
import { analyzeWord, findOxfordWord } from '../utils/api'
import { formatTr, translatePOS } from '../utils/format'
import { speak } from '../utils/speech'
import { findWordByText, setWordContext, updateWordProgress } from '../utils/vocabularyStorage'
import styles from './WordPanel.module.css'

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Cümle içinde seçili kelimeyi (ya da kalıbı) fosforlu kalemle işaretle
export function HighlightedSentence({ sentence, word }) {
  const parts = sentence.split(new RegExp(`\\b(${escapeRegExp(word)})\\b`, 'i'))
  return parts.map((part, i) =>
    i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
  )
}

// İşaretleme notlarındaki *eğik* ve **kalın** yazımı
export function RichText({ text }) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>
    return <span key={i}>{part}</span>
  })
}

function SentenceBlock({ sentence, translation, highlight }) {
  if (!sentence) return null
  return (
    <section className={styles.context}>
      <div className={styles.contextHead}>
        <span className="eyebrow">Cümle</span>
        <button
          className="icon-btn"
          onClick={() => speak(sentence, { rate: 0.85 })}
          aria-label="Cümleyi dinle"
          title="Cümleyi dinle"
        >
          <Volume2 size={18} />
        </button>
      </div>
      <p className={styles.sentence}>
        <HighlightedSentence sentence={sentence} word={highlight} />
      </p>
      {translation && <p className={styles.sentenceTr}>{formatTr(translation)}</p>}
    </section>
  )
}

// ---------- Doğrulanmış işaretleme: temel anlam + bu cümledeki anlam ----------

function AnnotatedMeaning({ word, token, sentence, sentenceTr }) {
  const { base, lemma, pos, context, note, form, phrase } = token
  const isName = pos === 'proper noun'

  return (
    <>
      {form && (
        <p className={styles.form}>
          {lemma.toLowerCase() !== word.toLowerCase() && (
            <>
              <strong>{word}</strong> → <strong>{lemma}</strong> ·{' '}
            </>
          )}
          {form}
        </p>
      )}

      {isName ? (
        <div className={styles.meanings}>
          <div className={styles.meaning}>
            <span className="eyebrow">Özel isim</span>
            <p className={styles.meaningText}>{formatTr(base.translation)}</p>
          </div>
        </div>
      ) : (
        <div className={styles.meanings}>
          <div className={styles.meaning}>
            <span className="eyebrow">Temel anlamı</span>
            <p className={styles.meaningText}>{formatTr(base.translation)}</p>
            <span className={styles.meaningMeta}>
              {translatePOS(base.pos || pos)}
              {base.level && <span className={`badge badge-${base.level.toLowerCase()}`}>{base.level}</span>}
            </span>
          </div>
          <div className={`${styles.meaning} ${styles.meaningContext}`}>
            <span className="eyebrow">Bu cümlede</span>
            <p className={styles.meaningText}>{context}</p>
            <span className={styles.meaningMeta}>{translatePOS(pos)}</span>
          </div>
        </div>
      )}

      {note && (
        <p className={styles.note}>
          <RichText text={note} />
        </p>
      )}

      {phrase && (
        <div className={styles.phrase}>
          <span className="eyebrow">Kalıp</span>
          <p>
            <strong>{phrase.text}</strong> = {phrase.meaning}
          </p>
        </div>
      )}

      {base.wordId && base.senseCount > 1 && (
        <Link to={`/vocabulary/words/${base.wordId}`} className={styles.allSenses}>
          <em>{base.word}</em> kelimesinin tüm anlamları ({base.senseCount}) <ArrowRight size={14} />
        </Link>
      )}

      <SentenceBlock sentence={sentence} translation={sentenceTr} highlight={phrase?.text || word} />
    </>
  )
}

// ---------- İşaretlemesi olmayan hikaye: otomatik çeviri ----------

function AutoMeaning({ word, data }) {
  return (
    <>
      <div className={styles.meanings}>
        <div className={`${styles.meaning} ${styles.meaningContext}`}>
          <span className="eyebrow">Bu cümlede</span>
          <p className={styles.meaningText}>{formatTr(data.translation) || '—'}</p>
          <span className={styles.meaningMeta}>
            <span className={styles.autoTag}>Otomatik çeviri</span>
          </span>
        </div>
      </div>
      <SentenceBlock sentence={data.sentence} translation={data.contextTranslation} highlight={word} />
    </>
  )
}

function WordPanel({ word, sentence, annotation, sentenceTr, onClose }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState(annotation ? 'done' : 'loading')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const lemma = (annotation?.lemma || data?.nlp?.root || word).toLowerCase()

  // Hikayede karşılaşılan anlam; kart tekrarında temel anlamla birlikte gösterilir
  const storyContext = annotation
    ? {
        translation: annotation.context,
        base: annotation.base.translation,
        pos: annotation.pos,
        note: annotation.note,
        surface: annotation.phrase?.text || word,
        sentence,
        sentenceTranslation: sentenceTr
      }
    : {
        translation: data?.translation || '',
        base: null,
        note: null,
        pos: '',
        surface: word,
        sentence: data?.sentence || '',
        sentenceTranslation: data?.contextTranslation || ''
      }

  useEffect(() => {
    if (annotation) return
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
  }, [word, sentence, annotation])

  // Kayıtlı kelimeye tekrar dokunulursa bağlamını güncelle
  useEffect(() => {
    const entry = findWordByText(lemma)
    setSaved(Boolean(entry))
    if (entry && status === 'done' && storyContext.translation) {
      setWordContext(entry.wordId, storyContext)
    }
  }, [lemma, status, data])

  const handleSave = async () => {
    if (saved || saving) return
    setSaving(true)
    let id = annotation?.base.wordId || null
    let entryWord = annotation?.base.word || lemma
    if (!annotation) {
      try {
        const oxford = (await findOxfordWord(lemma)) || (lemma !== word.toLowerCase() && (await findOxfordWord(word)))
        id = oxford?.id || null
        entryWord = oxford?.word || lemma
      } catch {
        // Ağ hatasında yine de yerel olarak kaydet
      }
    }
    updateWordProgress(id || `story:${lemma}`, entryWord, storyContext)
    setSaved(true)
    setSaving(false)
  }

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

        {status === 'error' && (
          <p className={styles.error}>
            {navigator.onLine
              ? 'Anlam yüklenemedi. Tekrar dene.'
              : 'İnternet bağlantısı yok. Kelime anlamları için bağlantı gerekiyor.'}
          </p>
        )}

        {status === 'done' &&
          (annotation ? (
            <AnnotatedMeaning word={word} token={annotation} sentence={sentence} sentenceTr={sentenceTr} />
          ) : (
            <AutoMeaning word={word} data={data} />
          ))}
      </div>

      <footer className={styles.foot}>
        <button
          className={`btn btn-block ${saved ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleSave}
          disabled={saving || status !== 'done'}
        >
          {saved ? <BookmarkCheck size={18} /> : <BookmarkPlus size={18} />}
          {saved ? 'Kelimelerinde kayıtlı' : 'Kelimelerime ekle'}
        </button>
      </footer>
    </div>
  )
}

export default WordPanel
