// Hikaye metnini kelimelere ve cümlelere ayırır (sunucudaki server/storyText.js ile aynı kurallar).

import { splitSentences } from './format'

const EMPTY = { tokens: [], offsets: [], spans: [], sentenceOf: () => '', sentenceIndexOf: () => 0 }

export function analyzeStoryText(text) {
  if (!text) return EMPTY

  const tokens = text.split(/\s+/).filter(Boolean)
  let pos = 0
  const offsets = tokens.map((t) => {
    const i = text.indexOf(t, pos)
    pos = i + t.length
    return i
  })

  const sentences = splitSentences(text)
  pos = 0
  const starts = sentences.map((s) => {
    const i = text.indexOf(s, pos)
    pos = i + s.length
    return i
  })

  const sentenceIndexOf = (index) => {
    const offset = offsets[index]
    let found = 0
    starts.forEach((start, j) => {
      if (start <= offset) found = j
    })
    return found
  }
  const sentenceOf = (index) => sentences[sentenceIndexOf(index)]

  // Sesli okuma için her cümlenin kelime aralığı (yalnızca noktalamadan oluşan parçalar atlanır)
  const spans = sentences
    .map((sentence, j) => {
      const end = starts[j] + sentence.length
      const inside = offsets.map((o, t) => [o, t]).filter(([o]) => o >= starts[j] && o < end)
      return inside.length
        ? { text: sentence, start: starts[j], first: inside[0][1], last: inside[inside.length - 1][1] }
        : null
    })
    .filter(Boolean)

  return { tokens, offsets, spans, sentenceOf, sentenceIndexOf }
}
