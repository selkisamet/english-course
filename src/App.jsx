import { useState } from 'react'
import Story from './components/Story'
import './App.css'

// Örnek hikaye
const sampleStory = {
  title: "The Little Garden",
  text: "This is Ali. He is 25 years old and he lives in Turkey. He works in an office and he works five days a week. Every morning, he takes the bus to go to work. One day, Ali is very tired because he wakes up early and feels sleepy. He goes to a coffee shop and orders one coffee. The coffee is hot. Ali sits near the window and looks outside. People walk fast on the street. Ali drinks his coffee, feels better, and smiles. After coffee, he goes to work and has a good day."
}

function App() {
  const [showTranslation, setShowTranslation] = useState(false)
  const [fullTranslation, setFullTranslation] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)

  const handleTranslateAll = async () => {
    setIsTranslating(true)
    try {
      const response = await fetch('http://localhost:3001/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: sampleStory.text,
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>📚 İngilizce Öğrenme Uygulaması</h1>
        <p>Kelimelere tıklayarak anlamlarını öğrenin ve dinleyin</p>
      </header>

      <main className="app-main">
        <Story story={sampleStory} />

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
