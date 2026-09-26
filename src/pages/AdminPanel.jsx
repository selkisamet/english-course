import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './AdminPanel.css'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [token, setToken] = useState('')

  const [stories, setStories] = useState([])
  const [filteredStories, setFilteredStories] = useState([])
  const [selectedLevel, setSelectedLevel] = useState('All')
  const [isLoading, setIsLoading] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingStory, setEditingStory] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    level: 'A1',
    text: ''
  })

  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken')
    if (savedToken) {
      setToken(savedToken)
      setIsAuthenticated(true)
      fetchStories(savedToken)
    }
  }, [])

  useEffect(() => {
    if (selectedLevel === 'All') {
      setFilteredStories(stories)
    } else {
      setFilteredStories(stories.filter(story => story.level === selectedLevel))
    }
  }, [selectedLevel, stories])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })

      if (!response.ok) {
        throw new Error('Invalid password')
      }

      const data = await response.json()
      setToken(data.token)
      setIsAuthenticated(true)
      localStorage.setItem('adminToken', data.token)
      fetchStories(data.token)
    } catch (error) {
      setLoginError('Şifre hatalı!')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setToken('')
    setPassword('')
    localStorage.removeItem('adminToken')
    setStories([])
  }

  const fetchStories = async (authToken) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/stories')
      if (!response.ok) {
        throw new Error('Failed to fetch stories')
      }
      const data = await response.json()
      setStories(data)
    } catch (error) {
      console.error('Error fetching stories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddNew = () => {
    setEditingStory(null)
    setFormData({ title: '', level: 'A1', text: '' })
    setShowForm(true)
  }

  const handleEdit = (story) => {
    setEditingStory(story)
    setFormData({
      title: story.title,
      level: story.level,
      text: story.text
    })
    setShowForm(true)
  }

  const handleDelete = async (storyId) => {
    if (!confirm('Bu hikayeyi silmek istediğinize emin misiniz?')) {
      return
    }

    try {
      const response = await fetch(`/api/stories/${storyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete story')
      }

      fetchStories(token)
    } catch (error) {
      console.error('Error deleting story:', error)
      alert('Hikaye silinirken bir hata oluştu!')
    }
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title || !formData.text) {
      alert('Başlık ve metin alanları zorunludur!')
      return
    }

    try {
      const url = editingStory
        ? `/api/stories/${editingStory.id}`
        : '/api/stories'

      const method = editingStory ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Failed to save story')
      }

      setShowForm(false)
      setEditingStory(null)
      setFormData({ title: '', level: 'A1', text: '' })
      fetchStories(token)
    } catch (error) {
      console.error('Error saving story:', error)
      alert('Hikaye kaydedilirken bir hata oluştu!')
    }
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingStory(null)
    setFormData({ title: '', level: 'A1', text: '' })
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="login-section">
            <h1>Yönetim Paneli</h1>
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="password">Şifre:</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Admin şifresini girin"
                  autoFocus
                />
              </div>
              {loginError && <div className="error-message">{loginError}</div>}
              <button type="submit" className="btn btn-primary">Giriş Yap</button>
            </form>
            <Link to="/" className="back-link">Ana Sayfaya Dön</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <header className="admin-header">
          <div className="admin-header-content">
            <h1>Hikaye Yönetim Paneli</h1>
            <div className="admin-header-actions">
              <Link to="/" className="btn btn-secondary">Ana Sayfa</Link>
              <button onClick={handleLogout} className="btn btn-secondary">Çıkış Yap</button>
            </div>
          </div>
        </header>

        <main className="admin-main">
          {!showForm ? (
            <>
              <div className="admin-toolbar">
                <div className="filter-buttons">
                  <button
                    className={`filter-btn ${selectedLevel === 'All' ? 'active' : ''}`}
                    onClick={() => setSelectedLevel('All')}
                  >
                    Tümü
                  </button>
                  {LEVELS.map(level => (
                    <button
                      key={level}
                      className={`filter-btn ${selectedLevel === level ? 'active' : ''}`}
                      onClick={() => setSelectedLevel(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <button onClick={handleAddNew} className="btn btn-primary">
                  + Yeni Hikaye Ekle
                </button>
              </div>

              {isLoading ? (
                <div className="loading">Yükleniyor...</div>
              ) : filteredStories.length === 0 ? (
                <div className="no-data">
                  <p>
                    {selectedLevel === 'All'
                      ? 'Henüz hikaye eklenmemiş.'
                      : `${selectedLevel} seviyesinde hikaye bulunmuyor.`}
                  </p>
                </div>
              ) : (
                <div className="stories-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Başlık</th>
                        <th>Seviye</th>
                        <th>Kelime Sayısı</th>
                        <th>İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStories.map(story => (
                        <tr key={story.id}>
                          <td>{story.title}</td>
                          <td>
                            <span className={`level-badge level-${story.level.toLowerCase()}`}>
                              {story.level}
                            </span>
                          </td>
                          <td>{story.text.split(' ').length}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                onClick={() => handleEdit(story)}
                                className="btn-icon btn-edit"
                                title="Düzenle"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(story.id)}
                                className="btn-icon btn-delete"
                                title="Sil"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="story-form">
              <h2>{editingStory ? 'Hikaye Düzenle' : 'Yeni Hikaye Ekle'}</h2>
              <form onSubmit={handleFormSubmit}>
                <div className="form-group">
                  <label htmlFor="title">Başlık:</label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Hikaye başlığı"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="level">Seviye:</label>
                  <select
                    id="level"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  >
                    {LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="text">Hikaye Metni:</label>
                  <textarea
                    id="text"
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    placeholder="Hikaye metnini buraya yazın..."
                    rows="10"
                    required
                  />
                  <div className="word-count">
                    Kelime sayısı: {formData.text.split(' ').filter(w => w.trim()).length}
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    {editingStory ? 'Güncelle' : 'Kaydet'}
                  </button>
                  <button type="button" onClick={handleFormCancel} className="btn btn-secondary">
                    İptal
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default AdminPanel
