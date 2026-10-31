import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import styles from './Sheet.module.css'

/**
 * Telefonda alttan açılan, geniş ekranda ortada duran panel. Tarayıcının <dialog> öğesi
 * kullanılır: odak panelde kalır, Esc ve arka plana dokunma kapatır.
 */
function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className={styles.inner}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Kapat">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

/** Paneldeki bir ayar satırı: başlık, isteğe bağlı açıklama, sağda ya da altta denetim */
export function SheetRow({ label, hint, children, stacked = false, htmlFor }) {
  return (
    <div className={styles.row} data-stacked={stacked}>
      <div className={styles.rowText}>
        {htmlFor ? (
          <label htmlFor={htmlFor} className={styles.rowLabel}>
            {label}
          </label>
        ) : (
          <span className={styles.rowLabel}>{label}</span>
        )}
        {hint && <span className={styles.rowHint}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export default Sheet
