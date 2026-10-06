// Önceden üretilmiş hikaye seslendirmesini çalar ve o an okunan kelimeyi bildirir.
// Kelime zamanları seslendirme sırasında üretildiği için vurgu sesle tam hizalıdır;
// hız (playbackRate) okuma kesilmeden anlık değiştirilebilir.

// starts artan sırada: zamanı geçmiş son kelime
function wordAt(starts, ms) {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= ms) lo = mid
    else hi = mid - 1
  }
  return lo
}

/**
 * @param {object} p
 * @param {string} p.url
 * @param {number[]} p.starts  her kelimenin sesteki başlangıcı (ms)
 * @param {number} p.rate
 * @param {(index:number)=>void} p.onWord
 * @param {()=>void} p.onDone
 * @param {()=>void} p.onError  ses açılamadı (ör. çevrimdışı); hiç çalmadan önce çağrılır
 * @param {number} [p.startIndex]
 */
export function playStoryAudio({ url, starts, rate, onWord, onDone, onError, startIndex = 0 }) {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = url
  audio.playbackRate = rate

  let finished = false
  let started = false
  let frame = null
  let lastWord = -1

  const cleanup = () => {
    finished = true
    cancelAnimationFrame(frame)
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }

  const tick = () => {
    if (finished) return
    const index = wordAt(starts, audio.currentTime * 1000)
    if (index !== lastWord) {
      lastWord = index
      onWord(index)
    }
    frame = requestAnimationFrame(tick)
  }

  audio.addEventListener('playing', () => {
    started = true
    cancelAnimationFrame(frame)
    tick()
  })
  audio.addEventListener('ended', () => {
    if (finished) return
    cleanup()
    onDone()
  })
  audio.addEventListener('error', () => {
    if (finished) return
    cleanup()
    started ? onDone() : onError()
  })

  if (startIndex > 0 && starts[startIndex] !== undefined) {
    // Konum, ses dosyasının bilgileri yüklenince ayarlanabilir
    audio.addEventListener('loadedmetadata', () => (audio.currentTime = starts[startIndex] / 1000), { once: true })
  }

  audio.play().catch((err) => {
    if (finished || err?.name === 'AbortError') return
    cleanup()
    onError()
  })

  return {
    stop: cleanup,
    setRate: (r) => {
      audio.playbackRate = r
    }
  }
}
