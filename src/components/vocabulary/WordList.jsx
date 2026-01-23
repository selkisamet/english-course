import { useState, useEffect } from 'react'
import { getProgress } from '../../utils/vocabularyStorage'
import './WordList.css'
import enFlag from '../../assets/images/en.png'
import trFlag from '../../assets/images/tr.png'

function WordList({ onSelectWord, onStartFlashcards, onBack }) {
  const [words, setWords] = useState([])
  const [filteredWords, setFilteredWords] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [selectedLevel, setSelectedLevel] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Available options
  const [levels, setLevels] = useState([])
  const [categories, setCategories] = useState([])

  // User progress
  const [userProgress, setUserProgress] = useState({})

  const wordsPerPage = 20

  useEffect(() => {
    loadLevelsAndCategories()
    loadUserProgress()
  }, [])

  useEffect(() => {
    loadWords()
  }, [selectedLevel, selectedCategory, searchQuery, currentPage])

  const loadLevelsAndCategories = async () => {
    try {
      const [levelsRes, categoriesRes] = await Promise.all([
        fetch('http://localhost:3001/api/vocabulary/levels'),
        fetch('http://localhost:3001/api/vocabulary/categories')
      ])

      if (levelsRes.ok) {
        const levelsData = await levelsRes.json()
        setLevels(levelsData)
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        setCategories(categoriesData)
      }
    } catch (error) {
      console.error('Failed to load levels/categories:', error)
    }
  }

  const loadUserProgress = () => {
    const progress = getProgress()
    setUserProgress(progress.words || {})
  }

  const loadWords = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: wordsPerPage,
        ...(selectedLevel !== 'all' && { level: selectedLevel }),
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        ...(searchQuery && { search: searchQuery })
      })

      const response = await fetch(`http://localhost:3001/api/vocabulary/words?${params}`)

      if (!response.ok) {
        throw new Error('Failed to load words')
      }

      const data = await response.json()
      setWords(data.words)
      setTotalPages(data.totalPages)
      setIsLoading(false)
    } catch (error) {
      console.error('Load words error:', error)
      setError('Kelimeler yüklenemedi')
      setIsLoading(false)
    }
  }

  const handleLevelChange = (level) => {
    setSelectedLevel(level)
    setCurrentPage(1)
  }

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setSelectedLevel('all')
    setSelectedCategory('all')
    setSearchQuery('')
    setCurrentPage(1)
  }

  const getWordStatus = (wordId) => {
    const progress = userProgress[wordId]
    if (!progress) return null
    return progress.status
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'mastered': return '⭐'
      case 'reviewing': return '🔄'
      case 'learning': return '📖'
      case 'new': return '🆕'
      default: return ''
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'mastered': return 'Öğrenildi'
      case 'reviewing': return 'Gözden Geçiriliyor'
      case 'learning': return 'Öğreniliyor'
      case 'new': return 'Yeni'
      default: return ''
    }
  }

  const capitalize = (text) => {
    if (!text) return ''
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  if (isLoading && words.length === 0) {
    return (
      <div className="word-list">
        <div className="list-header">
          <button onClick={onBack} className="back-button">← Geri</button>
          <h2>📖 Kelime Listesi</h2>
        </div>
        <div className="loading">Kelimeler yükleniyor...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="word-list">
        <div className="list-header">
          <button onClick={onBack} className="back-button">← Geri</button>
          <h2>📖 Kelime Listesi</h2>
        </div>
        <div className="error">{error}</div>
      </div>
    )
  }

  return (
    <div className="word-list">
      {/* Header */}
      <div className="list-header">
        <button onClick={onBack} className="back-button">← Geri</button>
        <h2>📖 Kelime Listesi</h2>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Seviye:</label>
          <div className="filter-buttons">
            <button
              className={`filter-button ${selectedLevel === 'all' ? 'active' : ''}`}
              onClick={() => handleLevelChange('all')}
            >
              Tümü
            </button>
            {levels.map(level => (
              <button
                key={level}
                className={`filter-button ${selectedLevel === level ? 'active' : ''}`}
                onClick={() => handleLevelChange(level)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>Kategori:</label>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="category-select"
          >
            <option value="all">Tümü</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group search-group">
          <label>Ara:</label>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Kelime ara..."
            className="search-input"
          />
        </div>

        {(selectedLevel !== 'all' || selectedCategory !== 'all' || searchQuery) && (
          <button onClick={handleClearFilters} className="clear-filters-button">
            Filtreleri Temizle
          </button>
        )}
      </div>

      {/* Word List */}
      <div className="words-container">
        {words.length === 0 ? (
          <div className="no-words">
            <p>Bu kriterlere uygun kelime bulunamadı.</p>
          </div>
        ) : (
          <div className="words-grid">
            {words.map(word => {
              const status = getWordStatus(word.id)
              return (
                <div key={word.id} className={`word-card ${status || ''}`}>
                  <div className="word-header">
                    <div className="word-main">
                      <h3 className="word-text">{capitalize(word.word)}</h3>
                      <span className="word-level">{word.cefrLevel}</span>
                    </div>
                    {status && (
                      <span className="word-status" title={getStatusLabel(status)}>
                        {getStatusIcon(status)}
                      </span>
                    )}
                  </div>

                  <p className="word-definition">
                    <img src={enFlag} alt="EN" style={{width: '20px', height: '15px', marginRight: '8px', verticalAlign: 'middle'}} />
                    {capitalize(word.basicDefinition)}
                  </p>
                  <p className="word-translation">
                    <img src={trFlag} alt="TR" style={{width: '20px', height: '15px', marginRight: '8px', verticalAlign: 'middle'}} />
                    {capitalize(word.basicTranslation)}
                  </p>

                  <div className="word-meta">
                    <span className="word-pos">{capitalize(word.partOfSpeech)}</span>
                    {word.categories && word.categories.length > 0 && (
                      <span className="word-category">{word.categories[0]}</span>
                    )}
                  </div>

                  <div className="word-actions">
                    <button
                      onClick={() => onSelectWord(word)}
                      className="word-action-button detail"
                    >
                      Detay
                    </button>
                    <button
                      onClick={() => onStartFlashcards([{ wordId: word.id, word: word.word }])}
                      className="word-action-button study"
                    >
                      Çalış
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="pagination-button first"
            title="İlk Sayfa"
          >
            ⏮ İlk
          </button>

          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="pagination-button prev"
          >
            ← Önceki
          </button>

          <div className="pagination-numbers">
            {(() => {
              const pages = []
              const maxButtons = 5

              // Calculate start and end page numbers
              let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2))
              let endPage = Math.min(totalPages, startPage + maxButtons - 1)

              // Adjust start if we're near the end
              if (endPage - startPage < maxButtons - 1) {
                startPage = Math.max(1, endPage - maxButtons + 1)
              }

              // First page
              if (startPage > 1) {
                pages.push(
                  <button
                    key={1}
                    onClick={() => setCurrentPage(1)}
                    className="pagination-number"
                  >
                    1
                  </button>
                )
                if (startPage > 2) {
                  pages.push(<span key="dots1" className="pagination-dots">...</span>)
                }
              }

              // Middle pages
              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`pagination-number ${currentPage === i ? 'active' : ''}`}
                  >
                    {i}
                  </button>
                )
              }

              // Last page
              if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                  pages.push(<span key="dots2" className="pagination-dots">...</span>)
                }
                pages.push(
                  <button
                    key={totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="pagination-number"
                  >
                    {totalPages}
                  </button>
                )
              }

              return pages
            })()}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="pagination-button next"
          >
            Sonraki →
          </button>

          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="pagination-button last"
            title="Son Sayfa"
          >
            Son ⏭
          </button>
        </div>
      )}
    </div>
  )
}

export default WordList
