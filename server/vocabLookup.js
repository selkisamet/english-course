// Metindeki bir kelimenin Oxford 3000 listesindeki olası karşılıkları.
// Otomatik işaretleme (storyAnnotator), elle işaretleme araçları ve seviye raporu ortak kullanır.

import winkNLP from 'wink-nlp'
import model from 'wink-eng-lite-web-model'
import { getWordById } from './vocabularyManager.js'

const nlp = winkNLP(model)

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Kurala uymayan biçimler ve kısaltmalar → listede aranacak kök
const IRREGULAR = {
  was: 'be', were: 'be', been: 'be', am: 'be', is: 'be', are: 'be', did: 'do', done: 'do', does: 'do',
  had: 'have', has: 'have', went: 'go', gone: 'go', better: 'good', best: 'good',
  worse: 'bad', worst: 'bad', men: 'man', women: 'woman', children: 'child', people: 'person',
  feet: 'foot', teeth: 'tooth', mice: 'mouse', these: 'this', those: 'that', used: 'used to',
  could: 'can', would: 'will', "won't": 'will', "can't": 'can', "couldn't": 'can', tire: 'tyre',
  ate: 'eat', began: 'begin', bit: 'bite', blew: 'blow', broke: 'break', broken: 'break',
  brought: 'bring', built: 'build', bought: 'buy', caught: 'catch', chose: 'choose',
  chosen: 'choose', came: 'come', cost: 'cost', cut: 'cut', drank: 'drink', drew: 'draw',
  drawn: 'draw', drove: 'drive', driven: 'drive', fell: 'fall', fallen: 'fall', felt: 'feel',
  fought: 'fight', found: 'find', flew: 'fly', flown: 'fly', forgot: 'forget', forgotten: 'forget',
  froze: 'freeze', got: 'get', gotten: 'get', gave: 'give', given: 'give', grew: 'grow',
  grown: 'grow', hung: 'hang', heard: 'hear', hid: 'hide', hidden: 'hide', hit: 'hit', held: 'hold',
  hurt: 'hurt', kept: 'keep', knew: 'know', known: 'know', laid: 'lay', led: 'lead', left: 'leave',
  lent: 'lend', lay: 'lie', lit: 'light', lost: 'lose', made: 'make', meant: 'mean', met: 'meet',
  paid: 'pay', put: 'put', quit: 'quit', read: 'read', rode: 'ride', rang: 'ring', rose: 'rise',
  ran: 'run', said: 'say', saw: 'see', seen: 'see', sold: 'sell', sent: 'send', set: 'set',
  shook: 'shake', shone: 'shine', shot: 'shoot', shut: 'shut', sang: 'sing', sank: 'sink',
  sat: 'sit', slept: 'sleep', spoke: 'speak', spoken: 'speak', spent: 'spend', spread: 'spread',
  stood: 'stand', stole: 'steal', stolen: 'steal', stuck: 'stick', struck: 'strike', swam: 'swim',
  took: 'take', taken: 'take', taught: 'teach', tore: 'tear', told: 'tell', thought: 'think',
  threw: 'throw', thrown: 'throw', understood: 'understand', woke: 'wake', woken: 'wake',
  wore: 'wear', worn: 'wear', won: 'win', wrote: 'write', written: 'write'
}

const normalize = (surface) =>
  surface
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/’/g, "'")
    .replace(/'s$/, '')

/** Çekimli bir kelimeden olası kök biçimlerinin listedeki kimlikleri */
export function candidateIds(surface) {
  const w = normalize(surface)
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

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
export const levelRank = (level) => LEVEL_ORDER.indexOf(level)

/** Kelimenin listedeki en düşük seviyesi (hiçbir aday yoksa null) */
export function lowestLevel(surface) {
  let best = null
  for (const id of candidateIds(surface)) {
    for (const s of getWordById(id).senses) {
      if (s.level && (best === null || levelRank(s.level) < levelRank(best))) best = s.level
    }
  }
  return best
}
