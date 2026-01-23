import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import AdminPanel from './pages/AdminPanel'
import VocabularyModule from './pages/VocabularyModule'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/vocabulary" element={<VocabularyModule />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
