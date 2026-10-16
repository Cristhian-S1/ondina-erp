import { useRef, type InputHTMLAttributes } from 'react'
import { CalendarIcon } from './icons'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { etiquetaCalendario: string }

// Margin utilities (mt-1, -mx-2, ...) move to the wrapper so the wrapper's box is exactly the
// input's border box and the button can be inset by 1px inside the input border.
const MARGEN = /^-?m[trblxyse]?-/

// Mobile browsers disagree on the native date indicator: Android Chrome hides it or its tap does
// not open the picker, while Firefox draws its own button that ::-webkit-calendar-picker-indicator
// cannot hide. So the field always shows our own 44px button, which opens the native picker, and
// paints it opaquely over the right edge of the input. The input keeps its normal right padding,
// so any native indicator stays pinned to that edge, underneath the button, and only one icon is
// ever visible.
export default function InputFecha({ etiquetaCalendario, className = '', ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const clases = className.split(/\s+/).filter(Boolean)
  const margen = clases.filter(clase => MARGEN.test(clase)).join(' ')
  const resto = clases.filter(clase => !MARGEN.test(clase)).join(' ')
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
    <div className={`relative min-w-0 ${margen}`}>
      <input
        ref={ref}
        type="date"
        {...props}
        className={`${resto} block ps-2 bg-white disabled:bg-slate-100 [&::-webkit-calendar-picker-indicator]:hidden`}
      />
      <button
        type="button"
        onClick={abrirCalendario}
        disabled={props.disabled}
        aria-label={etiquetaCalendario}
        className="absolute top-px right-px bottom-px inline-flex w-11 items-center justify-center rounded-r-[7px] bg-white text-slate-500 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <CalendarIcon className="h-5 w-5" />
      </button>
    </div>
  )
}
