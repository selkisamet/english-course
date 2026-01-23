import { useState, useEffect } from 'react'
import { getWordProgress } from '../../utils/vocabularyStorage'
import './WordDetail.css'
import enFlag from '../../assets/images/en.png'
import trFlag from '../../assets/images/tr.png'

function WordDetail({ word, onBack, onStartFlashcard }) {
  const [enrichedData, setEnrichedData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [wordProgress, setWordProgress] = useState(null)

  // Translation helpers
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

  const translateFrequency = (freq) => {
    const translations = {
      'high': 'Yüksek',
      'medium': 'Orta',
      'low': 'Düşük'
    }
    return translations[freq?.toLowerCase()] || capitalize(freq)
  }

  const translateCategory = (category) => {
    const translations = {
      'quality': 'Nitelik',
      'action': 'Eylem',
      'thing': 'Nesne',
      'person': 'Kişi',
      'place': 'Yer',
      'time': 'Zaman',
      'number': 'Sayı',
      'feeling': 'Duygu',
      'idea': 'Fikir',
      'nature': 'Doğa',
      'body': 'Vücut',
      'food': 'Yiyecek',
      'clothing': 'Giysi',
      'communication': 'İletişim',
      'movement': 'Hareket',
      'relation': 'İlişki'
    }
    return translations[category?.toLowerCase()] || capitalize(category)
  }

  useEffect(() => {
    if (word) {
      loadWordData()
      loadWordProgress()
    }
  }, [word])

  const loadWordData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `http://localhost:3001/api/vocabulary/enrich/${word.word}`,
        { method: 'POST' }
      )

      if (!response.ok) {
        throw new Error('Failed to load word details')
      }

      const data = await response.json()
      setEnrichedData(data)
      setIsLoading(false)
    } catch (error) {
      console.error('Load word error:', error)
      setError('Kelime detayları yüklenemedi')
      setIsLoading(false)
    }
  }

  const loadWordProgress = () => {
    const progress = getWordProgress(word.id)
    setWordProgress(progress)
  }

  const capitalize = (text) => {
    if (!text) return ''
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  const speakWord = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(word.word)
      utterance.lang = 'en-US'
      utterance.rate = 0.8
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    }
  }

  if (!word) {
    return <div className="word-detail">Kelime bulunamadı</div>
  }

  return (
    <div className="word-detail">
      {/* Header */}
      <div className="detail-header">
        <button onClick={onBack} className="back-button">← Geri</button>
        <h2>📖 Kelime Detayı</h2>
      </div>

      {/* Word Title */}
      <div className="word-title-section">
        <div className="word-title-main">
          <h1 className="word-title">
            {capitalize(word.word)}
            {enrichedData?.turkish && (
              <span className="word-translation-inline"> ({capitalize(enrichedData.turkish)})</span>
            )}
          </h1>
          <span className="word-level-badge">{word.cefrLevel}</span>
          {wordProgress && (
            <span className={`word-status-badge ${wordProgress.status}`}>
              {wordProgress.status === 'mastered' && '⭐ Öğrenildi'}
              {wordProgress.status === 'reviewing' && '🔄 Gözden Geçiriliyor'}
              {wordProgress.status === 'learning' && '📖 Öğreniliyor'}
              {wordProgress.status === 'new' && '🆕 Yeni'}
            </span>
          )}
        </div>
        <button onClick={speakWord} className="speak-button-large">
          🔊 Telaffuz Et
        </button>
      </div>

      {/* Loading/Error */}
      {isLoading && (
        <div className="detail-loading">Detaylar yükleniyor...</div>
      )}

      {error && (
        <div className="detail-error">{error}</div>
      )}

      {/* Word Content */}
      {!isLoading && !error && (
        <div className="word-content">
          {/* Basic Info */}
          <section className="detail-section">
            <h3>📚 Temel Bilgiler</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Kelime Türü:</strong>
                <span>{translatePartOfSpeech(word.partOfSpeech || enrichedData?.partOfSpeech)}</span>
              </div>
              <div className="info-item">
                <strong>Sıklık:</strong>
                <span>{translateFrequency(word.frequency || 'high')}</span>
              </div>
              {word.categories && word.categories.length > 0 && (
                <div className="info-item">
                  <strong>Kategori:</strong>
                  <span>{word.categories.map(cat => translateCategory(cat)).join(', ')}</span>
                </div>
              )}
              {enrichedData?.phonetic && (
                <div className="info-item">
                  <strong>Telaffuz:</strong>
                  <span>/{enrichedData.phonetic}/</span>
                </div>
              )}
            </div>
          </section>

          {/* Definitions */}
          <section className="detail-section">
            <h3>📖 Anlamları</h3>
            <div className="definitions-list">
              <p className="primary-definition">
                <img src={enFlag} alt="EN" style={{width: '20px', height: '15px', marginRight: '8px', verticalAlign: 'middle'}} />
                {capitalize(word.basicDefinition)}
              </p>
              <p className="turkish-translation">
                <img src={trFlag} alt="TR" style={{width: '20px', height: '15px', marginRight: '8px', verticalAlign: 'middle'}} />
                {capitalize(word.basicTranslation)}
              </p>

              {enrichedData?.definitions && enrichedData.definitions.length > 1 && (
                <div className="additional-definitions">
                  {enrichedData.definitions.slice(1).map((def, index) => (
                    <p key={index} className="definition-item">
                      {index + 2}. {capitalize(def)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Example Sentences */}
          {enrichedData?.exampleSentences && enrichedData.exampleSentences.length > 0 && (
            <section className="detail-section">
              <h3>💬 Örnek Cümleler</h3>
              <div className="examples-list">
                {enrichedData.exampleSentences.map((example, index) => (
                  <div key={index} className="example-item">
                    <p className="example-english">{capitalize(example.english)}</p>
                    {example.turkish && (
                      <p className="example-turkish">→ {capitalize(example.turkish)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Collocations */}
          {enrichedData?.collocations && enrichedData.collocations.length > 0 && (
            <section className="detail-section">
              <h3>🔗 Sık Kullanımlar (Collocations)</h3>
              <div className="collocations-list">
                {enrichedData.collocations.map((collocation, index) => (
                  <span key={index} className="collocation-chip">
                    {collocation}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Synonyms */}
          {enrichedData?.synonyms && enrichedData.synonyms.length > 0 && (
            <section className="detail-section">
              <h3>📚 Eş Anlamlılar</h3>
              <div className="synonyms-list">
                {enrichedData.synonyms.map((synonym, index) => (
                  <span key={index} className="synonym-chip">
                    {synonym}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Progress Info */}
          {wordProgress && (
            <section className="detail-section">
              <h3>📈 Öğrenme İlerlemesi</h3>
              <div className="progress-info">
                <div className="progress-item">
                  <strong>Çalışma Sayısı:</strong>
                  <span>{wordProgress.reviewCount} kez</span>
                </div>
                <div className="progress-item">
                  <strong>Doğru/Yanlış:</strong>
                  <span>{wordProgress.correctCount} / {wordProgress.incorrectCount}</span>
                </div>
                <div className="progress-item">
                  <strong>Tanıma Skoru:</strong>
                  <span>{wordProgress.recognitionScore}%</span>
                </div>
                {wordProgress.nextReview && (
                  <div className="progress-item">
                    <strong>Sonraki Tekrar:</strong>
                    <span>{new Date(wordProgress.nextReview).toLocaleDateString('tr-TR')}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="detail-actions">
            <button
              onClick={() => onStartFlashcard({ wordId: word.id, word: word.word })}
              className="action-button primary"
            >
              🎴 Flashcard ile Çalış
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WordDetail
