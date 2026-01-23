import { useState, useEffect } from 'react'
import { getProgress, updateWordProgress, createNewWordProgress } from '../../utils/vocabularyStorage'
import { updateWordProgress as updateWithSpacedRepetition, DIFFICULTY } from '../../utils/spacedRepetition'
import './FlashcardStudy.css'

function FlashcardStudy({ initialQueue = [], onFinish, onBack }) {
  const [studyQueue, setStudyQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionStats, setSessionStats] = useState({ easy: 0, medium: 0, hard: 0 })
  const [wordDetails, setWordDetails] = useState({})
  const [isLoadingWord, setIsLoadingWord] = useState(true)

  useEffect(() => {
    initializeStudySession()
  }, [])

  useEffect(() => {
    if (studyQueue.length > 0 && currentIndex < studyQueue.length) {
      loadCurrentWord()
    }
  }, [currentIndex, studyQueue])

  const initializeStudySession = () => {
    if (initialQueue.length === 0) {
      // Load words due for review from progress
      const progress = getProgress()
      const wordsDue = Object.values(progress.words || {})
        .filter(w => new Date(w.nextReview) <= new Date())
        .slice(0, 20) // Limit to 20 words per session

      if (wordsDue.length === 0) {
        alert('Çalışılacak kelime yok!')
        onBack()
        return
      }

      setStudyQueue(wordsDue)
    } else {
      setStudyQueue(initialQueue)
    }
  }

  const loadCurrentWord = async () => {
    setIsLoadingWord(true)
    setIsFlipped(false)

    const currentWord = studyQueue[currentIndex]

    if (!currentWord) {
      setIsLoadingWord(false)
      return
    }

    // Try to load word details from API if not already loaded
    if (!wordDetails[currentWord.word]) {
      try {
        const response = await fetch(
          `http://localhost:3001/api/vocabulary/enrich/${currentWord.word}`,
          { method: 'POST' }
        )

        if (response.ok) {
          const data = await response.json()
          setWordDetails(prev => ({
            ...prev,
            [currentWord.word]: data
          }))
        }
      } catch (error) {
        console.error('Failed to load word details:', error)
      }
    }

    setIsLoadingWord(false)
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleDifficultyRating = (difficulty) => {
    const currentWord = studyQueue[currentIndex]

    if (!currentWord) return

    // Get current progress
    const progress = getProgress()
    let wordProgress = progress.words[currentWord.wordId]

    if (!wordProgress) {
      wordProgress = createNewWordProgress(currentWord.wordId, currentWord.word)
    }

    // Update progress with spaced repetition algorithm
    const updatedProgress = updateWithSpacedRepetition(wordProgress, difficulty)

    // Save to localStorage
    updateWordProgress(currentWord.wordId, currentWord.word, updatedProgress)

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      [difficulty]: prev[difficulty] + 1
    }))

    // Move to next word
    if (currentIndex < studyQueue.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      // Session finished
      handleSessionFinish()
    }
  }

  const handleSessionFinish = () => {
    const totalReviewed = sessionStats.easy + sessionStats.medium + sessionStats.hard + 1
    alert(`Tebrikler! ${totalReviewed} kelime çalıştın.\n\nKolay: ${sessionStats.easy}\nOrta: ${sessionStats.medium}\nZor: ${sessionStats.hard}`)
    onFinish()
  }

  const capitalize = (text) => {
    if (!text) return ''
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  const translatePartOfSpeech = (pos) => {
    const translations = {
      'noun': 'İsim',
      'verb': 'Fiil',
      'adjective': 'Sıfat',
      'adverb': 'Zarf',
      'pronoun': 'Zamir',
      'preposition': 'Edat',
      'conjunction': 'Bağlaç',
      'interjection': 'Ünlem',
      'determiner': 'Belirteç',
      'exclamation': 'Ünlem'
    }
    return translations[pos?.toLowerCase()] || capitalize(pos)
  }

  const speakWord = (word) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = 'en-US'
      utterance.rate = 0.8
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    }
  }

  if (studyQueue.length === 0) {
    return (
      <div className="flashcard-study">
        <div className="study-header">
          <button onClick={onBack} className="back-button">← Geri</button>
          <h2>🎴 Flashcard Çalışma</h2>
        </div>
        <div className="no-words">
          <p>Çalışılacak kelime bulunamadı.</p>
          <button onClick={onBack} className="primary-button">Geri Dön</button>
        </div>
      </div>
    )
  }

  const currentWord = studyQueue[currentIndex]
  const details = wordDetails[currentWord?.word]
  const progress = Math.round(((currentIndex + 1) / studyQueue.length) * 100)

  return (
    <div className="flashcard-study">
      {/* Header */}
      <div className="study-header">
        <button onClick={onBack} className="back-button">← Geri</button>
        <h2>🎴 Flashcard Çalışma</h2>
      </div>

      {/* Progress Bar */}
      <div className="study-progress">
        <div className="progress-text">
          <span>Kelime {currentIndex + 1} / {studyQueue.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* Flashcard */}
      <div className="flashcard-container">
        <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
          {/* Front of Card */}
          <div className="flashcard-front">
            <div className="card-content">
              <h1 className="flashcard-word">
                {capitalize(currentWord.word)}
                {details?.turkish && (
                  <span className="word-translation-inline"> ({capitalize(details.turkish)})</span>
                )}
              </h1>

              <button onClick={handleFlip} className="flip-button">
                Çevir
              </button>
            </div>

            <button
              onClick={() => speakWord(currentWord.word)}
              className="speak-button"
              title="Telaffuz Et"
            >
              🔊 Telaffuz Et
            </button>
          </div>

          {/* Back of Card */}
          <div className="flashcard-back">
            {isLoadingWord ? (
              <div className="card-loading">Yükleniyor...</div>
            ) : (
              <div className="card-content">
                <h2 className="flashcard-word-back">
                  {capitalize(currentWord.word)}
                  {details?.turkish && (
                    <span className="word-translation-inline-back"> ({capitalize(details.turkish)})</span>
                  )}
                </h2>

                {details && (
                  <>
                    {details.partOfSpeech && (
                      <p className="flashcard-pos">{translatePartOfSpeech(details.partOfSpeech)}</p>
                    )}

                    {details.definitions && details.definitions[0] && (
                      <p className="flashcard-definition">{capitalize(details.definitions[0])}</p>
                    )}

                    {details.exampleSentences && details.exampleSentences[0] && (
                      <div className="flashcard-example">
                        <p className="example-english">
                          💬 {capitalize(details.exampleSentences[0].english)}
                        </p>
                        {details.exampleSentences[0].turkish && (
                          <p className="example-turkish">
                            → {capitalize(details.exampleSentences[0].turkish)}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="difficulty-rating">
                  <p className="rating-prompt">Ne kadar biliyorsunuz?</p>
                  <div className="difficulty-buttons">
                    <button
                      onClick={() => handleDifficultyRating(DIFFICULTY.HARD)}
                      className="difficulty-button hard"
                    >
                      😟 Bilmiyorum
                      <small>1 gün sonra</small>
                    </button>
                    <button
                      onClick={() => handleDifficultyRating(DIFFICULTY.MEDIUM)}
                      className="difficulty-button medium"
                    >
                      🤔 Zor
                      <small>3 gün sonra</small>
                    </button>
                    <button
                      onClick={() => handleDifficultyRating(DIFFICULTY.EASY)}
                      className="difficulty-button easy"
                    >
                      😊 Kolay
                      <small>7 gün sonra</small>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => speakWord(currentWord.word)}
              className="speak-button"
              title="Telaffuz Et"
            >
              🔊 Telaffuz Et
            </button>
          </div>
        </div>
      </div>

      {/* Session Stats */}
      <div className="session-stats">
        <div className="stat-item">
          <span className="stat-icon">😊</span>
          <span className="stat-count">{sessionStats.easy}</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">🤔</span>
          <span className="stat-count">{sessionStats.medium}</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">😟</span>
          <span className="stat-count">{sessionStats.hard}</span>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="keyboard-hint">
        <small>💡 İpucu: Space tuşu ile çevirebilirsiniz</small>
      </div>
    </div>
  )
}

export default FlashcardStudy
