import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Gauge, Languages, Lightbulb, Play, Square, X } from 'lucide-react'
import WordPanel from '../components/WordPanel'
import { fetchStories, translateText } from '../utils/api'
import { cleanWord, LEVEL_NAMES, readingMinutes, splitSentences, wordCount } from '../utils/format'
import { readAloud } from '../utils/readAloud'
import { canSpeak, speak, stopSpeaking } from '../utils/speech'
import {
  getFlag,
  getReadStories,
  isStoryRead,
  setFlag,
  setLastStoryId,
  toggleStoryRead
} from '../utils/storyProgress'
import page from '../styles/page.module.css'
import styles from './StoryReader.module.css'

const SPEEDS = [
  { rate: 0.65, label: 'Yavaş' },
  { rate: 0.85, label: 'Normal' },
  { rate: 1, label: 'Hızlı' }
]

// Kelimeyi baştaki/sondaki noktalama işaretlerinden ayır
const splitToken = (token) => token.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/).slice(1)

function useStoryText(text) {
  return useMemo(() => {
    if (!text) return { tokens: [], offsets: [], spans: [], sentenceOf: () => '' }

    const tokens = text.split(/\s+/).filter(Boolean)
    let pos = 0
    const offsets = tokens.map((t) => {
      const i = text.indexOf(t, pos)
      pos = i + t.length
      return i
    })

    const sentences = splitSentences(text)
    pos = 0
    const starts = sentences.map((s) => {
      const i = text.indexOf(s, pos)
      pos = i + s.length
      return i
    })

    const sentenceOf = (index) => {
      const offset = offsets[index]
      let found = 0
      starts.forEach((start, j) => {
        if (start <= offset) found = j
      })
      return sentences[found]
    }

    // Sesli okuma için her cümlenin kelime aralığı (yalnızca noktalamadan oluşan parçalar atlanır)
    const spans = sentences
      .map((sentence, j) => {
        const end = starts[j] + sentence.length
        const inside = offsets.map((o, t) => [o, t]).filter(([o]) => o >= starts[j] && o < end)
        return inside.length
          ? { text: sentence, start: starts[j], first: inside[0][1], last: inside[inside.length - 1][1] }
          : null
      })
      .filter(Boolean)

    return { tokens, offsets, spans, sentenceOf }
  }, [text])
}

function StoryReader() {
  const { id } = useParams()
  return <Reader key={id} id={id} />
}

function Reader({ id }) {
  const navigate = useNavigate()
  const [stories, setStories] = useState(null)
  const [error, setError] = useState(false)

  const [selected, setSelected] = useState(null)
  const [speakingIndex, setSpeakingIndex] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const [translation, setTranslation] = useState({ status: 'idle', text: '' })
  const [showTranslation, setShowTranslation] = useState(false)
  const [isRead, setIsRead] = useState(() => isStoryRead(id))
  const [showHint, setShowHint] = useState(() => !getFlag('wordHint'))

  const readerRef = useRef(null)
  const wordRef = useRef(0) // o an okunan kelime (hız değişince buradan devam edilir)
  const restartRef = useRef(null)

  useEffect(() => {
    fetchStories().then(setStories).catch(() => setError(true))
    setLastStoryId(id)
    return () => {
      clearTimeout(restartRef.current)
      readerRef.current?.stop()
      stopSpeaking()
    }
  }, [id])

  const story = stories?.find((s) => s.id === id)
  const { tokens, offsets, spans, sentenceOf } = useStoryText(story?.text)

  const nextStory = useMemo(() => {
    if (!stories || !story) return null
    const read = new Set(getReadStories())
    const sameLevel = stories.filter((s) => s.level === story.level)
    const after = sameLevel.slice(sameLevel.indexOf(story) + 1)
    return after.find((s) => !read.has(s.id)) || after[0] || stories.find((s) => s.id !== id && !read.has(s.id))
  }, [stories, story, id, isRead])

  // ---------- Kelime seçimi ----------

  const selectIndex = useCallback(
    (index) => {
      const word = cleanWord(tokens[index] || '')
      if (!word) return false
      setSelected({ index, word, sentence: sentenceOf(index) })
      return true
    },
    [tokens, sentenceOf]
  )

  const handleWordClick = (index) => {
    if (isPlaying) stopPlayback()
    if (selectIndex(index) && showHint) {
      setShowHint(false)
      setFlag('wordHint')
    }
  }

  // Ok tuşlarıyla önceki/sonraki kelime, Esc ile kapat
  useEffect(() => {
    if (!selected) return

    const onKey = (e) => {
      if (e.key === 'Escape') return setSelected(null)
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      e.preventDefault()
      const step = e.key === 'ArrowRight' ? 1 : -1
      for (let i = selected.index + step; i >= 0 && i < tokens.length; i += step) {
        if (selectIndex(i)) {
          speak(cleanWord(tokens[i]), { rate: 0.85 })
          break
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, tokens, selectIndex])

  // ---------- Sesli okuma ----------

  const stopPlayback = () => {
    clearTimeout(restartRef.current)
    readerRef.current?.stop()
    readerRef.current = null
    setIsPlaying(false)
    setSpeakingIndex(null)
  }

  const startPlayback = ({ speedIndex = speed, from = 0 } = {}) => {
    readerRef.current?.stop()
    wordRef.current = from
    const reader = readAloud({
      sentences: spans,
      offsets,
      rate: SPEEDS[speedIndex].rate,
      startIndex: from,
      onWord: (index) => {
        wordRef.current = index
        setSpeakingIndex(index)
      },
      onDone: () => {
        if (readerRef.current !== reader) return
        readerRef.current = null
        setIsPlaying(false)
        setSpeakingIndex(null)
      }
    })
    readerRef.current = reader
    setIsPlaying(true)
    setSelected(null)
  }

  // Hız okuma sırasında da değiştirilebilir: ses motoru hızı anlık değiştiremediği için
  // okuma kesilip o an okunan kelimeden yeni hızla sürdürülür
  const cycleSpeed = () => {
    const next = (speed + 1) % SPEEDS.length
    setSpeed(next)
    if (!isPlaying) return

    const from = wordRef.current
    readerRef.current?.stop()
    readerRef.current = null
    // Bazı mobil tarayıcılar iptalden hemen sonraki okumayı yutuyor; kısa bir ara ver
    clearTimeout(restartRef.current)
    restartRef.current = setTimeout(() => startPlayback({ speedIndex: next, from }), 120)
  }

  // ---------- Çeviri ve tamamlama ----------

  const handleTranslation = async () => {
    const next = !showTranslation
    setShowTranslation(next)
    if (!next || translation.status === 'done' || translation.status === 'loading') return

    setTranslation({ status: 'loading', text: '' })
    try {
      setTranslation({ status: 'done', text: await translateText(story.text) })
    } catch {
      setTranslation({ status: 'error', text: '' })
    }
  }

  const handleToggleRead = () => {
    setIsRead(toggleStoryRead(id))
  }

  // ---------- Görünüm ----------

  if (error || (stories && !story)) {
    return (
      <div className={page.page}>
        <div className={page.empty}>
          <p className={page.emptyTitle}>{error ? 'Hikaye yüklenemedi' : 'Hikaye bulunamadı'}</p>
          <Link to="/" className="btn btn-secondary">Hikayelere dön</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.reader} data-panel={Boolean(selected)}>
      <header className={styles.topbar}>
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Hikayelere dön">
          <ArrowLeft size={22} />
        </button>
        <span className={styles.topTitle}>{story?.title}</span>
        {story && <span className={`badge badge-${story.level.toLowerCase()}`}>{story.level}</span>}
      </header>

      <div className={styles.layout}>
        <article className={styles.article}>
          {!story ? (
            <div className={styles.loading}>
              <div className="skeleton" style={{ height: 36, width: '70%' }} />
              <div className="skeleton" style={{ height: 220 }} />
            </div>
          ) : (
            <>
              <header className={styles.head}>
                <p className="eyebrow">
                  {story.level} · {LEVEL_NAMES[story.level]} · {wordCount(story.text)} kelime ·{' '}
                  {readingMinutes(story.text)} dk
                </p>
                <h1 className={styles.title}>{story.title}</h1>
              </header>

              <div className={styles.toolbar}>
                {canSpeak && (
                  <>
                    <button
                      className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={isPlaying ? stopPlayback : () => startPlayback()}
                    >
                      {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                      {isPlaying ? 'Durdur' : 'Dinle'}
                    </button>
                    <button className="btn btn-ghost" onClick={cycleSpeed} aria-label="Okuma hızı">
                      <Gauge size={18} />
                      {SPEEDS[speed].label}
                    </button>
                  </>
                )}
                <button
                  className={`btn btn-ghost ${styles.toggle}`}
                  onClick={handleTranslation}
                  aria-pressed={showTranslation}
                  title={showTranslation ? 'Çeviriyi gizle' : 'Türkçe çeviriyi göster'}
                >
                  <Languages size={18} />
                  Türkçe
                </button>
              </div>

              {showHint && (
                <div className={styles.hint}>
                  <Lightbulb size={18} />
                  <p>Bilmediğin bir kelimeye dokun: anlamını ve cümledeki kullanımını gör.</p>
                  <button
                    className={styles.hintClose}
                    onClick={() => {
                      setShowHint(false)
                      setFlag('wordHint')
                    }}
                    aria-label="İpucunu kapat"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <p className={styles.text}>
                {tokens.map((token, index) => {
                  const [before, core, after] = splitToken(token)
                  const state =
                    selected?.index === index ? 'selected' : speakingIndex === index ? 'speaking' : undefined
                  return (
                    <span key={index}>
                      {before}
                      {core && (
                        <span
                          className={styles.word}
                          data-state={state}
                          onClick={() => handleWordClick(index)}
                        >
                          {core}
                        </span>
                      )}
                      {after}{' '}
                    </span>
                  )
                })}
              </p>

              {showTranslation && (
                <section className={styles.translation} aria-live="polite">
                  <p className="eyebrow">Türkçe çeviri</p>
                  {translation.status === 'loading' && <div className="skeleton" style={{ height: 96 }} />}
                  {translation.status === 'error' && (
                    <p className={styles.errorText}>
                      {navigator.onLine
                        ? 'Çeviri yapılamadı. Biraz sonra tekrar dene.'
                        : 'İnternet bağlantısı yok. Çeviri için bağlantı gerekiyor.'}
                    </p>
                  )}
                  {translation.status === 'done' && <p>{translation.text}</p>}
                </section>
              )}

              <footer className={styles.finish}>
                <button
                  className={`btn btn-lg ${isRead ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={handleToggleRead}
                >
                  <Check size={18} strokeWidth={3} />
                  {isRead ? 'Okundu' : 'Hikayeyi bitirdim'}
                </button>
                {isRead && nextStory && (
                  <Link to={`/story/${nextStory.id}`} className={styles.next}>
                    <span>
                      <span className="eyebrow">Sıradaki hikaye</span>
                      <strong>{nextStory.title}</strong>
                    </span>
                    <ArrowRight size={20} />
                  </Link>
                )}
              </footer>
            </>
          )}
        </article>

        <aside className={styles.aside}>
          {selected ? (
            <WordPanel
              key={`${selected.index}-${selected.word}`}
              word={selected.word}
              sentence={selected.sentence}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className={styles.asideEmpty}>
              <Lightbulb size={22} />
              <p>Anlamını görmek için metinde bir kelimeye tıkla.</p>
              <small>İpucu: ← → tuşlarıyla kelimeler arasında gezinebilirsin.</small>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default StoryReader
