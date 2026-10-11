// Uygulama telefonda (Capacitor ile Android / iOS) mı, tarayıcıda mı çalışıyor

import { Capacitor } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()

// Tarayıcıda API aynı adresten sunulur; telefonda sunucunun tam adresi kullanılır (.env.android)
const API_BASE = isNative ? (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '') : ''

// E-postadaki bağlantıların (şifre yenileme, doğrulama) açılacağı adres: telefonda web sitesi
export const webOrigin = isNative ? API_BASE : window.location.origin

export const apiUrl = (url) => (url.startsWith('/') ? API_BASE + url : url)

// ---------- Çevrimdışı önbellek (telefonda) ----------
// Tarayıcıda bu işi service worker yapar; telefon uygulamasında service worker yok.
// Hikayeler ve kelimeler her açılışta sunucudan alınır, bağlantı yoksa son alınan kopya kullanılır.

const CACHE_NAME = 'api-offline'
const CACHEABLE = /^\/api\/(stories|vocabulary)(\/|$|\?)/

export async function fetchWithOfflineCache(url, init) {
  const method = (init?.method || 'GET').toUpperCase()
  if (!isNative || method !== 'GET' || !CACHEABLE.test(url) || typeof caches === 'undefined') {
    return fetch(apiUrl(url), init)
  }
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(apiUrl(url), init)
    if (response.ok) cache.put(url, response.clone()).catch(() => {})
    return response
  } catch (error) {
    const cached = await cache.match(url)
    if (cached) return cached
    throw error
  }
}
