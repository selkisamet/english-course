// Metni cümle cümle seslendirir ve o an okunan kelimeyi bildirir.
//
// Neden cümle cümle: tarayıcıların "cümle bitti" (onend) olayı her platformda güvenilirdir,
// böylece vurgu her cümle başında sesle yeniden hizalanır ve hata birikmez.
// Kelime sınırı (onboundary) olayları masaüstünde doğru gelir; bazı mobil seslerde hiç gelmez
// ya da okuma başlar başlamaz topluca gelir. Sesten imkânsız derecede önce gelen olaylar
// yok sayılır ve konum; harf sayısı ile noktalama duraksamalarından tahmin edilir.
// Tahmin, biten her cümlenin gerçek süresiyle cihazın ses hızına göre kalibre edilir.

import { speak, stopSpeaking } from './speech'

// Noktalama işaretlerinde seslendirme kısa bir duraksama yapar
const PAUSE_WEIGHT = { ',': 5, ';': 6, ':': 6, '—': 5, '-': 1 }
const charWeight = (ch) => 1 + (PAUSE_WEIGHT[ch] || 0)

// Hız 1'de bir ağırlık biriminin süresi (ms). Cihaza göre öğrenilir, oturum boyunca korunur.
let msPerWeight = 62
// null: henüz bilinmiyor, false: bu tarayıcının kelime sınırı olaylarına güvenilmez
let boundaryReliable = null

const TICK_MS = 80

/**
 * @param {object} p
 * @param {Array<{text:string,start:number,first:number,last:number}>} p.sentences
 * @param {number[]} p.offsets  her kelimenin metindeki başlangıç konumu
 * @param {number} p.rate
 * @param {(index:number)=>void} p.onWord
 * @param {()=>void} p.onDone
 */
export function readAloud({ sentences, offsets, rate, onWord, onDone }) {
  let cancelled = false
  let timer = null
  let current = null // referansı tut: bazı tarayıcılar aksi halde onend göndermiyor
  let index = 0

  const stop = () => {
    cancelled = true
    clearInterval(timer)
    stopSpeaking()
  }

  const playSentence = () => {
    if (cancelled) return
    if (index >= sentences.length) return onDone()

    const sentence = sentences[index]
    const { text, start, first, last } = sentence

    // Cümledeki her kelimenin başlangıcına kadarki toplam ağırlık
    const cumulative = []
    let weight = 0
    let tokenCursor = first
    for (let c = 0; c < text.length; c++) {
      while (tokenCursor <= last && offsets[tokenCursor] - start === c) {
        cumulative[tokenCursor - first] = weight
        tokenCursor++
      }
      weight += charWeight(text[c])
    }
    const totalWeight = weight
    for (let t = 0; t <= last - first; t++) {
      if (cumulative[t] === undefined) cumulative[t] = t === 0 ? 0 : cumulative[t - 1]
    }

    const tokenForWeight = (w) => {
      let t = 0
      while (t + 1 < cumulative.length && cumulative[t + 1] <= w) t++
      return first + t
    }
    const tokenForChar = (charIndex) => {
      let t = first
      while (t < last && offsets[t + 1] - start <= charIndex) t++
      return t
    }

    let startedAt = null
    let followingBoundaries = false

    current = speak(text, {
      rate,
      onStart: () => {
        if (cancelled) return
        startedAt = performance.now()
        onWord(first)
        clearInterval(timer)
        timer = setInterval(() => {
          if (cancelled || followingBoundaries) return
          const elapsedWeight = ((performance.now() - startedAt) * rate) / msPerWeight
          onWord(tokenForWeight(Math.min(elapsedWeight, totalWeight)))
        }, TICK_MS)
      },
      onBoundary: (e) => {
        if (cancelled || startedAt === null || boundaryReliable === false) return
        if (e.name && e.name !== 'word') return
        const elapsed = performance.now() - startedAt
        const expected = (e.charIndex * msPerWeight) / rate
        // Olay, sesin o noktaya gelmesinden çok önce geldiyse bu tarayıcıya güvenme
        if (e.charIndex > 8 && elapsed < expected * 0.35) {
          boundaryReliable = false
          followingBoundaries = false
          return
        }
        boundaryReliable = true
        followingBoundaries = true
        onWord(tokenForChar(e.charIndex))
      },
      onEnd: () => {
        if (cancelled) return
        clearInterval(timer)
        const duration = startedAt === null ? 0 : performance.now() - startedAt
        // Gerçek süreyle tahmini kalibre et (çok kısa cümleler ölçüm için güvenilmez)
        if (totalWeight > 20 && duration > 400) {
          const measured = (duration * rate) / totalWeight
          msPerWeight = Math.min(150, Math.max(30, msPerWeight * 0.4 + measured * 0.6))
        }
        index++
        playSentence()
      }
    })
    if (!current) onDone()
  }

  playSentence()
  return { stop, get utterance() { return current } }
}
