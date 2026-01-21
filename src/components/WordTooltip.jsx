import { useState, useEffect } from 'react'
import './WordTooltip.css'

function WordTooltip({ word, sentence, onClose }) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchWordAnalysis = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('http://localhost:3001/api/analyze-word', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            word,
            sentence: sentence || ''
          })
        })

        if (!response.ok) {
          throw new Error('Analiz yapılamadı')
        }

        const result = await response.json()
        setData(result)
        setIsLoading(false)

      } catch (error) {
        console.error('Analysis error:', error)
        setData({ error: 'Analiz yüklenemedi' })
        setIsLoading(false)
      }
    }

    fetchWordAnalysis()
  }, [word, sentence])

  const speakWord = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = 'en-US'
      utterance.rate = 0.8
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    } else {
      alert('Tarayıcınız sesli okuma özelliğini desteklemiyor.')
    }
  }

  const translatePOS = (pos) => {
    const translations = {
      'Noun': 'İsim',
      'Verb': 'Fiil',
      'Adjective': 'Sıfat',
      'Adverb': 'Zarf',
      'Preposition': 'Edat',
      'Pronoun': 'Zamir',
      'Determiner': 'Belirteç',
      'Conjunction': 'Bağlaç',
      'Modal': 'Modal Fiil',
      'Unknown': 'Bilinmiyor'
    }

    // Eğer virgülle ayrılmış birden fazla tip varsa (örn: "Noun, Verb")
    if (pos.includes(',')) {
      return pos.split(',').map(p => translations[p.trim()] || p.trim()).join(', ')
    }

    return translations[pos] || pos
  }

  const translateTense = (tense) => {
    const translations = {
      'Past': 'Geçmiş Zaman',
      'Present': 'Şimdiki Zaman',
      'Future': 'Gelecek Zaman',
      'Gerund (-ing)': '-ing Hali',
      'Gerund': '-ing Hali',
      'Participle': 'Ortaç',
      'Base form': 'Temel Form'
    }

    return translations[tense] || tense
  }

  const renderContent = () => {
    if (!data) return null

    const { nlp, contextTranslation, sentence } = data

    return (
      <>
        {/* Cümledeki Kullanım */}
        {sentence && contextTranslation && (
          <div className="context-section">
            <div className="context-sentence">
              <strong>Cümlede:</strong>
              <p className="sentence-text">"{sentence}"</p>
            </div>
            <div className="context-translation">
              <strong>Anlamı:</strong>
              <p className="translation-text">{contextTranslation}</p>
            </div>
          </div>
        )}

        {/* NLP Analizi */}
        {nlp && (
          <div className="nlp-info">
            <div className="info-row">
              <strong>Tür:</strong> {translatePOS(nlp.pos)}
            </div>
            {nlp.tense && (
              <div className="info-row">
                <strong>Zaman:</strong> {translateTense(nlp.tense)}
              </div>
            )}
            {nlp.root && nlp.root !== word && (
              <div className="info-row">
                <strong>Kök Form:</strong> {nlp.root}
              </div>
            )}
            {(nlp.isModal || nlp.isAuxiliary) && (
              <div className="info-row">
                <strong>Özellik:</strong> {nlp.isModal ? 'Modal Fiil' : 'Yardımcı Fiil'}
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="tooltip-overlay" onClick={onClose}></div>
      <div className="tooltip">
        <div className="tooltip-arrow"></div>
        <div className="tooltip-content">
          <div className="tooltip-header">
            <h3 className="tooltip-word">
              {!isLoading && data?.translation ? data.translation : word}
            </h3>
            <button className="tooltip-close" onClick={onClose}>×</button>
          </div>

          {isLoading ? (
            <div className="loading">⏳ Yükleniyor...</div>
          ) : data?.error ? (
            <div className="error">{data.error}</div>
          ) : (
            renderContent()
          )}

          <button className="tooltip-speak-button" onClick={speakWord}>
            🔊 Telaffuz Et
          </button>
        </div>
      </div>
    </>
  )
}

export default WordTooltip
