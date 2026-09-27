import { useEffect, useState } from 'react'

// ---------- Çevrimiçi / çevrimdışı ----------

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

// ---------- Uygulamayı yükle (Android / masaüstü Chrome, Edge) ----------
// Tarayıcı olayı sayfa açılır açılmaz gönderebilir; bileşen yüklenmeden önce yakalanır.

let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn(deferredPrompt))

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  notify()
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  notify()
})

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(deferredPrompt)

  useEffect(() => {
    listeners.add(setPrompt)
    return () => listeners.delete(setPrompt)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice
    deferredPrompt = null
    notify()
  }

  return { canInstall: Boolean(prompt), install }
}
