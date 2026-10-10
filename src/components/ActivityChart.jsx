import { useMemo, useState } from 'react'
import { getActivity } from '../utils/activity'
import styles from './ActivityChart.module.css'

const RANGES = [7, 30]

// Eksenin üst sınırı: yarısı da tam sayı olan yuvarlak bir değer
const STEPS = [4, 10, 20, 40, 60, 100, 200, 400, 600, 1000]
const niceMax = (value) => STEPS.find((s) => s >= value) || Math.ceil(value / 1000) * 1000

const longDate = (date) => date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
const shortDate = (date) => date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
const weekday = (date) => date.toLocaleDateString('tr-TR', { weekday: 'short' })

/** Bir günün özeti: tooltip, ekran okuyucu ve tablo için */
function dayLines(d) {
  if (!d.answers && !d.newWords && !d.stories) return ['Çalışma yok']
  const lines = []
  if (d.answers) lines.push(`${d.answers} cevap · %${Math.round((d.correct / d.answers) * 100)} doğru`)
  if (d.newWords) lines.push(`${d.newWords} yeni kelime`)
  if (d.stories) lines.push(`${d.stories} hikaye`)
  return lines
}

// Altta gösterilecek tarih etiketleri: 7 günde hepsi, 30 günde baş, orta ve son
const labelFor = (i, n, d) => {
  if (n <= 7) return { text: i === n - 1 ? 'Bugün' : weekday(d.date), align: 'center' }
  if (i === 0) return { text: shortDate(d.date), align: 'start' }
  if (i === Math.floor(n / 2)) return { text: shortDate(d.date), align: 'center' }
  if (i === n - 1) return { text: 'Bugün', align: 'end' }
  return null
}

/** Son 7 / 30 günde günlük cevaplanan soru sayısı */
function ActivityChart() {
  const [range, setRange] = useState(7)
  const [active, setActive] = useState(null)
  const [table, setTable] = useState(false)

  const days = useMemo(() => getActivity(range), [range])
  const max = niceMax(Math.max(1, ...days.map((d) => d.answers)))
  const empty = days.every((d) => !d.answers && !d.newWords && !d.stories)

  const selectRange = (r) => {
    setRange(r)
    setActive(null)
  }

  const tip = active !== null ? days[active] : null
  // Kenara yakın çubuklarda kutu taşmasın
  const tipAlign = active === null ? 'center' : active < days.length * 0.25 ? 'start' : active >= days.length * 0.75 ? 'end' : 'center'

  return (
    <section className={`card ${styles.chart}`} aria-labelledby="activity-title">
      <div className={styles.head}>
        <h2 id="activity-title" className={styles.title}>Günlük çalışma</h2>
        <div className={styles.seg} role="group" aria-label="Zaman aralığı">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => selectRange(r)}>
              {r} gün
            </button>
          ))}
        </div>
      </div>
      <p className={styles.caption}>Gün başına cevaplanan soru</p>

      {table ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Gün</th>
                <th scope="col">Cevap</th>
                <th scope="col">Doğru</th>
                <th scope="col">Yeni</th>
                <th scope="col">Hikaye</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day}>
                  <th scope="row">{shortDate(d.date)}</th>
                  <td>{d.answers}</td>
                  <td>{d.answers ? `%${Math.round((d.correct / d.answers) * 100)}` : '–'}</td>
                  <td>{d.newWords}</td>
                  <td>{d.stories}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.plot} onMouseLeave={() => setActive(null)}>
          <div className={styles.yAxis} aria-hidden="true">
            <span>{max}</span>
            <span>{max / 2}</span>
            <span>0</span>
          </div>
          <div className={styles.area}>
            <div className={styles.grid} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className={styles.bars} style={{ '--n': days.length }} role="group" aria-label="Günlük çalışma grafiği">
              {days.map((d, i) => (
                <button
                  key={d.day}
                  type="button"
                  className={styles.col}
                  data-active={active === i}
                  aria-label={`${longDate(d.date)}: ${dayLines(d).join(', ')}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(active === i ? null : i)}
                >
                  <span className={styles.bar} style={{ height: `${(d.answers / max) * 100}%` }} />
                </button>
              ))}
            </div>
            <div className={styles.xAxis} style={{ '--n': days.length }} aria-hidden="true">
              {days.map((d, i) => {
                const label = labelFor(i, days.length, d)
                return (
                  <span key={d.day} data-align={label?.align} data-today={i === days.length - 1}>
                    {label?.text}
                  </span>
                )
              })}
            </div>
            {tip && (
              <div
                className={styles.tip}
                data-align={tipAlign}
                style={{ '--x': `${((active + 0.5) / days.length) * 100}%` }}
                aria-hidden="true"
              >
                <strong>{longDate(tip.date)}</strong>
                {dayLines(tip).map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            )}
            {empty && <p className={styles.empty}>Bu dönemde çalışma yok.</p>}
          </div>
        </div>
      )}

      <button type="button" className={styles.toggle} onClick={() => setTable((t) => !t)}>
        {table ? 'Grafiği göster' : 'Tablo olarak göster'}
      </button>
    </section>
  )
}

export default ActivityChart
