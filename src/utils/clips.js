// Önceden üretilmiş seslendirmelerden kısa parçalar çalar: kelimeler, örnek cümleler ve
// hikaye cümleleri. Parça yoksa ya da açılamazsa cihazın sesiyle okunur.

import { fetchStoryAudio } from './api'
import { speak, stopSpeaking } from './speech'
import { getStoryVoice } from './storyProgress'

let current = null

export function stopClip() {
  if (!current) return
  current.stopped = true
  cancelAnimationFrame(current.frame)
  current.audio?.pause()
  try {
    current.source?.stop()
  } catch {
    // Henüz başlamamış ya da zaten bitmiş
  }
  current = null
}

// ---------- Web Audio: aralığı kesip çal ----------
// HTML <audio> ile "çal, bitişte durdur" yönteminde ses çıkışı gecikmeli cihazlar (Android) durdurmadan
// sonra da arabellekteki sesi çalar; sonraki kelimenin başı duyulur. Burada dosya çözülür ve yalnızca
// istenen aralık çalınır, böylece aralığın dışındaki ses hiç çalınmaz.

let audioContext = null
const buffers = new Map() // adres → Promise<AudioBuffer>; son birkaç dosya bellekte tutulur
const MAX_BUFFERS = 4

function getContext() {
  if (audioContext) return audioContext
  const Context = window.AudioContext || window.webkitAudioContext
  audioContext = Context ? new Context() : null
  return audioContext
}

function loadBuffer(context, url) {
  if (!buffers.has(url)) {
    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status}`)
        return response.arrayBuffer()
      })
      .then((data) => context.decodeAudioData(data))
    promise.catch(() => buffers.delete(url))
    buffers.set(url, promise)
    if (buffers.size > MAX_BUFFERS) buffers.delete(buffers.keys().next().value)
  }
  return buffers.get(url)
}

/** Seçili sese göre parça: { female: {word, example}, male: {...} } içinden */
export function clipFor(audioByVoice, kind) {
  if (!audioByVoice) return null
  const voice = getStoryVoice()
  return audioByVoice[voice]?.[kind] || audioByVoice.female?.[kind] || audioByVoice.male?.[kind] || null
}

/**
 * @param {{url:string, start:number, end:number}|null} clip  ms cinsinden aralık
 * @param {string} fallbackText  parça yoksa cihaz sesiyle okunacak metin
 */
export function playClip(clip, fallbackText, { rate = 1 } = {}) {
  stopClip()
  stopSpeaking()
  if (!clip) return void speak(fallbackText, { rate: 0.85 })

  const context = getContext()
  if (!context) return playWithElement(clip, fallbackText, rate)

  const state = { stopped: false, source: null }
  current = state
  // Dokunma anında çağrılmalı (tarayıcılar sesi ancak kullanıcı etkileşimiyle başlatır)
  context.resume().catch(() => {})
  loadBuffer(context, clip.url)
    .then((buffer) => {
      if (state.stopped) return
      const offset = clip.start / 1000
      const duration = Math.min((clip.end - clip.start) / 1000, buffer.duration - offset)
      if (duration <= 0) throw new Error('Geçersiz aralık')
      const source = context.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = rate
      source.connect(context.destination)
      source.onended = () => {
        if (current === state) current = null
      }
      state.source = source
      source.start(0, offset, duration)
    })
    .catch(() => {
      if (state.stopped) return
      current = null
      playWithElement(clip, fallbackText, rate)
    })
}

/** Web Audio kullanılamazsa: <audio> ile çal, bitişte durdur */
function playWithElement(clip, fallbackText, rate) {
  const audio = new Audio()
  const state = { audio, stopped: false, started: false, frame: null }
  current = state
  audio.preload = 'auto'
  audio.playbackRate = rate

  const fallback = () => {
    if (state.stopped || state.started) return
    stopClip()
    speak(fallbackText, { rate: 0.85 })
  }
  // Bitiş anında durdur (timeupdate çok seyrek tetiklenir)
  const watch = () => {
    if (state.stopped) return
    if (audio.currentTime * 1000 >= clip.end) return stopClip()
    state.frame = requestAnimationFrame(watch)
  }

  audio.addEventListener('error', fallback, { once: true })
  audio.addEventListener(
    'loadedmetadata',
    () => {
      if (state.stopped) return
      audio.currentTime = clip.start / 1000
      audio
        .play()
        .then(() => {
          state.started = true
          watch()
        })
        .catch(fallback)
    },
    { once: true }
  )
  audio.src = clip.url
}

/** Kelime listesindeki kelimenin belirli türdeki okunuşu */
export function wordClip(oxford, pos) {
  const senses = oxford?.senses || []
  const sense = senses.find((s) => s.pos === pos && s.audio) || senses.find((s) => s.audio)
  return sense ? clipFor(sense.audio, 'word') : null
}

/** Kelime listesindeki örnek cümlenin okunuşu */
export function exampleClip(oxford, sentence) {
  const sense = oxford?.senses.find((s) => s.example === sentence && s.audio)
  return sense ? clipFor(sense.audio, 'example') : null
}

/**
 * Hikaye cümlesinin hikayenin kendi seslendirmesindeki aralığı.
 * @param {{storyId:string, from:number, to:number}} ref  cümlenin ilk ve son kelimesinin sırası
 */
export async function storySentenceClip(ref) {
  if (!ref?.storyId) return null
  const audio = await fetchStoryAudio(ref.storyId)
  const voices = audio?.voices
  const v = voices?.[getStoryVoice()] || voices?.female || voices?.male
  if (!v || v.starts[ref.from] === undefined) return null
  const next = (v.starts[ref.to + 1] ?? v.durationMs) - 40
  // Son kelimenin ses dosyasından bulunan bitişi (biraz pay bırakılır); yoksa sonraki cümlenin başı
  const spoken = v.sentenceEnds?.[ref.to]
  const end = spoken ? Math.min(next, spoken + 120) : next
  return { url: v.url, start: v.starts[ref.from], end: Math.max(v.starts[ref.from] + 300, end) }
}
