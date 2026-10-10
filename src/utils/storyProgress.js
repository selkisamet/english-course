// Okunan hikayeler ve kullanıcı tercihleri (localStorage)

import { notifyChange } from './changes'

const READ_KEY = 'readStories'
const LAST_KEY = 'selectedStoryId'
const LEVEL_KEY = 'preferredLevel'
const VOICE_KEY = 'storyVoice'
const DAILY_NEW_KEY = 'dailyNewWords'

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
  notifyChange('settings', { prefs: true })
}

// Hikaye seslendirmesinde seçilen ses: 'female' | 'male'
export const getStoryVoice = () => read(VOICE_KEY, 'female')

export const setStoryVoice = (voice) => write(VOICE_KEY, voice)

// Kelime çalışmasında günde kaç yeni kelime öğretileceği
export const DAILY_NEW_OPTIONS = [5, 10, 15, 20]
export const getDailyNewWords = () => {
  const value = read(DAILY_NEW_KEY, 10)
  return DAILY_NEW_OPTIONS.includes(value) ? value : 10
}

export function setDailyNewWords(count) {
  write(DAILY_NEW_KEY, count)
  notifyChange('settings', { prefs: true })
}

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
    dailyNewWords: getDailyNewWords(),
    flags: flagKeys().map((k) => k.slice(5))
  }
}

/** Hesaptan gelen tercihleri ve okunan hikayeleri yerele yazar (bildirim üretmez) */
export function applyRemote({ settings, readStoryIds }) {
  if (settings?.lastStoryId) write(LAST_KEY, settings.lastStoryId)
  if (settings?.preferredLevel) write(LEVEL_KEY, settings.preferredLevel)
  if (DAILY_NEW_OPTIONS.includes(settings?.dailyNewWords)) write(DAILY_NEW_KEY, settings.dailyNewWords)
  settings?.flags?.forEach((flag) => write(`flag:${flag}`, true))
  if (readStoryIds) write(READ_KEY, [...new Set([...getReadStories(), ...readStoryIds])])
}

/** Çıkışta: bu cihazdaki okuma ilerlemesini ve tercihleri siler */
export function clearLocalStoryProgress() {
  ;[READ_KEY, LAST_KEY, LEVEL_KEY, VOICE_KEY, DAILY_NEW_KEY, ...flagKeys()].forEach((k) => localStorage.removeItem(k))
}
