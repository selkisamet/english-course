import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import VocabularyDashboard from '../components/vocabulary/VocabularyDashboard'
import WordList from '../components/vocabulary/WordList'
import FlashcardStudy from '../components/vocabulary/FlashcardStudy'
import WordDetail from '../components/vocabulary/WordDetail'
import ProgressTracker from '../components/vocabulary/ProgressTracker'
import { initializeProgress } from '../utils/vocabularyStorage'
import './VocabularyModule.css'

function VocabularyModule() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [selectedWord, setSelectedWord] = useState(null)
  const [studyQueue, setStudyQueue] = useState([])

  // Initialize progress on mount
  useEffect(() => {
    initializeProgress()
  }, [])

  const handleSelectWord = (word) => {
    setSelectedWord(word)
    setCurrentView('worddetail')
  }

  const handleStartFlashcards = (words = []) => {
    setStudyQueue(words)
    setCurrentView('flashcards')
  }

  const handleBackToDashboard = () => {
    setCurrentView('dashboard')
    setSelectedWord(null)
    setStudyQueue([])
  }

  const handleBackToWordList = () => {
    setCurrentView('wordlist')
    setSelectedWord(null)
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <VocabularyDashboard
            onNavigate={setCurrentView}
            onStartFlashcards={handleStartFlashcards}
          />
        )

      case 'wordlist':
        return (
          <WordList
            onSelectWord={handleSelectWord}
            onStartFlashcards={handleStartFlashcards}
            onBack={handleBackToDashboard}
          />
        )

      case 'flashcards':
        return (
          <FlashcardStudy
            initialQueue={studyQueue}
            onFinish={handleBackToDashboard}
            onBack={handleBackToDashboard}
          />
        )

      case 'worddetail':
        return (
          <WordDetail
            word={selectedWord}
            onBack={handleBackToWordList}
            onStartFlashcard={(word) => handleStartFlashcards([word])}
          />
        )

      case 'progress':
        return (
          <ProgressTracker
            onBack={handleBackToDashboard}
            onStartFlashcards={handleStartFlashcards}
          />
        )

      default:
        return (
          <VocabularyDashboard
            onNavigate={setCurrentView}
            onStartFlashcards={handleStartFlashcards}
          />
        )
    }
  }

  return (
    <div className="vocabulary-module">
      <header className="vocabulary-header">
        <div className="header-content">
          <h1>📚 Oxford 3000 Kelime</h1>
          <p>Derinlemesine kelime öğrenme sistemi</p>
        </div>
        <Link to="/" className="home-link">← Ana Sayfa</Link>
      </header>

      <main className="vocabulary-main">
        {renderView()}
      </main>
    </div>
  )
}

export default VocabularyModule
