// Tarayıcının yerleşik İngilizce seslendirmesi (Web Speech API)

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

export function speak(text, { rate = 0.85, onStart, onEnd, onBoundary } = {}) {
  if (!canSpeak || !text) return null

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
  if (canSpeak) window.speechSynthesis.cancel()
}
