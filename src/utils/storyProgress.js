// Okunan hikayeler ve kullanıcı tercihleri (localStorage)

import { notifyChange } from './changes'

const READ_KEY = 'readStories'
const LAST_KEY = 'selectedStoryId'
const LEVEL_KEY = 'preferredLevel'
const VOICE_KEY = 'storyVoice'

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Depolama kapalıysa sessizce geç
  }
}

export const getReadStories = () => read(READ_KEY, [])

export const isStoryRead = (id) => getReadStories().includes(id)

export function toggleStoryRead(id) {
  const list = getReadStories()
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  write(READ_KEY, next)
  notifyChange('read', { storyId: id, read: next.includes(id) })
  return next.includes(id)
}

export function getLastStoryId() {
  // Eski sürüm bu anahtarı düz metin olarak kaydediyordu
  try {
    const raw = localStorage.getItem(LAST_KEY)
    if (!raw) return null
    return raw.startsWith('"') ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

export function setLastStoryId(id) {
  write(LAST_KEY, id)
  notifyChange('settings')
}

export const getPreferredLevel = () => read(LEVEL_KEY, null)

export function setPreferredLevel(level) {
  write(LEVEL_KEY, level)
  notifyChange('settings')
}

// Hikaye seslendirmesinde seçilen ses: 'female' | 'male'
export const getStoryVoice = () => read(VOICE_KEY, 'female')

export const setStoryVoice = (voice) => write(VOICE_KEY, voice)

export const getFlag = (key) => read(`flag:${key}`, false)

export function setFlag(key) {
  write(`flag:${key}`, true)
  notifyChange('settings')
}

// ---------- Hesap senkronizasyonu (sync.js) ----------

const flagKeys = () => Object.keys(localStorage).filter((k) => k.startsWith('flag:'))

/** Hesaba kaydedilecek tercihler */
export function getSettings() {
  return {
    lastStoryId: getLastStoryId(),
    preferredLevel: getPreferredLevel(),
    flags: flagKeys().map((k) => k.slice(5))
  }
}

/** Hesaptan gelen tercihleri ve okunan hikayeleri yerele yazar (bildirim üretmez) */
export function applyRemote({ settings, readStoryIds }) {
  if (settings?.lastStoryId) write(LAST_KEY, settings.lastStoryId)
  if (settings?.preferredLevel) write(LEVEL_KEY, settings.preferredLevel)
  settings?.flags?.forEach((flag) => write(`flag:${flag}`, true))
  if (readStoryIds) write(READ_KEY, [...new Set([...getReadStories(), ...readStoryIds])])
}

/** Çıkışta: bu cihazdaki okuma ilerlemesini ve tercihleri siler */
export function clearLocalStoryProgress() {
  ;[READ_KEY, LAST_KEY, LEVEL_KEY, VOICE_KEY, ...flagKeys()].forEach((k) => localStorage.removeItem(k))
}
