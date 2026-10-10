// Kelime listesindeki her kelimenin hangi hikayelerde, hangi cümlede geçtiği.
// İşaretlemelerden üretilir; hikaye ya da işaretleme değişince kendiliğinden yenilenir.

import { getAnnotationVersion, isCurrent, readAnnotation } from './annotationStore.js'
import { getAllStories } from './storyManager.js'
import { analyzeStory, coreOf, textHash } from './storyText.js'

let cache = null

// Hikayeler ve işaretlemeleri değişmediyse dizin yeniden kurulmaz
const signatureOf = (stories) =>
  `${getAnnotationVersion()}|` + stories.map((s) => `${s.id}:${textHash(s.text)}:${s.title}:${s.level}`).join('|')

function buildIndex(stories) {
  const index = new Map()
  for (const story of stories) {
    const annotation = readAnnotation(story.id)
    if (!annotation || !isCurrent(annotation, story)) continue
    const { tokens, sentences, sentenceOfToken } = analyzeStory(story.text)
    const seen = new Set()
    annotation.tokens.forEach((token, i) => {
      // Aynı hikayede bir kelime bir kez listelenir (ilk geçtiği cümleyle)
      if (!token?.wordId || seen.has(token.wordId)) return
      seen.add(token.wordId)
      if (!index.has(token.wordId)) index.set(token.wordId, [])
      index.get(token.wordId).push({
        storyId: story.id,
        title: story.title,
        level: story.level,
        sentence: sentences[sentenceOfToken[i]],
        form: coreOf(tokens[i]),
        translation: annotation.sentences[sentenceOfToken[i]]?.tr || ''
      })
    })
  }
  return index
}

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Kelimenin geçtiği hikayeler, kolaydan zora */
export function getStoriesForWord(wordId) {
  const stories = getAllStories()
  const signature = signatureOf(stories)
  if (!cache || cache.signature !== signature) cache = { signature, index: buildIndex(stories) }
  return [...(cache.index.get(wordId) || [])].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
  )
}

