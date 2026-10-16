import { useRef, type InputHTMLAttributes } from 'react'
import { CalendarIcon } from './icons'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { etiquetaCalendario: string }

// Android and iOS render date inputs without a calendar indicator, so an empty filter gives no cue
// that it opens a picker. Touch screens get a visible button that opens the native picker; desktop
// keeps the browser's own indicator.
export default function InputFecha({ etiquetaCalendario, className = '', ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  function abrirCalendario() {
    const input = ref.current
    if (!input || input.disabled) return
    input.focus()
    try {
      input.showPicker?.()
    } catch {
      // showPicker throws outside a user gesture or in cross-origin frames; the focused field still opens on tap.
    }
  }
  return (
    <div className="relative min-w-0">
      <input ref={ref} type="date" {...props} className={`${className} pointer-coarse:pr-12 pointer-coarse:[&::-webkit-calendar-picker-indicator]:hidden`} />
      <button
        type="button"
        onClick={abrirCalendario}
        disabled={props.disabled}
        aria-label={etiquetaCalendario}
        className="absolute right-0 bottom-0 hidden min-h-11 min-w-11 items-center justify-center rounded-r-lg text-slate-500 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 pointer-coarse:inline-flex"
      >
        <CalendarIcon className="h-5 w-5" />
      </button>
    </div>
  )
}
