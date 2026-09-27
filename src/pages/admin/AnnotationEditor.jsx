import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw, Save } from 'lucide-react'
import { translatePOS } from '../../utils/format'
import styles from './AnnotationEditor.module.css'

const POS_VALUES = [
  'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'determiner', 'pronoun',
  'number', 'exclamation', 'modal verb', 'auxiliary verb', 'definite article', 'indefinite article',
  'infinitive marker', 'proper noun'
]

const SOURCE_LABELS = { manual: 'Elle işaretlendi', claude: 'Claude ile işaretlendi' }

const coreOf = (token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')

// İşaretleme yoksa boş bir iskeletle başla
const emptyToken = (token, i) => ({
  i, lemma: coreOf(token).toLowerCase(), pos: 'noun', wordId: null, sense: null, base: '',
  context: '', note: null, form: null, phrase: null
})

function TokenRow({ surface, token, senses, open, onToggle, onChange }) {
  const set = (field) => (e) => {
    const raw = e.target.value
    let value = raw
    if (field === 'sense') value = raw === '' ? null : Number(raw)
    else if (['wordId', 'note', 'form'].includes(field)) value = raw.trim() ? raw : null
    onChange({ ...token, [field]: value })
  }
  const baseText = token.wordId
    ? senses?.[token.sense]?.translation ?? '(kaydedince doğrulanır)'
    : token.base

  return (
    <li className={styles.token} data-open={open}>
      <button type="button" className={styles.summary} onClick={onToggle}>
        <strong>{surface}</strong>
        {token.lemma && coreOf(surface).toLowerCase() !== token.lemma.toLowerCase() && (
          <span className={styles.lemma}>→ {token.lemma}</span>
        )}
        <span className={styles.pos}>{translatePOS(token.pos)}</span>
        <span className={styles.context}>{token.context || '—'}</span>
        {token.note && <span className={styles.flag} title="Not var">not</span>}
      </button>

      {open && (
        <div className={styles.fields}>
          <label>
            <span>Kök</span>
            <input value={token.lemma} onChange={set('lemma')} />
          </label>
          <label>
            <span>Tür</span>
            <select value={token.pos} onChange={set('pos')}>
              {POS_VALUES.map((p) => (
                <option key={p} value={p}>{translatePOS(p)} ({p})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Oxford kimliği</span>
            <input value={token.wordId || ''} onChange={set('wordId')} placeholder="listede yoksa boş" />
          </label>
          <label>
            <span>Anlam no</span>
            <input type="number" min="0" value={token.sense ?? ''} onChange={set('sense')} disabled={!token.wordId} />
          </label>
          <label className={styles.wide}>
            <span>Temel anlam</span>
            {token.wordId ? (
              <output>{baseText}</output>
            ) : (
              <input value={token.base || ''} onChange={set('base')} />
            )}
          </label>
          <label className={styles.wide}>
            <span>Bu cümlede</span>
            <input value={token.context} onChange={set('context')} />
          </label>
          <label className={styles.wide}>
            <span>Biçim</span>
            <input value={token.form || ''} onChange={set('form')} placeholder="ör. play + -s (geniş zaman, 3. tekil şahıs)" />
          </label>
          <label className={styles.wide}>
            <span>Not</span>
            <textarea rows="2" value={token.note || ''} onChange={set('note')} />
          </label>
          {token.phrase && (
            <p className={styles.phrase}>
              Kalıp: <strong>{token.phrase.text}</strong> = {token.phrase.meaning}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function AnnotationEditor({ storyId, token, onClose, onReannotate }) {
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState(null)
  const [openToken, setOpenToken] = useState(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch(`/api/admin/stories/${encodeURIComponent(storyId)}/annotation`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => {
        setData(d)
        setDraft(
          d.annotation
            ? { sentences: d.annotation.sentences, tokens: d.annotation.tokens }
            : { sentences: d.sentences.map(() => ({ tr: '' })), tokens: d.tokens.map(emptyToken) }
        )
      })
      .catch(() => setLoadError('İşaretleme yüklenemedi.'))
  }, [storyId, token])

  const bySentence = useMemo(() => {
    if (!data) return []
    return data.sentences.map((text, k) => ({
      text,
      indices: data.tokens.map((_, i) => i).filter((i) => data.sentenceOfToken[i] === k)
    }))
  }, [data])

  const updateToken = (i, value) =>
    setDraft((d) => ({ ...d, tokens: d.tokens.map((t, j) => (j === i ? value : t)) }))
  const updateSentence = (k, tr) =>
    setDraft((d) => ({ ...d, sentences: d.sentences.map((s, j) => (j === k ? { tr } : s)) }))

  const save = async () => {
    setSaving(true)
    setResult(null)
    try {
      const response = await fetch(`/api/admin/stories/${encodeURIComponent(storyId)}/annotation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft)
      })
      const body = await response.json()
      setResult(response.ok ? { ok: true, warnings: body.warnings } : { ok: false, errors: body.errors || [body.error] })
    } catch {
      setResult({ ok: false, errors: ['Sunucuya ulaşılamadı.'] })
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <p className={styles.error}>{loadError}</p>
  if (!data || !draft) return <div className="skeleton" style={{ height: 320 }} />

  return (
    <div className={styles.editor}>
      <header className={styles.head}>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Listeye dön">
          <ArrowLeft size={20} />
        </button>
        <div className={styles.title}>
          <h2>{data.story.title}</h2>
          <small>
            {data.annotation ? SOURCE_LABELS[data.annotation.source] || data.annotation.source : 'İşaretleme yok'}
          </small>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => onReannotate(storyId)}>
          <RefreshCw size={16} /> Claude ile yeniden
        </button>
      </header>

      <p className={styles.help}>
        Bir kelimeyi düzenlemek için üzerine dokun. Kaydettiğinde işaretleme doğrulanır ve
        &quot;elle işaretlendi&quot; olarak saklanır.
      </p>

      {result && (
        <div className={result.ok ? styles.ok : styles.errors} role="status">
          {result.ok ? (
            <p>
              Kaydedildi.{result.warnings?.length ? ` ${result.warnings.length} uyarı:` : ''}
            </p>
          ) : (
            <p>Kaydedilmedi, şu hataları düzelt:</p>
          )}
          <ul>
            {(result.ok ? result.warnings : result.errors)?.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {bySentence.map(({ text, indices }, k) => (
        <section key={k} className={styles.sentence}>
          <p className={styles.english}>{text}</p>
          <label className={styles.translation}>
            <span>Türkçe çeviri</span>
            <textarea rows="2" value={draft.sentences[k]?.tr || ''} onChange={(e) => updateSentence(k, e.target.value)} />
          </label>
          <ul className={styles.tokens}>
            {indices.map((i) => (
              <TokenRow
                key={i}
                surface={data.tokens[i]}
                token={draft.tokens[i]}
                senses={data.senses[draft.tokens[i].wordId]}
                open={openToken === i}
                onToggle={() => setOpenToken(openToken === i ? null : i)}
                onChange={(value) => updateToken(i, value)}
              />
            ))}
          </ul>
        </section>
      ))}

      <div className={styles.saveBar}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Kapat</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}

export default AnnotationEditor
