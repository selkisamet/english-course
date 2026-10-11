// Cihazın yerleşik İngilizce seslendirmesi.
// Tarayıcıda Web Speech API; telefon uygulamasında (Android'in uygulama içi tarayıcısında bu API yok)
// işletim sisteminin seslendirme motoru kullanılır.

import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { isNative } from './platform'

const hasWebSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window

export const canSpeak = isNative || hasWebSpeech

// Telefonda son başlatılan okuma; yenisi başlayınca eskisinin onEnd'i çağrılmaz
let nativeRun = 0

function speakNative(text, { rate, onStart, onEnd }) {
  const run = ++nativeRun
  TextToSpeech.stop()
    .catch(() => {})
    .then(() => {
      if (run !== nativeRun) return
      onStart?.()
      return TextToSpeech.speak({ text, lang: 'en-US', rate, pitch: 1, volume: 1 })
    })
    .catch(() => {})
    .finally(() => {
      if (run === nativeRun) onEnd?.()
    })
  return { native: true }
}

export function speak(text, { rate = 0.85, onStart, onEnd, onBoundary } = {}) {
  if (!canSpeak || !text) return null
  if (isNative) return speakNative(text, { rate, onStart, onEnd })

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = rate
  utterance.pitch = 1
  if (onStart) utterance.onstart = onStart
  if (onEnd) {
    utterance.onend = onEnd
    utterance.onerror = onEnd
  }
  if (onBoundary) utterance.onboundary = onBoundary

  window.speechSynthesis.speak(utterance)
  return utterance
}

export function stopSpeaking() {
  if (isNative) {
    nativeRun += 1
    TextToSpeech.stop().catch(() => {})
  } else if (hasWebSpeech) {
    window.speechSynthesis.cancel()
  }
}
