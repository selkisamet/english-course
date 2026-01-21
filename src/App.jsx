import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Story from './components/Story'
import './App.css'

function App() {
  const [stories, setStories] = useState([])
  const [selectedStory, setSelectedStory] = useState(null)
  const [isLoadingStories, setIsLoadingStories] = useState(true)
  const [showTranslation, setShowTranslation] = useState(false)
  const [fullTranslation, setFullTranslation] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)

  useEffect(() => {
    fetchStories()
  }, [])

  const fetchStories = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stories')
      if (!response.ok) {
        throw new Error('Failed to fetch stories')
      }
      const data = await response.json()
      setStories(data)

      if (data.length > 0) {
        // localStorage'dan seçili hikayeyi kontrol et
        const savedStoryId = localStorage.getItem('selectedStoryId')
        const savedStory = savedStoryId ? data.find(s => s.id === savedStoryId) : null

        // Eğer kaydedilmiş hikaye varsa onu seç, yoksa ilk hikayeyi seç
        const storyToSelect = savedStory || data[0]
        setSelectedStory(storyToSelect)

        // localStorage'a kaydet (ilk kez yükleniyorsa)
        if (storyToSelect) {
          localStorage.setItem('selectedStoryId', storyToSelect.id)
        }
      }
    } catch (error) {
      console.error('Error fetching stories:', error)
    } finally {
      setIsLoadingStories(false)
    }
  }

  const handleStoryChange = (e) => {
    const storyId = e.target.value
    const story = stories.find(s => s.id === storyId)
    setSelectedStory(story)
    setShowTranslation(false)
    setFullTranslation('')

    // Seçili hikayeyi localStorage'a kaydet
    if (story) {
      localStorage.setItem('selectedStoryId', story.id)
    }
  }

  const groupedStories = stories.reduce((acc, story) => {
    if (!acc[story.level]) {
      acc[story.level] = []
    }
    acc[story.level].push(story)
    return acc
  }, {})

  const handleTranslateAll = async () => {
    if (!selectedStory) return

    setIsTranslating(true)
    try {
      const response = await fetch('http://localhost:3001/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: selectedStory.text,
          source: 'en',
          target: 'tr'
        })
      })

      if (!response.ok) {
        throw new Error('Çeviri yapılamadı')
      }

      const data = await response.json()
      setFullTranslation(data.translation || 'Çeviri bulunamadı')
      setShowTranslation(true)
    } catch (error) {
      setFullTranslation('Çeviri yapılırken bir hata oluştu.')
      setShowTranslation(true)
    } finally {
      setIsTranslating(false)
    }
  }

  if (isLoadingStories) {
    return (
      <div className="app">
        <div className="loading">Hikayeler yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>📚 İngilizce Öğrenme Uygulaması</h1>
            <p>Kelimelere tıklayarak anlamlarını öğrenin ve dinleyin</p>
          </div>
          <Link to="/admin" className="admin-link">Yönetim Paneli</Link>
        </div>
      </header>

      <main className="app-main">
        {stories.length === 0 ? (
          <div className="no-stories">
            <p>Henüz hikaye bulunmuyor.</p>
            <Link to="/admin">Yönetim panelinden hikaye ekleyin</Link>
          </div>
        ) : (
          <>
            <div className="story-selector">
              <label htmlFor="story-select">Hikaye Seçin:</label>
              <select
                id="story-select"
                value={selectedStory?.id || ''}
                onChange={handleStoryChange}
                className="story-dropdown"
              >
                {Object.keys(groupedStories).sort().map(level => (
                  <optgroup key={level} label={`Seviye ${level}`}>
                    {groupedStories[level].map(story => (
                      <option key={story.id} value={story.id}>
                        {story.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {selectedStory && <Story story={selectedStory} />}
          </>
        )}

        <div className="translate-section">
          <button
            className="translate-button"
            onClick={handleTranslateAll}
            disabled={isTranslating}
          >
            {isTranslating ? '🔄 Çevriliyor...' : '🌍 Tümünü Çevir'}
          </button>

          {showTranslation && (
            <div className="full-translation">
              <h3>Türkçe Çeviri:</h3>
              <p>{fullTranslation}</p>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>💡 İpucu: Kelimelerin üzerine tıklayarak Türkçe anlamını görebilir ve telaffuzunu dinleyebilirsiniz.</p>
      </footer>
    </div>
  )
}

export default App
