import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Check, CircleAlert, Layers, Trophy, Volume2, X } from 'lucide-react'
import { HighlightedSentence, RichText } from '../../components/WordPanel'
import { fetchWord, fetchWordPool } from '../../utils/api'
import { buildExercise, checkTyped, describeWord, shortMeaning } from '../../utils/exercises'
import { capitalize, formatTr, translatePOS, VOCAB_LEVELS } from '../../utils/format'
import { exampleClip, playClip, stopClip, storySentenceClip, wordClip } from '../../utils/clips'
import { GRADE, isNewWord, reviewEntry } from '../../utils/srs'
import { buildTodayQueue, exerciseTypesFor, planSteps } from '../../utils/studySession'
import { getPreferredLevel } from '../../utils/storyProgress'
import {
  createNewWordProgress,
  getWordProgress,
  logDailyStudy,
  removeWordProgress,
  updateWordProgress as saveWordProgress
} from '../../utils/vocabularyStorage'
import page from '../../styles/page.module.css'
import styles from './Study.module.css'

const TYPE_LABELS = {
  meaning: 'Anlamını seç',
  listen: 'Dinle ve seç',
  toEnglish: 'İngilizcesini seç',
  cloze: 'Boşluğu doldur',
  typing: 'Yazarak cevapla'
}

const GRADES = { ok: GRADE.GOOD, almost: GRADE.HARD, bad: GRADE.AGAIN }

// Yanlış bilinen kelime bu kadar adım sonra yeniden sorulur
const RETRY_GAP = 3
// Aynı oturumda en fazla bu kadar yeniden sorulur; kalanı tekrar takvimine bırakılır
const MAX_RETRIES = 2

const isStoryOnly = (wordId) => wordId.startsWith('story:')

// Şimdiki kelimenin seslendirmeleri: { word, example } (yoksa cihaz sesi okur)
const ClipsContext = createContext({ word: null, example: null })

function SpeakButton({ text, kind, label = 'Dinle', size = 20, className = 'icon-btn icon-btn-soft' }) {
  const clips = useContext(ClipsContext)
  return (
    <button type="button" className={className} onClick={() => playClip(kind ? clips[kind] : null, text)} aria-label={label}>
      <Volume2 size={size} />
    </button>
  )
}

function Example({ example, word }) {
  if (!example?.text) return null
  return (
    <div className={styles.example}>
      <p>
        <HighlightedSentence sentence={example.text} word={example.form || word} />
        <SpeakButton text={example.text} kind="example" label="Örnek cümleyi dinle" size={16} className={styles.inlineSpeak} />
      </p>
      {example.tr && <p className={styles.exampleTr}>{formatTr(example.tr)}</p>}
    </div>
  )
}

// ---------- Yeni kelime tanıtımı ----------

function Intro({ info, entry, oxford, onLearned, onKnown }) {
  // Hikayedeki anlam ana anlamın aynısıysa ve not yoksa kutu gösterilmez (yerine tanım gelir)
  const sameMeaning =
    entry?.translation?.toLocaleLowerCase('tr-TR').trim() === info.meaning.toLocaleLowerCase('tr-TR').trim()
  const storyContext = entry?.sentence && (!sameMeaning || entry.note) ? entry : null
  const otherSenses = oxford ? oxford.senses.filter((s) => s.translation !== info.meaning).slice(0, 3) : []
  return (
    <>
      <main className={styles.stage}>
        <span className={styles.chip} data-tone="new">Yeni kelime</span>
        <div className={styles.wordRow}>
          <h1 className={styles.word}>{info.word}</h1>
          <SpeakButton text={info.word} kind="word" />
        </div>
        <div className={styles.card}>
          <div className={styles.badges}>
            {info.pos && <span className="badge">{translatePOS(info.pos)}</span>}
            {info.level && <span className="badge">{info.level}</span>}
          </div>
          <p className={styles.meaning}>{formatTr(info.meaning)}</p>
          {storyContext ? (
            <div className={styles.inStory}>
              <p className={styles.inStoryLabel}>
                <BookOpen size={16} /> Hikayedeki anlamı
              </p>
              <p className={styles.inStoryText}>{formatTr(storyContext.translation)}</p>
              {storyContext.note && (
                <p className={styles.inStoryNote}>
                  <RichText text={storyContext.note} />
                </p>
              )}
            </div>
          ) : (
            oxford && <Definition sense={definitionSense(oxford, info)} />
          )}
          <Example example={info.example} word={info.word} />
          {otherSenses.length > 0 && (
            <ul className={styles.otherSenses} aria-label="Diğer anlamları">
              {otherSenses.map((s) => (
                <li key={`${s.pos}-${s.translation}`}>
                  <span className="badge">{translatePOS(s.pos)}</span>
                  {formatTr(s.translation)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <footer className={styles.actions}>
        <button className="btn btn-primary btn-lg btn-block" onClick={onLearned}>
          Öğrendim, devam
        </button>
        <button className={`btn btn-lg btn-block ${styles.outline}`} onClick={onKnown}>
          Bu kelimeyi zaten biliyorum
        </button>
      </footer>
    </>
  )
}

const definitionSense = (oxford, info) => oxford.senses.find((s) => s.pos === info.pos) || oxford.senses[0]

// İngilizce tanım ve altında Türkçesi
function Definition({ sense }) {
  if (!sense?.definition) return null
  return (
    <div className={styles.definition}>
      <p lang="en">{capitalize(sense.definition)}</p>
      {sense.definitionTranslation && <p className={styles.definitionTr}>{capitalize(sense.definitionTranslation)}</p>}
    </div>
  )
}

// ---------- Sorular ----------

function Options({ exercise, picked, answered, onPick, english }) {
  return (
    <div className={exercise.type === 'cloze' ? styles.optionGrid : styles.options}>
      {exercise.options.map((option, i) => {
        let state
        if (answered) state = i === exercise.answer ? 'ok' : i === picked ? 'bad' : 'dim'
        return (
          <button
            key={option}
            className={styles.option}
            data-state={state}
            data-english={english || undefined}
            onClick={() => onPick(i)}
            disabled={answered}
          >
            {exercise.type !== 'cloze' && <span className={styles.key}>{i + 1}</span>}
            {english ? option : formatTr(option)}
          </button>
        )
      })}
    </div>
  )
}

function Question({ exercise, picked, answered, typed, setTyped, onPick, onSubmitTyped, onGiveUp }) {
  const { type } = exercise
  const inputRef = useRef(null)
  const clips = useContext(ClipsContext)
  const sayWord = () => playClip(clips.word, exercise.word)

  useEffect(() => {
    if (type === 'listen') sayWord()
    if (type === 'typing') inputRef.current?.focus()
  }, [exercise, type])

  return (
    <main className={styles.stage}>
      <span className={styles.chip}>{TYPE_LABELS[type]}</span>

      {type === 'meaning' && (
        <>
          <p className={styles.ask}>Bu kelimenin anlamı ne?</p>
          <div className={styles.wordRow}>
            <h1 className={styles.word}>{exercise.word}</h1>
            <SpeakButton text={exercise.word} kind="word" />
          </div>
        </>
      )}

      {type === 'listen' && (
        <>
          <p className={styles.ask}>Duyduğun kelimenin anlamı ne?</p>
          <button className={styles.bigSpeak} onClick={sayWord} aria-label="Kelimeyi tekrar dinle">
            <Volume2 size={44} />
          </button>
          {answered && <h1 className={`${styles.word} ${styles.center}`}>{exercise.word}</h1>}
        </>
      )}

      {(type === 'toEnglish' || type === 'typing') && (
        <>
          <p className={styles.ask}>{type === 'typing' ? 'Bu kelimenin İngilizcesini yaz.' : 'İngilizcesi hangisi?'}</p>
          <h1 className={styles.prompt}>{formatTr(exercise.meaning)}</h1>
          {exercise.pos && <span className="badge">{translatePOS(exercise.pos)}</span>}
        </>
      )}

      {type === 'cloze' && (
        <>
          <p className={styles.ask}>Cümleyi tamamlayan kelimeyi seç.</p>
          <div className={styles.clozeCard}>
            <p className={styles.sentence}>
              {exercise.before}
              <span className={styles.blank}>{answered ? exercise.options[exercise.answer] : ' '}</span>
              {exercise.after}
            </p>
            {exercise.translation && <p className={styles.exampleTr}>{formatTr(exercise.translation)}</p>}
          </div>
        </>
      )}

      {type === 'typing' ? (
        <form
          className={styles.typingForm}
          onSubmit={(e) => {
            e.preventDefault()
            if (!answered && typed.trim()) onSubmitTyped()
          }}
        >
          <label className={styles.ask} htmlFor="typed-answer">Cevabın</label>
          <input
            id="typed-answer"
            ref={inputRef}
            className={styles.field}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            readOnly={answered}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="İngilizcesini yaz…"
            lang="en"
          />
          {!answered && (
            <div className={styles.typingActions}>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!typed.trim()}>
                Kontrol et
              </button>
              <button type="button" className={`btn btn-lg btn-block ${styles.outline}`} onClick={onGiveUp}>
                Bilmiyorum
              </button>
            </div>
          )}
        </form>
      ) : (
        <Options
          exercise={exercise}
          picked={picked}
          answered={answered}
          onPick={onPick}
          english={type === 'toEnglish' || type === 'cloze'}
        />
      )}
    </main>
  )
}

function Feedback({ result, exercise, info, other, willRetry, onNext }) {
  const nextRef = useRef(null)
  useEffect(() => nextRef.current?.focus(), [])

  const correctText =
    exercise.type === 'meaning' || exercise.type === 'listen'
      ? `${exercise.word} = ${formatTr(exercise.options[exercise.answer])}`
      : exercise.type === 'typing'
        ? exercise.accepted[0]
        : `${exercise.word} = ${formatTr(shortMeaning(exercise.meaning))}`

  let title = 'Doğru!'
  let line = ''
  if (result === 'bad') {
    title = 'Doğru cevap:'
    line = correctText
  } else if (result === 'almost') {
    title = 'Neredeyse!'
    line = `Doğru yazımı: ${exercise.accepted[0]}. Bunu doğru saydık.`
  } else if (other) {
    line = `“${other}” de bu anlama gelir. Sorduğumuz kelime: ${exercise.accepted[0]}`
  }

  return (
    <section className={styles.feedback} data-result={result} aria-live="polite">
      <p className={styles.feedbackHead}>
        <span className={styles.feedbackIcon}>{result === 'bad' ? <X size={18} strokeWidth={3} /> : <Check size={18} strokeWidth={3} />}</span>
        {title}
      </p>
      {line && <p className={styles.feedbackLine}>{line}</p>}
      <Example example={info.example} word={info.word} />
      {result === 'bad' && (
        <p className={styles.retryNote}>
          {willRetry ? 'Bu kelime birazdan yeniden sorulacak.' : 'Bu kelimeyi yarın yeniden soracağız.'}
        </p>
      )}
      <button ref={nextRef} className={`btn btn-lg btn-block ${styles.next}`} data-result={result} onClick={onNext}>
        Devam
      </button>
    </section>
  )
}

// ---------- Özet ----------

function Summary({ session, onMore }) {
  const { seen, graded, newWords, wrong } = session
  const correct = graded.filter((g) => g.ok).length
  return (
    <div className={styles.summary}>
      <span className={styles.trophy}>
        <Trophy size={32} />
      </span>
      <div>
        <h1>Bugünkü çalışma tamam!</h1>
        <p className="muted">Tekrar zamanı gelen kelimeleri sana yine hatırlatacağız.</p>
      </div>

      <div className={styles.resultGrid}>
        <div>
          <strong>{seen.size}</strong>
          <span>kelime</span>
        </div>
        <div>
          <strong>{graded.length ? `%${Math.round((correct / graded.length) * 100)}` : '—'}</strong>
          <span>ilk denemede doğru</span>
        </div>
        <div>
          <strong>{newWords}</strong>
          <span>yeni kelime</span>
        </div>
      </div>

      {wrong.length > 0 && (
        <section className={styles.weak}>
          <h2 className={styles.weakTitle}>Zorlandığın kelimeler</h2>
          <ul>
            {wrong.map((w) => (
              <li key={w.wordId}>
                <strong>{w.word}</strong>
                <span>{formatTr(shortMeaning(w.meaning))}</span>
              </li>
            ))}
          </ul>
          <p className="muted">Bu kelimeler önümüzdeki günlerde daha sık sorulacak.</p>
        </section>
      )}

      <div className={styles.summaryActions}>
        <Link to="/vocabulary" className="btn btn-primary btn-lg btn-block">Kelimelere dön</Link>
        {onMore && (
          <button className={`btn btn-lg btn-block ${styles.outline}`} onClick={onMore}>
            5 yeni kelime daha
          </button>
        )}
        <Link to="/" className="btn btn-ghost btn-block">Hikaye oku</Link>
      </div>
    </div>
  )
}

function PrepSummary({ session, storyId, wordsById }) {
  const words = [...session.seen].map((id) => wordsById[id]).filter(Boolean)
  return (
    <div className={styles.summary}>
      <span className={styles.trophy} data-tone="story">
        <BookOpen size={32} />
      </span>
      <div>
        <h1>Hikayeye hazırsın!</h1>
        <p className="muted">
          {words.length} kelimeyi çalıştın. Okurken bunlar hikayede işaretli görünecek.
        </p>
      </div>
      {words.length > 0 && (
        <section className={styles.weak}>
          <ul>
            {words.map((w) => (
              <li key={w.wordId}>
                <strong>{w.word}</strong>
                <span>{formatTr(shortMeaning(w.meaning))}</span>
              </li>
            ))}
          </ul>
          <p className="muted">Bu kelimeler tekrar takvimine eklendi.</p>
        </section>
      )}
      <div className={styles.summaryActions}>
        <Link to={`/story/${storyId}`} replace className="btn btn-primary btn-lg btn-block">Hikayeyi oku</Link>
      </div>
    </div>
  )
}

function QuizSummary({ session, storyId, storyTitle, nextStory }) {
  const { graded, wrong } = session
  const correct = graded.filter((g) => g.ok).length
  const total = graded.length
  const percent = total ? correct / total : 0
  return (
    <div className={styles.summary}>
      <div className={styles.scoreRing} style={{ '--score': `${Math.round(percent * 360)}deg` }}>
        <strong>
          {correct}/{total}
        </strong>
      </div>
      <div>
        <h1>{percent >= 0.8 ? 'Harika!' : percent >= 0.5 ? 'İyi gidiyorsun!' : 'Biraz daha pratik'}</h1>
        <p className="muted">
          “{storyTitle}” hikayesinin kelimelerinden {correct} tanesini ilk denemede bildin.
        </p>
      </div>
      {wrong.length > 0 && (
        <section className={styles.weak}>
          <h2 className={styles.weakTitle}>{wrong.length > 1 ? 'Tekrar edeceğimiz kelimeler' : 'Tekrar edeceğimiz kelime'}</h2>
          <ul>
            {wrong.map((w) => (
              <li key={w.wordId}>
                <strong>{w.word}</strong>
                <span>{formatTr(shortMeaning(w.meaning))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="muted">Sonuçlar kelimelerin tekrar takvimine işlendi.</p>
      <div className={styles.summaryActions}>
        {nextStory && (
          <Link to={`/story/${nextStory.id}`} replace className="btn btn-primary btn-lg btn-block">
            Sıradaki hikaye: {nextStory.title}
          </Link>
        )}
        <Link to={`/story/${storyId}`} replace className={`btn btn-lg btn-block ${styles.outline}`}>
          Hikayeye dön
        </Link>
      </div>
    </div>
  )
}

// ---------- Oturum ----------

const emptySession = () => ({ seen: new Set(), graded: [], gradedIds: new Set(), newWords: 0, wrong: [] })

function Study() {
  const location = useLocation()
  const navigate = useNavigate()
  const customQueue = location.state?.queue
  const extraNew = location.state?.extraNew || 0
  // mode: 'prep' (okumadan önce) | 'quiz' (hikaye sonrası mini test) | yok (günlük çalışma)
  const mode = location.state?.mode || null
  const story = location.state?.story || null
  const contexts = location.state?.contexts || null

  const [steps, setSteps] = useState(null)
  const [pool, setPool] = useState(null)
  const [details, setDetails] = useState({})
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  const [index, setIndex] = useState(0)
  const [exercise, setExercise] = useState(null)
  const [picked, setPicked] = useState(null)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState(null) // { result, other }
  const [session, setSession] = useState(emptySession)
  const [done, setDone] = useState(false)
  const [summaryWords, setSummaryWords] = useState({})

  // Oturum listesi ve kelime verisi
  useEffect(() => {
    let active = true
    setError('')
    // "5 yeni kelime daha" aynı sayfada yeni bir oturum başlatır
    setSteps(null)
    setIndex(0)
    setExercise(null)
    setResult(null)
    setDone(false)
    setSession(emptySession())
    const level = VOCAB_LEVELS.includes(getPreferredLevel()) ? getPreferredLevel() : 'A1'
    Promise.all([customQueue?.length ? customQueue : buildTodayQueue(level, extraNew), fetchWordPool()])
      .then(([queue, words]) => {
        if (!active) return
        setPool(words)
        setSteps(planSteps(queue, { intros: mode !== 'quiz' }))
      })
      .catch(() => active && setError('Kelimeler yüklenemedi. Bağlantını kontrol edip tekrar dene.'))
    return () => {
      active = false
    }
  }, [customQueue, extraNew, mode, retry])

  const step = steps?.[index]

  // Şimdiki ve sonraki kelimenin listedeki kaydı
  useEffect(() => {
    if (!steps) return
    ;[steps[index], steps[index + 1]].forEach((s) => {
      if (!s || s.wordId in details) return
      if (isStoryOnly(s.wordId)) return setDetails((d) => ({ ...d, [s.wordId]: null }))
      setDetails((d) => ({ ...d, [s.wordId]: undefined }))
      fetchWord(s.wordId)
        .then((word) => setDetails((d) => ({ ...d, [s.wordId]: word })))
        .catch(() => setDetails((d) => ({ ...d, [s.wordId]: null })))
    })
  }, [steps, index, details])

  const oxford = step ? details[step.wordId] : undefined
  const ready = step && oxford !== undefined && pool
  const entry = step ? getWordProgress(step.wordId) : null

  const info = useMemo(() => {
    if (!ready) return null
    if (!entry && !oxford) return null
    // Hikayeden gelen kelimede o hikayenin cümlesi ve anlamı kullanılır
    const context = contexts?.[step.wordId]
    const base = entry || { wordId: step.wordId, word: step.word }
    return describeWord(context ? { ...base, ...context } : base, oxford)
    // entry her adımda yeniden okunur; bilgi adım değişince yenilenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, step, oxford])

  const [clips, setClips] = useState({ word: null, example: null })
  useEffect(() => {
    if (!info) return
    let active = true
    const ex = info.example
    setClips({ word: wordClip(oxford, info.pos), example: ex && !ex.story ? exampleClip(oxford, ex.text) : null })
    // Hikaye cümlesi hikayenin kendi seslendirmesinden çalınır
    if (ex?.story) {
      storySentenceClip(ex.story)
        .then((clip) => active && setClips((c) => ({ ...c, example: clip })))
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [info, oxford])
  useEffect(() => stopClip, [])

  const goNext = useCallback(
    (nextSteps = steps) => {
      setPicked(null)
      setTyped('')
      setResult(null)
      setExercise(null)
      if (index + 1 >= nextSteps.length) setDone(true)
      else setIndex(index + 1)
    },
    [index, steps]
  )

  // Anlamı bilinmeyen (eski sürümden kalmış) kelime: ilerlemeden kaldır ve geç
  useEffect(() => {
    if (ready && !info) {
      removeWordProgress(step.wordId)
      goNext()
    }
  }, [ready, info, step, goNext])

  // Sorunun üretilmesi (adım başına bir kez)
  useEffect(() => {
    if (!info || step.kind !== 'quiz' || exercise) return
    const types = mode === 'quiz' && !step.retry ? ['cloze', 'meaning'] : exerciseTypesFor(entry, { retry: step.retry })
    for (const type of types) {
      const built = buildExercise(type, info, pool)
      if (built) return setExercise(built)
    }
    // Hiçbir soru üretilemezse (çok nadir) bu adımı atla
    goNext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, step, exercise])

  const markSeen = (wordId) => {
    setSession((s) => ({ ...s, seen: new Set(s.seen).add(wordId) }))
    if (info) setSummaryWords((m) => ({ ...m, [wordId]: { wordId, word: info.word, meaning: info.meaning } }))
  }

  // İlk cevap kelimenin takvimini belirler; aynı oturumdaki tekrarlar yalnızca pekiştirme
  const answer = (outcome, other) => {
    setResult({ result: outcome, other })
    markSeen(step.wordId)
    if (!session.gradedIds.has(step.wordId)) {
      const saved = getWordProgress(step.wordId)
      const current = saved || createNewWordProgress(step.wordId, info.word)
      // Hikayeden ilk kez gelen kelime, hikayedeki bağlamıyla birlikte kaydedilir
      const context = !saved && contexts?.[step.wordId]
      saveWordProgress(step.wordId, info.word, { ...(context || {}), ...reviewEntry(current, GRADES[outcome]) })
      // Daha önce çalışılmış kelimenin sorusu tekrar sayılır (ana sayfadaki günlük plan için)
      const review = saved && !isNewWord(saved) ? 1 : 0
      logDailyStudy({ answers: 1, correct: outcome === 'bad' ? 0 : 1, reviews: review })
      setSession((s) => ({
        ...s,
        gradedIds: new Set(s.gradedIds).add(step.wordId),
        graded: [...s.graded, { wordId: step.wordId, ok: outcome !== 'bad' }]
      }))
    }
    if (outcome === 'bad') {
      setSession((s) =>
        s.wrong.some((w) => w.wordId === step.wordId)
          ? s
          : { ...s, wrong: [...s.wrong, { wordId: step.wordId, word: info.word, meaning: info.meaning }] }
      )
    }
  }

  const pick = (i) => {
    if (result) return
    setPicked(i)
    answer(i === exercise.answer ? 'ok' : 'bad')
  }

  const submitTyped = () => {
    const { result: outcome, other } = checkTyped(exercise, typed)
    answer(outcome, other)
  }

  const willRetry = Boolean(step) && steps.filter((s) => s.wordId === step.wordId && s.retry).length < MAX_RETRIES

  const next = () => {
    if (result?.result === 'bad' && willRetry) {
      // Yanlış bilinen kelime birkaç adım sonra yeniden sorulur
      const copy = [...steps]
      copy.splice(Math.min(copy.length, index + 1 + RETRY_GAP), 0, { wordId: step.wordId, word: step.word, kind: 'quiz', retry: true })
      setSteps(copy)
      goNext(copy)
    } else {
      goNext()
    }
  }

  const learned = () => {
    if (!getWordProgress(step.wordId)) saveWordProgress(step.wordId, info.word, {})
    logDailyStudy({ newWords: 1 })
    setSession((s) => ({ ...s, newWords: s.newWords + 1 }))
    markSeen(step.wordId)
    goNext()
  }

  const known = () => {
    const current = getWordProgress(step.wordId) || createNewWordProgress(step.wordId, info.word)
    saveWordProgress(step.wordId, info.word, reviewEntry(current, GRADE.EASY))
    logDailyStudy({ newWords: 1 })
    markSeen(step.wordId)
    // Bilinen kelimenin bekleyen sorusu oturumdan çıkar
    const copy = steps.filter((s, i) => i <= index || !(s.wordId === step.wordId && s.kind === 'quiz'))
    setSteps(copy)
    goNext(copy)
  }

  // Klavye: 1–4 seçenek, Enter devam
  useEffect(() => {
    if (done || !step) return
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return
      if (step.kind === 'intro' && e.key === 'Enter' && info) {
        e.preventDefault()
        learned()
      } else if (exercise && !result && exercise.options && /^[1-4]$/.test(e.key)) {
        pick(Number(e.key) - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const close = () => navigate(location.key === 'default' ? (story ? `/story/${story.id}` : '/vocabulary') : -1)

  if (error) {
    return (
      <div className={page.page}>
        <div className={page.empty}>
          <span className={page.emptyIcon}>
            <CircleAlert size={24} />
          </span>
          <p className={page.emptyTitle}>{error}</p>
          <button className="btn btn-primary" onClick={() => setRetry((n) => n + 1)}>Tekrar dene</button>
        </div>
      </div>
    )
  }

  if (steps && steps.length === 0) {
    return (
      <div className={page.page}>
        <div className={page.empty}>
          <span className={page.emptyIcon}>
            <Layers size={24} />
          </span>
          <p className={page.emptyTitle}>Bugünlük çalışacak kelime kalmadı</p>
          <p>Yarın tekrar zamanı gelen kelimeler burada olacak.</p>
          <Link to="/vocabulary" className="btn btn-primary">Kelimelere dön</Link>
        </div>
      </div>
    )
  }

  if (done && mode === 'prep') {
    return <PrepSummary session={session} storyId={story.id} wordsById={summaryWords} />
  }

  if (done && mode === 'quiz') {
    return <QuizSummary session={session} storyId={story.id} storyTitle={story.title} nextStory={story.next} />
  }

  if (done) {
    return (
      <Summary
        session={session}
        onMore={customQueue ? null : () => navigate('/vocabulary/study', { replace: true, state: { extraNew: 5 } })}
      />
    )
  }

  const progress = steps ? (index / steps.length) * 100 : 0
  // Sayaç adımları değil kelimeleri sayar (yeni kelimede tanıtım + soru iki adımdır)
  const wordIds = steps ? [...new Set(steps.map((s) => s.wordId))] : []
  const finishedWords = wordIds.filter((id) => steps.findLastIndex((s) => s.wordId === id) < index).length

  return (
    <ClipsContext.Provider value={clips}>
    <div className={styles.study}>
      <header className={styles.top}>
        <button className="icon-btn" onClick={close} aria-label="Çalışmayı bitir">
          <X size={22} />
        </button>
        <div className={styles.bar} role="progressbar" aria-label="İlerleme" aria-valuenow={index} aria-valuemax={steps?.length || 0}>
          <div className={styles.barFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.count} title="Tamamlanan kelime">
          {steps ? `${finishedWords}/${wordIds.length}` : ''}
        </span>
      </header>

      {!info || (step.kind === 'quiz' && !exercise) ? (
        <main className={styles.stage}>
          <div className="skeleton" style={{ height: 28, width: 120 }} />
          <div className="skeleton" style={{ height: 48, width: '60%' }} />
          <div className="skeleton" style={{ height: 220 }} />
        </main>
      ) : step.kind === 'intro' ? (
        <Intro key={index} info={info} entry={entry} oxford={oxford} onLearned={learned} onKnown={known} />
      ) : (
        <div key={index} className={styles.questionWrap}>
          <Question
            exercise={exercise}
            picked={picked}
            answered={Boolean(result)}
            typed={typed}
            setTyped={setTyped}
            onPick={pick}
            onSubmitTyped={submitTyped}
            onGiveUp={() => answer('bad')}
          />
          {result && (
            <Feedback
              result={result.result}
              other={result.other}
              exercise={exercise}
              info={info}
              willRetry={willRetry}
              onNext={next}
            />
          )}
        </div>
      )}
    </div>
    </ClipsContext.Provider>
  )
}

export default Study
