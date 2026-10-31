import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Languages, Lightbulb, Pause, Play, RotateCcw, RotateCw, Sparkles, Target, X } from 'lucide-react'
import Sheet, { SheetRow } from '../components/Sheet'
import Switch from '../components/Switch'
import WordPanel from '../components/WordPanel'
import { fetchAnnotations, fetchStories, fetchStoryAudio, translateText } from '../utils/api'
import { cleanWord, LEVEL_NAMES, readingMinutes, wordCount } from '../utils/format'
import { analyzeStoryText } from '../utils/storyText'
import { entryIdOf, PREP_MIN, prepWords, quizWords, storyWords, studiedIds, toStudyState } from '../utils/storyWords'
import { readAloud } from '../utils/readAloud'
import { canSpeak, speak, stopSpeaking } from '../utils/speech'
import { playStoryAudio } from '../utils/storyAudioPlayer'
import { updateWordProgress } from '../utils/vocabularyStorage'
import {
  getFlag,
  getReadStories,
  getShowStudied,
  isPrepSkipped,
  setShowStudied,
  skipPrep,
  getStoryVoice,
  getTextSize,
  isStoryRead,
  setFlag,
  setLastStoryId,
  setStoryVoice,
  setTextSize,
  TEXT_SIZES,
  toggleStoryRead
} from '../utils/storyProgress'
import page from '../styles/page.module.css'
import styles from './StoryReader.module.css'

// rate: cihaz sesi, audioRate: önceden üretilmiş seslendirme (doğal konuşma hızında kaydedildi)
const SPEEDS = [
  { rate: 0.65, audioRate: 0.75, label: 'Yavaş' },
  { rate: 0.85, audioRate: 0.9, label: 'Normal' },
  { rate: 1, audioRate: 1, label: 'Hızlı' }
]

const VOICE_LABELS = { female: 'Kadın', male: 'Erkek' }
const TEXT_SIZE_LABELS = { small: 'Küçük', medium: 'Normal', large: 'Büyük' }

// Kelimeyi baştaki/sondaki noktalama işaretlerinden ayır
const splitToken = (token) => token.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/).slice(1)

const useStoryText = (text) => useMemo(() => analyzeStoryText(text), [text])

function StoryReader() {
  const { id } = useParams()
  return <Reader key={id} id={id} />
}

function Reader({ id }) {
  const navigate = useNavigate()
  const [stories, setStories] = useState(null)
  const [error, setError] = useState(false)

  const [annotations, setAnnotations] = useState(null)
  const [selected, setSelected] = useState(null)
  const [speakingIndex, setSpeakingIndex] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [storyAudio, setStoryAudio] = useState(null)
  const [voice, setVoice] = useState(getStoryVoice)
  const [position, setPosition] = useState(0) // durdurulunca kalınan kelime

  const [translation, setTranslation] = useState({ status: 'idle', text: '' })
  const [showTranslation, setShowTranslation] = useState(false)
  const [isRead, setIsRead] = useState(() => isStoryRead(id))
  const [showHint, setShowHint] = useState(() => !getFlag('wordHint'))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [textSize, setTextSizeState] = useState(getTextSize)
  const [scrolled, setScrolled] = useState(0)

  const readerRef = useRef(null)
  const translationRef = useRef(null)
  const wordRef = useRef(0) // o an okunan kelime (hız değişince buradan devam edilir)
  const restartRef = useRef(null)

  useEffect(() => {
    fetchStories().then(setStories).catch(() => setError(true))
    fetchAnnotations(id).then(setAnnotations)
    setStoryAudio(null)
    fetchStoryAudio(id).then(setStoryAudio)
    setLastStoryId(id)
    return () => {
      clearTimeout(restartRef.current)
      readerRef.current?.stop()
      stopSpeaking()
    }
  }, [id])

  // Sayfanın ne kadarının okunduğu (üst çubuktaki ince çizgi)
  useEffect(() => {
    let frame = null
    const update = () => {
      frame = null
      const max = document.documentElement.scrollHeight - window.innerHeight
      setScrolled(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])

  const story = stories?.find((s) => s.id === id)
  const storyText = useStoryText(story?.text)
  const { tokens, offsets, spans, sentenceOf, sentenceIndexOf } = storyText
  // İşaretleme metinle uyuşmuyorsa (ör. kelime sayısı farklı) kullanılmaz
  const annotation = annotations?.tokens?.length === tokens.length ? annotations : null
  // Seslendirme de kelime sayısı tutuyorsa kullanılır; yoksa cihazın sesi okur
  const audioVoices = useMemo(() => {
    const voices = storyAudio?.storyId === id ? storyAudio.voices : null
    return Object.fromEntries(Object.entries(voices || {}).filter(([, v]) => v.starts?.length === tokens.length))
  }, [storyAudio, id, tokens.length])
  const voiceKeys = Object.keys(VOICE_LABELS).filter((k) => audioVoices[k])
  const activeVoice = audioVoices[voice] ? voice : voiceKeys[0]
  const canListen = canSpeak || voiceKeys.length > 0

  const words = useMemo(() => (annotation ? storyWords(annotation, storyText) : []), [annotation, storyText])
  const prep = useMemo(() => (story ? prepWords(words, story.level) : []), [words, story])
  const quiz = useMemo(() => (story && isRead ? quizWords(words, story.level) : []), [words, story, isRead])
  const studied = useMemo(() => studiedIds(words), [words])
  const [prepSkipped, setPrepSkipped] = useState(() => isPrepSkipped(id))
  const [showStudied, setShowStudiedState] = useState(getShowStudied)
  const showPrep = !isRead && !prepSkipped && prep.length >= PREP_MIN

  // Her kelimenin ilerleme kaydındaki kimliği (yalnızca çalışılabilen kelimeler)
  const idAt = useMemo(() => {
    const ids = new Set(words.map((w) => w.wordId))
    return (annotation?.tokens || []).map((t) => (t?.lemma && ids.has(entryIdOf(t)) ? entryIdOf(t) : null))
  }, [annotation, words])

  // Kelime sayfasından gelindiyse o kelime vurgulanır
  const [searchParams] = useSearchParams()
  const focusWord = searchParams.get('word')
  const focusIndexes = useMemo(
    () => (focusWord && annotation ? annotation.tokens.map((t, i) => (t?.base?.wordId === focusWord ? i : -1)).filter((i) => i >= 0) : []),
    [focusWord, annotation]
  )
  useEffect(() => {
    if (!focusIndexes.length) return
    document.querySelector(`[data-token="${focusIndexes[0]}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusIndexes])

  // Seçili kelimenin cümlesinin seslendirmedeki kelime aralığı
  const sentenceRef = (index) => {
    const span = spans.find((sp) => sp.first <= index && index <= sp.last)
    return span ? { storyId: id, from: span.first, to: span.last } : null
  }

  const startPrep = () => {
    // Kelimeler hikayedeki bağlamlarıyla kaydedilir; tanıtım kartında bu cümle görünür
    prep.forEach((w) => updateWordProgress(w.wordId, w.word, w.context))
    // Hikayeye bir kez hazırlanıldı: kart bu hikayede yeniden gösterilmez
    skipPrep(id)
    navigate('/vocabulary/study', {
      state: { mode: 'prep', ...toStudyState(prep), story: { id: story.id, title: story.title } }
    })
  }

  const handleSkipPrep = () => {
    skipPrep(id)
    setPrepSkipped(true)
  }

  const startQuiz = () => {
    navigate('/vocabulary/study', {
      state: {
        mode: 'quiz',
        ...toStudyState(quiz),
        story: { id: story.id, title: story.title, next: nextStory ? { id: nextStory.id, title: nextStory.title } : null }
      }
    })
  }

  const toggleStudied = () => {
    setShowStudied(!showStudied)
    setShowStudiedState(!showStudied)
  }

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
    setPosition(wordRef.current)
  }

  const startPlayback = ({ speedIndex = speed, from = 0, voiceKey = activeVoice, deviceOnly = false } = {}) => {
    readerRef.current?.stop()
    wordRef.current = from
    const onWord = (index) => {
      wordRef.current = index
      setSpeakingIndex(index)
    }
    const finish = (reader) => {
      if (readerRef.current !== reader) return
      readerRef.current = null
      setIsPlaying(false)
      setSpeakingIndex(null)
      // Sona gelindi: bir sonraki "Dinle" baştan başlar
      wordRef.current = 0
      setPosition(0)
    }

    const recorded = !deviceOnly && audioVoices[voiceKey]
    if (!recorded && !canSpeak) return

    const reader = recorded
      ? playStoryAudio({
          url: recorded.url,
          starts: recorded.starts,
          rate: SPEEDS[speedIndex].audioRate,
          startIndex: from,
          onWord,
          onDone: () => finish(reader),
          // Ses dosyası açılamadıysa (ör. çevrimdışı) cihazın sesiyle oku
          onError: () => {
            if (readerRef.current !== reader) return
            if (canSpeak) startPlayback({ speedIndex, from: wordRef.current, deviceOnly: true })
            else finish(reader)
          }
        })
      : readAloud({
          sentences: spans,
          offsets,
          rate: SPEEDS[speedIndex].rate,
          startIndex: from,
          onWord,
          onDone: () => finish(reader)
        })
    readerRef.current = reader
    setIsPlaying(true)
    setSelected(null)
  }

  // Okumayı başka bir kelimeden sürdürür. Cihaz sesi için okuma kesilip kısa bir aradan sonra
  // yeniden başlatılır: bazı mobil tarayıcılar iptalden hemen sonraki okumayı yutuyor.
  const restartFrom = (from, options = {}) => {
    const recorded = Boolean(readerRef.current?.setRate)
    if (recorded || !readerRef.current) return startPlayback({ ...options, from })
    readerRef.current.stop()
    readerRef.current = null
    clearTimeout(restartRef.current)
    restartRef.current = setTimeout(() => startPlayback({ ...options, from }), 120)
  }

  // Hız okuma sırasında da değiştirilebilir: kayıtlı seslendirmede kesmeden, cihaz sesinde
  // o an okunan kelimeden yeni hızla sürdürülerek
  const changeSpeed = (next) => {
    setSpeed(next)
    if (!isPlaying) return
    if (readerRef.current?.setRate) return readerRef.current.setRate(SPEEDS[next].audioRate)
    restartFrom(wordRef.current, { speedIndex: next })
  }

  // Okuma sürerken ses değişirse aynı kelimeden yeni sesle devam edilir
  const changeVoice = (next) => {
    setVoice(next)
    setStoryVoice(next)
    if (isPlaying && readerRef.current?.setRate) startPlayback({ from: wordRef.current, voiceKey: next })
  }

  // Önceki / sonraki cümle. Geri: cümlenin ortasındaysa o cümlenin başına, başındaysa öncekine.
  const skipSentence = (step) => {
    if (!spans.length) return
    const current = Math.max(0, spans.findIndex((sp) => sp.first <= wordRef.current && wordRef.current <= sp.last))
    let target = current + step
    if (step < 0 && wordRef.current > spans[current].first + 1) target = current
    target = Math.min(spans.length - 1, Math.max(0, target))
    if (isPlaying) restartFrom(spans[target].first)
    else startPlayback({ from: spans[target].first })
  }

  const changeTextSize = (next) => {
    setTextSizeState(next)
    setTextSize(next)
  }

  // ---------- Çeviri ve tamamlama ----------

  const handleTranslation = async () => {
    const next = !showTranslation
    setShowTranslation(next)
    // Çeviri metnin altında açılır; düğme üst çubukta olduğu için oraya kaydırılır
    if (next) setTimeout(() => translationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)

    if (!next || translation.status === 'done' || translation.status === 'loading') return

    // Doğrulanmış cümle çevirileri varsa onları kullan
    if (annotation) {
      setTranslation({ status: 'done', text: annotation.sentences.map((s) => s.tr).join(' ') })
      return
    }

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

  // Oynatıcıdaki ilerleme: okunan kelime ya da durdurulunca kalınan yer
  const listenedWords = isPlaying ? (speakingIndex ?? wordRef.current) + 1 : position
  const listened = tokens.length ? Math.min(1, listenedWords / tokens.length) : 0

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
        <span className={styles.topText}>
          <span className={styles.topTitle}>{story?.title}</span>
          {story && (
            <span className={styles.topMeta}>
              {story.level} · {LEVEL_NAMES[story.level]}
            </span>
          )}
        </span>
        <button
          className={`icon-btn ${styles.topToggle}`}
          onClick={handleTranslation}
          aria-pressed={showTranslation}
          aria-label={showTranslation ? 'Türkçe çeviriyi gizle' : 'Türkçe çeviriyi göster'}
          title="Türkçe çeviri"
          disabled={!story}
        >
          <Languages size={21} />
        </button>
        <button
          className={`icon-btn ${styles.aa}`}
          onClick={() => setSettingsOpen(true)}
          aria-label="Görünüm ve ses ayarları"
          title="Görünüm ve ses ayarları"
        >
          Aa
        </button>
        <span className={styles.scrollBar} aria-hidden="true">
          <span style={{ transform: `scaleX(${scrolled})` }} />
        </span>
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

              {showPrep && (
                <section className={styles.prep} aria-label="Okumadan önce">
                  <p className={styles.prepEyebrow}>
                    <Sparkles size={16} /> Okumadan önce
                  </p>
                  <p className={styles.prepTitle}>Bu hikayede henüz çalışmadığın {prep.length} kelime var.</p>
                  <ul className={styles.prepWords}>
                    {prep.map((w) => (
                      <li key={w.wordId}>
                        {w.word}
                        {w.level && <small>{w.level}</small>}
                      </li>
                    ))}
                  </ul>
                  <div className={styles.prepActions}>
                    <button className="btn btn-primary" onClick={startPrep}>
                      Önce kelimeleri çalış · 1 dk
                    </button>
                    <button className={`btn ${styles.prepSkip}`} onClick={handleSkipPrep}>
                      Atla
                    </button>
                  </div>
                </section>
              )}

              {showHint && (
                <div className={styles.hint}>
                  <Lightbulb size={17} />
                  <p>Bilmediğin bir kelimeye dokun: anlamı ve sesi açılır.</p>
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

              <p className={styles.text} data-size={textSize}>
                {tokens.map((token, index) => {
                  const [before, core, after] = splitToken(token)
                  const phrase = selected && annotation?.tokens[selected.index]?.phrase
                  const inSelection =
                    selected?.index === index || (phrase && index >= phrase.from && index <= phrase.to)
                  const state = inSelection
                    ? 'selected'
                    : speakingIndex === index
                      ? 'speaking'
                      : focusIndexes.includes(index)
                        ? 'focus'
                        : undefined
                  const known = showStudied && idAt[index] && studied.has(idAt[index])
                  return (
                    <span key={index}>
                      {before}
                      {core && (
                        <span
                          className={styles.word}
                          data-state={state}
                          data-known={known || undefined}
                          data-token={index}
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
                <section ref={translationRef} className={styles.translation} aria-live="polite">
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
                {isRead && quiz.length > 0 && (
                  <section className={styles.quizCard} aria-label="Mini test">
                    <span className={styles.quizIcon}>
                      <Target size={20} />
                    </span>
                    <div>
                      <p className={styles.quizTitle}>Kelimeleri pekiştir</p>
                      <p className={styles.quizText}>Bu hikayenin cümleleriyle {quiz.length} soru · 1 dk</p>
                    </div>
                    <button className={`btn btn-block ${styles.quizStart}`} onClick={startQuiz}>
                      Mini teste başla
                    </button>
                  </section>
                )}
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

              {canListen && (
                <section className={styles.player} aria-label="Sesli okuma">
                  <span className={styles.playerBar} aria-hidden="true">
                    <span style={{ transform: `scaleX(${listened})` }} />
                  </span>
                  <div className={styles.playerControls}>
                    <button
                      className={styles.playerChip}
                      onClick={() => changeSpeed((speed + 1) % SPEEDS.length)}
                      aria-label={`Okuma hızı: ${SPEEDS[speed].label}`}
                    >
                      {SPEEDS[speed].label}
                    </button>
                    <div className={styles.playerMain}>
                      <button className={styles.playerSkip} onClick={() => skipSentence(-1)} aria-label="Önceki cümle">
                        <RotateCcw size={22} />
                      </button>
                      <button
                        className={styles.playerPlay}
                        onClick={isPlaying ? stopPlayback : () => startPlayback({ from: position })}
                        aria-label={isPlaying ? 'Duraklat' : position > 0 ? 'Devam et' : 'Dinle'}
                      >
                        {isPlaying ? <Pause size={24} fill="currentColor" strokeWidth={0} /> : <Play size={24} fill="currentColor" strokeWidth={0} />}
                      </button>
                      <button className={styles.playerSkip} onClick={() => skipSentence(1)} aria-label="Sonraki cümle">
                        <RotateCw size={22} />
                      </button>
                    </div>
                    {voiceKeys.length > 1 ? (
                      <button
                        className={styles.playerChip}
                        onClick={() => changeVoice(voiceKeys[(voiceKeys.indexOf(activeVoice) + 1) % voiceKeys.length])}
                        aria-label={`Okuyan ses: ${VOICE_LABELS[activeVoice]}`}
                      >
                        {VOICE_LABELS[activeVoice]}
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </article>

        <aside className={styles.aside}>
          {selected ? (
            <WordPanel
              key={`${selected.index}-${selected.word}`}
              word={selected.word}
              sentence={selected.sentence}
              annotation={annotation?.tokens[selected.index] || null}
              sentenceTr={annotation?.sentences[sentenceIndexOf(selected.index)]?.tr}
              storyRef={sentenceRef(selected.index)}
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

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Görünüm ve ses">
        <SheetRow label="Yazı boyutu" stacked>
          <div className="segmented" role="group" aria-label="Yazı boyutu">
            {TEXT_SIZES.map((size) => (
              <button key={size} type="button" aria-pressed={textSize === size} onClick={() => changeTextSize(size)}>
                {TEXT_SIZE_LABELS[size]}
              </button>
            ))}
          </div>
        </SheetRow>
        {canListen && (
          <SheetRow label="Okuma hızı" stacked>
            <div className="segmented" role="group" aria-label="Okuma hızı">
              {SPEEDS.map((s, i) => (
                <button key={s.label} type="button" aria-pressed={speed === i} onClick={() => changeSpeed(i)}>
                  {s.label}
                </button>
              ))}
            </div>
          </SheetRow>
        )}
        {voiceKeys.length > 1 && (
          <SheetRow label="Okuyan ses" stacked>
            <div className="segmented" role="group" aria-label="Okuyan ses">
              {voiceKeys.map((k) => (
                <button key={k} type="button" aria-pressed={activeVoice === k} onClick={() => changeVoice(k)}>
                  {VOICE_LABELS[k]}
                </button>
              ))}
            </div>
          </SheetRow>
        )}
        {studied.size > 0 && (
          <SheetRow label="Çalıştığın kelimeleri işaretle" hint="Metinde noktalı çizgiyle gösterilir.">
            <Switch checked={showStudied} onChange={toggleStudied} label="Çalıştığın kelimeleri işaretle" />
          </SheetRow>
        )}
      </Sheet>
    </div>
  )
}

export default StoryReader
