import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut, Pencil, Plus, Trash2 } from 'lucide-react'
import { LEVELS, wordCount } from '../utils/format'
import styles from './AdminPanel.module.css'

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
      <div className={styles.loginPage}>
        <form onSubmit={handleLogin} className={`card ${styles.login}`}>
          <img src="/favicon.svg" alt="" className={styles.logo} />
          <h1>Yönetim paneli</h1>
          <label className={styles.field}>
            <span>Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin şifresi"
              autoFocus
            />
          </label>
          {loginError && <p className={styles.error}>{loginError}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block">Giriş yap</button>
          <Link to="/" className="btn btn-ghost btn-block">Uygulamaya dön</Link>
        </form>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className="icon-btn" aria-label="Uygulamaya dön">
          <ArrowLeft size={20} />
        </Link>
        <h1>Hikayeler</h1>
        <button onClick={handleLogout} className="btn btn-ghost">
          <LogOut size={18} /> Çıkış
        </button>
      </header>

      {!showForm ? (
        <>
          <div className={styles.toolbar}>
            <div className="chip-row" role="group" aria-label="Seviye filtresi">
              {['All', ...LEVELS].map((level) => (
                <button
                  key={level}
                  className="chip"
                  aria-pressed={selectedLevel === level}
                  onClick={() => setSelectedLevel(level)}
                >
                  {level === 'All' ? 'Tümü' : level}
                </button>
              ))}
            </div>
            <button onClick={handleAddNew} className="btn btn-primary">
              <Plus size={18} /> Yeni hikaye
            </button>
          </div>

          {isLoading ? (
            <div className="skeleton" style={{ height: 240 }} />
          ) : filteredStories.length === 0 ? (
            <p className={styles.empty}>
              {selectedLevel === 'All'
                ? 'Henüz hikaye eklenmemiş.'
                : `${selectedLevel} seviyesinde hikaye bulunmuyor.`}
            </p>
          ) : (
            <ul className={styles.list}>
              {filteredStories.map((story) => (
                <li key={story.id} className={styles.row}>
                  <span className={`badge badge-${story.level.toLowerCase()}`}>{story.level}</span>
                  <span className={styles.rowMain}>
                    <strong>{story.title}</strong>
                    <small>{wordCount(story.text)} kelime</small>
                  </span>
                  <button onClick={() => handleEdit(story)} className="icon-btn" aria-label="Düzenle">
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(story.id)}
                    className={`icon-btn ${styles.delete}`}
                    aria-label="Sil"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <form onSubmit={handleFormSubmit} className={`card ${styles.form}`}>
          <h2>{editingStory ? 'Hikayeyi düzenle' : 'Yeni hikaye'}</h2>

          <div className={styles.formRow}>
            <label className={styles.field}>
              <span>Başlık</span>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Hikaye başlığı"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Seviye</span>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Metin</span>
            <textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="Hikaye metnini buraya yazın…"
              rows="12"
              required
            />
            <small>{wordCount(formData.text)} kelime</small>
          </label>

          <div className={styles.formActions}>
            <button type="button" onClick={handleFormCancel} className="btn btn-ghost">İptal</button>
            <button type="submit" className="btn btn-primary">
              {editingStory ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default AdminPanel
