import { useState, useEffect, useRef } from 'react'
import WordTooltip from './WordTooltip'
import './Story.css'

function Story({ story }) {
  const [selectedWord, setSelectedWord] = useState(null)
  const [selectedWordIndex, setSelectedWordIndex] = useState(null)
  const [speakingWordIndex, setSpeakingWordIndex] = useState(null)
  const [selectedSentence, setSelectedSentence] = useState(null)
  const isKeyboardNavigation = useRef(false)

  // Metni kelimelere ayır
  const words = story.text.split(' ')

  // Kelime index'ine göre cümleyi bul
  const findSentenceByWordIndex = (wordIndex) => {
    // Metni cümlelere ayır
    const sentences = story.text.match(/[^.!?]+[.!?]+/g) || [story.text]

    let wordCount = 0
    for (let sentence of sentences) {
      const sentenceWords = sentence.trim().split(' ')
      wordCount += sentenceWords.length

      if (wordIndex < wordCount) {
        return sentence.trim()
      }
    }

    return sentences[0] || story.text
  }

  const handleWordClick = (event, word, index) => {
    event.preventDefault()

    // Noktalama işaretlerini temizle
    const cleanWord = word.replace(/[.,!?;:]/g, '').trim()

    if (!cleanWord) return

    isKeyboardNavigation.current = false // Tıklama sesli okumamalı

    // Index'e göre doğru cümleyi bul
    const sentence = findSentenceByWordIndex(index)

    setSelectedWord(cleanWord)
    setSelectedWordIndex(index)
    setSelectedSentence(sentence)
  }

  const speakWord = (word) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const cleanWord = word.replace(/[.,!?;:]/g, '').trim()
      const utterance = new SpeechSynthesisUtterance(cleanWord)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    }
  }

  const handleCloseTooltip = () => {
    setSelectedWord(null)
    // selectedWordIndex'i koruyoruz - kelime vurgulu kalsın
  }

  // Klavye navigasyonu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedWordIndex === null) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (selectedWordIndex < words.length - 1) {
          const newIndex = selectedWordIndex + 1
          const newWord = words[newIndex]
          const cleanWord = newWord.replace(/[.,!?;:]/g, '').trim()
          const sentence = findSentenceByWordIndex(newIndex)

          isKeyboardNavigation.current = true
          setSelectedWordIndex(newIndex)
          setSelectedWord(cleanWord)
          setSelectedSentence(sentence)
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (selectedWordIndex > 0) {
          const newIndex = selectedWordIndex - 1
          const newWord = words[newIndex]
          const cleanWord = newWord.replace(/[.,!?;:]/g, '').trim()
          const sentence = findSentenceByWordIndex(newIndex)

          isKeyboardNavigation.current = true
          setSelectedWordIndex(newIndex)
          setSelectedWord(cleanWord)
          setSelectedSentence(sentence)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedWordIndex, words])

  // Klavye ile seçilen kelimeleri sesli oku
  useEffect(() => {
    if (isKeyboardNavigation.current && selectedWord) {
      speakWord(selectedWord)
    }
  }, [selectedWordIndex])

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
          sentence={selectedSentence}
          onClose={handleCloseTooltip}
        />
      )}
    </div>
  )
}

export default Story
