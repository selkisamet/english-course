import { useState } from 'react'
import WordTooltip from './WordTooltip'
import './Story.css'

function Story({ story }) {
  const [selectedWord, setSelectedWord] = useState(null)
  const [selectedWordIndex, setSelectedWordIndex] = useState(null)
  const [speakingWordIndex, setSpeakingWordIndex] = useState(null)

  const handleWordClick = (event, word, index) => {
    event.preventDefault()

    // Noktalama işaretlerini temizle
    const cleanWord = word.replace(/[.,!?;:]/g, '').trim()

    if (!cleanWord) return

    setSelectedWord(cleanWord)
    setSelectedWordIndex(index)
  }

  const handleCloseTooltip = () => {
    setSelectedWord(null)
    // selectedWordIndex'i koruyoruz - kelime vurgulu kalsın
  }

  const speakStory = () => {
    if ('speechSynthesis' in window) {
      // Önceki konuşmayı durdur
      window.speechSynthesis.cancel()
      setSpeakingWordIndex(null)

      const words = story.text.split(' ')
      const utterance = new SpeechSynthesisUtterance(story.text)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      utterance.pitch = 1

      // Her kelime için ortalama süre (ms) - rate 0.9 için yaklaşık
      const avgWordDuration = 350

      let currentWordIndex = 0
      let interval = null

      // Okuma başladığında
      utterance.onstart = () => {
        setSpeakingWordIndex(0)
        currentWordIndex = 0

        // Her kelime için zamanlayıcı
        interval = setInterval(() => {
          currentWordIndex++
          if (currentWordIndex < words.length) {
            setSpeakingWordIndex(currentWordIndex)
          } else {
            if (interval) clearInterval(interval)
          }
        }, avgWordDuration)
      }

      // Okuma bittiğinde temizle
      utterance.onend = () => {
        if (interval) clearInterval(interval)
        setSpeakingWordIndex(null)
      }

      utterance.onerror = () => {
        if (interval) clearInterval(interval)
        setSpeakingWordIndex(null)
      }

      window.speechSynthesis.speak(utterance)
    } else {
      alert('Tarayıcınız sesli okuma özelliğini desteklemiyor.')
    }
  }

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setSpeakingWordIndex(null)
    }
  }

  // Metni kelimelere ayır
  const words = story.text.split(' ')

  return (
    <div className="story-container">
      <div className="story-header">
        <h2>{story.title}</h2>
        <div className="story-controls">
          <button className="control-button play" onClick={speakStory} title="Hikayeyi dinle">
            ▶️ Dinle
          </button>
          <button className="control-button stop" onClick={stopSpeaking} title="Durdur">
            ⏹️ Durdur
          </button>
        </div>
      </div>

      <div className="story-text">
        {words.map((word, index) => (
          <span
            key={index}
            className={`word ${selectedWordIndex === index ? 'selected' : ''} ${speakingWordIndex === index ? 'speaking' : ''}`}
            onClick={(e) => handleWordClick(e, word, index)}
          >
            {word}{' '}
          </span>
        ))}
      </div>

      {selectedWord && (
        <WordTooltip
          word={selectedWord}
          fullText={story.text}
          onClose={handleCloseTooltip}
        />
      )}
    </div>
  )
}

export default Story
