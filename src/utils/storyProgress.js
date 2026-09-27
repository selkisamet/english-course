// Okunan hikayeler ve kullanıcı tercihleri (localStorage)

const READ_KEY = 'readStories'
const LAST_KEY = 'selectedStoryId'
const LEVEL_KEY = 'preferredLevel'

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

export const setLastStoryId = (id) => write(LAST_KEY, id)

export const getPreferredLevel = () => read(LEVEL_KEY, null)

export const setPreferredLevel = (level) => write(LEVEL_KEY, level)

export const getFlag = (key) => read(`flag:${key}`, false)

export const setFlag = (key) => write(`flag:${key}`, true)
