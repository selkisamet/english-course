import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Home from './pages/Home'
import StoryReader from './pages/StoryReader'
import VocabularyHome from './pages/vocabulary/VocabularyHome'
import WordList from './pages/vocabulary/WordList'
import WordDetail from './pages/vocabulary/WordDetail'
import Study from './pages/vocabulary/Study'
import Progress from './pages/Progress'
import AdminPanel from './pages/AdminPanel'
import { initializeProgress } from './utils/vocabularyStorage'
import './styles/global.css'

initializeProgress()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/story/:id" element={<StoryReader />} />
          <Route path="/vocabulary" element={<VocabularyHome />} />
          <Route path="/vocabulary/words" element={<WordList />} />
          <Route path="/vocabulary/words/:id" element={<WordDetail />} />
          <Route path="/vocabulary/study" element={<Study />} />
          <Route path="/progress" element={<Progress />} />
        </Route>
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
