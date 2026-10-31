/** Açma/kapama düğmesi; görünümü global.css › .switch */
function Switch({ checked, onChange, label, disabled, id }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span />
    </button>
  )
}

export default Switch
