// Yönetim panelinden eklenen hikayeleri Claude API ile işaretler.
// Kurallar server/prompts/annotation-standard.md dosyasındadır; çıktı
// validateAnnotation ile denetlenir, hata varsa bir kez düzeltmesi istenir.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import winkNLP from 'wink-nlp'
import model from 'wink-eng-lite-web-model'
import { analyzeStory, coreOf, textHash } from './storyText.js'
import { getWordById } from './vocabularyManager.js'
import { isCurrent, readAnnotation, writeAnnotation } from './annotationStore.js'
import { POS_VALUES, validateAnnotation } from './scripts/validateAnnotations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STANDARD = fs.readFileSync(path.join(__dirname, 'prompts', 'annotation-standard.md'), 'utf8')

const MODEL = 'claude-opus-5'
const nlp = winkNLP(model)

let client = null
const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY tanımlı değil')
  client ??= new Anthropic()
  return client
}

// ---------- Oxford 3000 anlam adayları ----------

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Kurala uymayan biçimler ve kısaltmalar → listede aranacak kök
const IRREGULAR = {
  swam: 'swim', drank: 'drink', sang: 'sing', began: 'begin', ran: 'run', ate: 'eat', sat: 'sit',
  was: 'be', were: 'be', been: 'be', am: 'be', is: 'be', are: 'be', did: 'do', done: 'do',
  had: 'have', has: 'have', went: 'go', gone: 'go', better: 'good', best: 'good',
  worse: 'bad', worst: 'bad', men: 'man', women: 'woman', children: 'child', people: 'person',
  feet: 'foot', teeth: 'tooth', these: 'this', those: 'that', used: 'used to', could: 'can',
  would: 'will', won: 'win', "won't": 'will', "can't": 'can', "couldn't": 'can', tire: 'tyre'
}

// Çekimli bir kelimeden olası kök biçimleri (listede aranacak kimlikler)
function candidateIds(surface) {
  const w = surface.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'").replace(/'s$/, '')
  const forms = new Set([w, w.replace(/n't$/, ''), w.replace(/'(m|re|ve|ll|d)$/, '')])
  const lemma = nlp.readDoc(w).tokens().itemAt(0)?.out(nlp.its.lemma)
  if (lemma) forms.add(lemma)
  const strip = [
    [/ies$/, 'y'], [/ied$/, 'y'], [/ier$/, 'y'], [/iest$/, 'y'], [/es$/, ''], [/s$/, ''],
    [/ed$/, ''], [/ed$/, 'e'], [/d$/, ''], [/ing$/, ''], [/ing$/, 'e'], [/er$/, ''], [/est$/, ''],
    [/(.)\1(ed|ing|er|est)$/, '$1'], [/ly$/, ''], [/ily$/, 'y']
  ]
  for (const [re, to] of strip) if (re.test(w)) forms.add(w.replace(re, to))
  for (const f of [...forms]) if (IRREGULAR[f]) forms.add(IRREGULAR[f])
  // Amerikan yazımı → listedeki İngiliz yazımı
  for (const f of [...forms]) {
    forms.add(f.replace(/or(ite)?$/, 'our$1'))
    forms.add(f.replace(/er$/, 're'))
    forms.add(f.replace(/ense$/, 'ence'))
    forms.add(f.replace(/ize$/, 'ise'))
    forms.add(f.replace(/ice$/, 'ise'))
  }
  if (w === 'a' || w === 'an') forms.add('a-an')
  const ids = []
  for (const f of forms) {
    for (const id of [slug(f), `${slug(f)}-noun`]) {
      if (getWordById(id) && !ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

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
