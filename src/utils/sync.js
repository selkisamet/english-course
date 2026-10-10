// Yerel ilerleme ↔ Supabase hesabı eşitlemesi.
// Uygulama her zaman yerel veriden çalışır (çevrimdışı da); bu modül girişte hesaptaki veriyle
// birleştirir ve sonraki değişiklikleri arka planda hesaba yazar.

import { supabase } from './supabase'
import { onLocalChange } from './changes'
import { applyRemoteWords, clearLocalProgress, getProgress } from './vocabularyStorage'
import { applyRemote, clearLocalStoryProgress, getReadStories, getSettings } from './storyProgress'

const OWNER_KEY = 'syncOwner' // bu cihazdaki yerel verinin ait olduğu kullanıcı
const QUEUE_KEY = 'syncQueue' // henüz hesaba yazılamamış değişiklikler (çevrimdışı)
const DELAY = 2000

let userId = null
let unsubscribe = null
let timer = null
let flushing = null

const readQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || emptyQueue()
  } catch {
    return emptyQueue()
  }
}
function mergeDaily(a = {}, b = {}) {
  const merged = { ...a }
  for (const [day, counts] of Object.entries(b)) {
    const mine = merged[day] || {}
    merged[day] = Object.fromEntries(
      [...new Set([...Object.keys(mine), ...Object.keys(counts)])].map((k) => [k, Math.max(mine[k] || 0, counts[k] || 0)])
    )
  }
  return merged
}

const emptyQueue = () => ({ words: [], removed: [], read: [], unread: [], settings: false, all: false })
const writeQueue = (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
const addUnique = (list, value) => (list.includes(value) ? list : [...list, value])

function enqueue(type, detail) {
  const q = readQueue()
  if (type === 'word') {
    q.words = addUnique(q.words, detail.wordId)
    q.removed = q.removed.filter((id) => id !== detail.wordId)
    q.settings = true // istatistikler (seri, toplam tekrar) değişti
  } else if (type === 'word-removed') {
    q.removed = addUnique(q.removed, detail.wordId)
    q.words = q.words.filter((id) => id !== detail.wordId)
  } else if (type === 'words-reset') {
    q.all = true
  } else if (type === 'read') {
    const [add, remove] = detail.read ? ['read', 'unread'] : ['unread', 'read']
    q[add] = addUnique(q[add], detail.storyId)
    q[remove] = q[remove].filter((id) => id !== detail.storyId)
  } else if (type === 'settings') {
    q.settings = true
    // Kullanıcının seçtiği tercih (seviye, günlük yeni kelime): hesaba yazılana kadar yerel kazanır
    if (detail?.prefs) q.prefs = true
  }
  writeQueue(q)
  clearTimeout(timer)
  timer = setTimeout(flush, DELAY)
}

const wordRow = (entry) => ({
  word_id: entry.wordId,
  data: entry,
  updated_at: new Date(entry.updatedAt || Date.now()).toISOString()
})

/** Bekleyen değişiklikleri hesaba yazar; başarısız olursa kuyrukta kalır. */
export function flush() {
  if (!userId || !navigator.onLine) return Promise.resolve()
  if (flushing) return flushing
  const q = readQueue()
  writeQueue(emptyQueue())

  flushing = (async () => {
    try {
      const { words } = getProgress()
      if (q.all) {
        await check(supabase.from('word_progress').delete().eq('user_id', userId))
        q.words = Object.keys(words)
      }
      const rows = q.words.map((id) => words[id]).filter(Boolean).map(wordRow)
      for (let i = 0; i < rows.length; i += 500) {
        await check(supabase.from('word_progress').upsert(rows.slice(i, i + 500)))
      }
      if (q.removed.length) {
        await check(supabase.from('word_progress').delete().eq('user_id', userId).in('word_id', q.removed))
      }
      if (q.read.length) {
        await check(supabase.from('read_stories').upsert(q.read.map((story_id) => ({ story_id }))))
      }
      if (q.unread.length) {
        await check(supabase.from('read_stories').delete().eq('user_id', userId).in('story_id', q.unread))
      }
      if (q.settings || q.all) {
        await check(
          supabase.from('user_settings').upsert({
            data: { ...getSettings(), vocabStats: getProgress().stats },
            updated_at: new Date().toISOString()
          })
        )
      }
    } catch (error) {
      // Yazılamayanları kuyruğa geri koy; bağlantı gelince yeniden denenir
      const current = readQueue()
      writeQueue({
        words: [...new Set([...q.words, ...current.words])],
        removed: [...new Set([...q.removed, ...current.removed])],
        read: [...new Set([...q.read, ...current.read])],
        unread: [...new Set([...q.unread, ...current.unread])],
        settings: q.settings || current.settings,
        prefs: q.prefs || current.prefs,
        all: q.all || current.all
      })
      console.warn('Sync failed, will retry:', error.message)
    } finally {
      flushing = null
    }
  })()
  return flushing
}

async function check(promise) {
  const { error } = await promise
  if (error) throw error
}

/** Hesaptaki veriyi çekip yerel veriyle birleştirir (kelime bazında yeni olan kazanır). */
async function pull() {
  const [words, read, settings] = await Promise.all([
    fetchAll((from, to) => supabase.from('word_progress').select('data').range(from, to)),
    fetchAll((from, to) => supabase.from('read_stories').select('story_id').range(from, to)),
    supabase.from('user_settings').select('data').maybeSingle()
  ])
  if (settings.error) throw settings.error

  const local = getProgress().words
  const remoteById = new Map(words.map(({ data }) => [data.wordId, data]))
  const newer = []
  for (const data of remoteById.values()) {
    const mine = local[data.wordId]
    if (!mine || (data.updatedAt || 0) > (mine.updatedAt || 0)) newer.push(data)
  }
  const remoteStats = settings.data?.data?.vocabStats
  const localStats = getProgress().stats
  const useRemoteStats =
    remoteStats && (remoteStats.lastStudyDate || '') >= (localStats.lastStudyDate || '')
  // Günlük çalışma kaydı iki cihazda da tutulmuş olabilir: gün gün büyük olanı al
  const daily = mergeDaily(localStats.daily, remoteStats?.daily)
  applyRemoteWords(newer, { ...(useRemoteStats ? remoteStats : localStats), daily })
  // Hesaba henüz yazılmamış bir tercih değişikliği varsa hesaptaki eski tercih onu ezmesin
  const pendingPrefs = readQueue().prefs
  applyRemote({ settings: pendingPrefs ? null : settings.data?.data, readStoryIds: read.map((r) => r.story_id) })

  // Yerelde olup hesapta olmayanlar ya da yerelde daha yeni olanlar hesaba yazılır
  const q = readQueue()
  for (const [id, entry] of Object.entries(getProgress().words)) {
    const remote = remoteById.get(id)
    if (!remote || (entry.updatedAt || 0) > (remote.updatedAt || 0)) {
      q.words = addUnique(q.words, id)
    }
  }
  const remoteRead = new Set(read.map((r) => r.story_id))
  getReadStories().forEach((id) => !remoteRead.has(id) && (q.read = addUnique(q.read, id)))
  q.settings = true
  writeQueue(q)
}

async function fetchAll(query) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const onOnline = () => flush()

/**
 * Giriş yapan kullanıcı için eşitlemeyi başlatır. Cihazdaki veri başka bir hesaba aitse önce
 * silinir; hiçbir hesaba ait değilse (giriş öncesi ilerleme) bu hesaba aktarılır.
 */
export async function startSync(id) {
  if (userId === id) return
  stopSync()
  const owner = localStorage.getItem(OWNER_KEY)
  if (owner && owner !== id) clearLocalData()
  localStorage.setItem(OWNER_KEY, id)
  userId = id
  unsubscribe = onLocalChange(enqueue)
  window.addEventListener('online', onOnline)
  try {
    await pull()
    await flush()
  } catch (error) {
    console.warn('Initial sync failed (offline?):', error.message)
  }
}

export function stopSync() {
  clearTimeout(timer)
  unsubscribe?.()
  unsubscribe = null
  window.removeEventListener('online', onOnline)
  userId = null
}

/** Çıkışta: bekleyenleri yazmayı dener, sonra bu cihazdaki kişisel veriyi siler */
export async function endSync() {
  try {
    await flush()
  } catch {
    // Çevrimdışıysa yazılamayanlar kaybolur; hesaptaki son hal korunur
  }
  stopSync()
  clearLocalData()
}

function clearLocalData() {
  clearLocalProgress()
  clearLocalStoryProgress()
  localStorage.removeItem(QUEUE_KEY)
  localStorage.removeItem(OWNER_KEY)
}
