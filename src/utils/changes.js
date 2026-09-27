// Yerel ilerlemedeki değişiklikleri senkronizasyona bildirir.
// Depolama modülleri yalnızca bildirir; hesaba yazma işini sync.js yapar.

const listeners = new Set()

export function onLocalChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * @param {'word' | 'word-removed' | 'words-reset' | 'read' | 'settings'} type
 * @param {object} [detail]
 */
export function notifyChange(type, detail = {}) {
  listeners.forEach((listener) => {
    try {
      listener(type, detail)
    } catch (error) {
      console.error('Sync listener error:', error)
    }
  })
}
