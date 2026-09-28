// Yönetim panelinden eklenen hikayeleri Claude API ile işaretler.
// Kurallar server/prompts/annotation-standard.md dosyasındadır; çıktı
// validateAnnotation ile denetlenir, hata varsa bir kez düzeltmesi istenir.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { analyzeStory, coreOf, textHash } from './storyText.js'
import { getWordById } from './vocabularyManager.js'
import { candidateIds } from './vocabLookup.js'
import { isCurrent, readAnnotation, writeAnnotation } from './annotationStore.js'
import { POS_VALUES, validateAnnotation } from './scripts/validateAnnotations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STANDARD = fs.readFileSync(path.join(__dirname, 'prompts', 'annotation-standard.md'), 'utf8')

const MODEL = 'claude-opus-5'

let client = null
const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY tanımlı değil')
  client ??= new Anthropic()
  return client
}

// ---------- Oxford 3000 anlam adayları ----------

const describeWord = (id) => {
  const w = getWordById(id)
  return `${id}: ${w.senses.map((s, k) => `${k}=${s.pos}: ${s.translation}`).join(' | ')}`
}

// ---------- İstem ----------

export function buildPrompt(story) {
  const { tokens, sentences, sentenceOfToken } = analyzeStory(story.text)
  const dictionary = new Set()
  const lines = sentences.map((s, k) => {
    const items = tokens
      .map((t, i) => ({ t, i }))
      .filter(({ i }) => sentenceOfToken[i] === k)
      .map(({ t, i }) => {
        const ids = candidateIds(coreOf(t))
        ids.forEach((id) => dictionary.add(id))
        return `  ${i}: ${t}${ids.length ? `   [adaylar: ${ids.join(', ')}]` : ''}`
      })
    return `S${k}: ${s}\n${items.join('\n')}`
  })

  return [
    `Hikaye: "${story.title}" (seviye ${story.level})`,
    '',
    'Cümleler ve kelimeler (numara: metindeki biçim):',
    lines.join('\n'),
    '',
    'Oxford 3000 listesindeki aday kelimeler ve anlamları (kimlik: sıra=tür: Türkçe):',
    [...dictionary].map(describeWord).join('\n') || '(yok)',
    '',
    `Bu hikayedeki ${tokens.length} kelimenin hepsini sırayla işaretle ve ${sentences.length} cümlenin her birinin Türkçe çevirisini yaz.`
  ].join('\n')
}

const SYSTEM = `${STANDARD}

## Çıktı biçimi

- Her kelime için bir kayıt ver; \`i\` kelimenin numarasıdır ve sıra metindekiyle aynı olmalıdır.
- \`wordId\` yalnızca o kelimenin yanında verilen adaylardan biri olabilir; \`sense\` o kimliğin anlam sırasıdır.
  Uygun aday yoksa \`wordId\` boş metin, \`sense\` -1 olur ve \`base\` alanına kısa, doğru Türkçe temel anlam yazılır.
  Listeye bağlanan kelimelerde \`base\` boş bırakılır.
- Boş bırakılacak isteğe bağlı alanlar (\`note\`, \`form\`, \`base\`) için boş metin kullan; kalıp yoksa \`phrase\` null olur.
- Özel isimlerde \`pos\` "proper noun", \`base\` açıklayıcı olur: "(erkek adı)", "(şehir adı)".
- Not ve açıklamalarda İngilizce örnekleri *italik* (tek yıldız), Türkçedeki vurguyu **kalın** yaz.`

const phraseSchema = {
  type: 'object',
  properties: {
    from: { type: 'integer' },
    to: { type: 'integer' },
    text: { type: 'string' },
    meaning: { type: 'string' }
  },
  required: ['from', 'to', 'text', 'meaning'],
  additionalProperties: false
}

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: { tr: { type: 'string' } },
        required: ['tr'],
        additionalProperties: false
      }
    },
    tokens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          lemma: { type: 'string' },
          pos: { type: 'string', enum: POS_VALUES },
          wordId: { type: 'string' },
          sense: { type: 'integer' },
          base: { type: 'string' },
          context: { type: 'string' },
          note: { type: 'string' },
          form: { type: 'string' },
          phrase: { anyOf: [phraseSchema, { type: 'null' }] }
        },
        required: ['i', 'lemma', 'pos', 'wordId', 'sense', 'base', 'context', 'note', 'form', 'phrase'],
        additionalProperties: false
      }
    }
  },
  required: ['sentences', 'tokens'],
  additionalProperties: false
}

// Modelin çıktısını dosyadaki işaretleme biçimine çevirir
function toAnnotation(story, output) {
  const orNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    storyId: story.id,
    textHash: textHash(story.text),
    source: 'claude',
    sentences: output.sentences.map((s) => ({ tr: s.tr.trim() })),
    tokens: output.tokens.map((t) => {
      const wordId = orNull(t.wordId)
      return {
        i: t.i,
        lemma: t.lemma.trim(),
        pos: t.pos,
        wordId,
        sense: wordId ? t.sense : null,
        ...(wordId ? {} : { base: orNull(t.base) }),
        context: t.context.trim(),
        note: orNull(t.note),
        form: orNull(t.form),
        phrase: t.phrase || null
      }
    })
  }
}

// ---------- Claude çağrısı ----------

async function requestAnnotation(messages) {
  // Güvenlik sınıflandırıcısı isteği reddederse sunucu tarafında önerilen modelle yeniden dener
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages
  })
  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') throw new Error('Model isteği reddetti')
  if (message.stop_reason === 'max_tokens') throw new Error('Yanıt uzunluk sınırına takıldı')
  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Yanıtta metin yok')
  return { message, output: JSON.parse(text) }
}

/** Hikayeyi işaretler, doğrular ve kaydeder. Uyarıları döner; hata varsa fırlatır. */
export async function annotateStory(story) {
  const messages = [{ role: 'user', content: buildPrompt(story) }]
  let { message, output } = await requestAnnotation(messages)
  let annotation = toAnnotation(story, output)
  let { errors, warnings } = validateAnnotation(story, annotation)

  if (errors.length) {
    // Bir kez, hatalarla birlikte düzeltmesini iste
    messages.push({ role: 'assistant', content: message.content })
    messages.push({
      role: 'user',
      content: `İşaretlemede şu hatalar var:\n${errors.map((e) => `- ${e}`).join('\n')}\n\nHataları düzelterek bütün işaretlemeyi yeniden ver.`
    })
    ;({ output } = await requestAnnotation(messages))
    annotation = toAnnotation(story, output)
    ;({ errors, warnings } = validateAnnotation(story, annotation))
    if (errors.length) throw new Error(`Doğrulama hataları: ${errors.slice(0, 5).join('; ')}`)
  }

  writeAnnotation(annotation)
  return { warnings }
}

// ---------- Arka plan kuyruğu ve durum ----------

const jobs = new Map() // storyId → { status: 'pending' | 'failed', error?, textHash }
let queue = Promise.resolve()

/** İşaretlemeyi arka planda sıraya alır; hikaye bu sırada yine de yayındadır. */
export function queueAnnotation(story) {
  const hash = textHash(story.text)
  if (jobs.get(story.id)?.status === 'pending' && jobs.get(story.id).textHash === hash) return
  jobs.set(story.id, { status: 'pending', textHash: hash })
  queue = queue.then(async () => {
    // Beklerken metin yeniden değiştiyse bu iş eskidir
    if (jobs.get(story.id)?.textHash !== hash) return
    try {
      const { warnings } = await annotateStory(story)
      jobs.delete(story.id)
      console.log(`İşaretlendi: ${story.id} (${warnings.length} uyarı)`)
    } catch (error) {
      jobs.set(story.id, { status: 'failed', error: error.message, textHash: hash })
      console.error(`İşaretleme başarısız: ${story.id}:`, error.message)
    }
  })
}

export function forgetAnnotationJob(storyId) {
  jobs.delete(storyId)
}

/** Yönetim paneli için işaretleme durumu */
export function getAnnotationStatus(story) {
  const job = jobs.get(story.id)
  if (job?.status === 'pending') return { status: 'pending' }
  const annotation = readAnnotation(story.id)
  if (annotation && isCurrent(annotation, story)) return { status: 'ready', source: annotation.source }
  if (job?.status === 'failed' && job.textHash === textHash(story.text)) return { status: 'failed', error: job.error }
  return { status: 'none' }
}
