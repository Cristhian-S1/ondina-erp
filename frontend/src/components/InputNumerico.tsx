import { useId, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { InputHTMLAttributes, Ref } from 'react'
import { formatMiles, parseMiles } from '../lib/format'
import { errorTextCls, inputCls, inputErrorCls } from '../lib/ui'

export interface InputNumericoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max' | 'step'> {
  value?: number | string | null
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  conFlechas?: boolean
  error?: string
  ref?: Ref<HTMLInputElement>
}

/**
 * Entero controlado con miles es-CL; reutiliza formatMiles/parseMiles.
 * `value` acepta números o cadenas con puntos. Cero/vacío muestra placeholder "0".
 * `onChange` entrega un número sin formato o undefined al vaciar (RHF puede usar
 * `onChange={n => field.onChange(n ?? 0)}` si su dominio necesita cero).
 * `min` (0) y `max` (MAX_SAFE_INTEGER) acotan escritura, pegado y pasos de ±1;
 * sólo admite enteros no negativos y normaliza límites a ese rango seguro.
 * `conFlechas` (true) muestra botones; ArrowUp/Down también ajustan sin botones.
 * `error` crea un mensaje debajo y enlaza ARIA; admite aria-describedby externo
 * y los atributos/ref/onBlur de Controller o useController sin depender de RHF.
 * El pegado conserva sólo dígitos ("1.2a3" → 123); texto puro no cambia el valor.
 */
export default function InputNumerico({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, conFlechas = true, error, ref, id, className = inputCls, disabled, readOnly, onKeyDown, onPaste, onBeforeInput, 'aria-describedby': descripcion, 'aria-invalid': invalido, ...props }: InputNumericoProps) {
  const propioId = useId()
  const inputId = id ?? propioId
  const errorId = `${inputId}-error`
  const inputRef = useRef<HTMLInputElement | null>(null)
  useImperativeHandle(ref, () => inputRef.current!, [])
  const cursor = useRef<number | null>(null)
  const minimo = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Number.isFinite(min) ? Math.ceil(min) : 0))
  const maximo = Math.max(minimo, Math.min(Number.MAX_SAFE_INTEGER, Number.isFinite(max) ? Math.floor(max) : Number.MAX_SAFE_INTEGER))
  const numero = typeof value === 'string' ? parseMiles(value) : value ?? 0
  const texto = Number.isFinite(numero) && numero > 0 ? formatMiles(Math.trunc(numero)) : ''
  const bloqueado = disabled || readOnly
  const descripcionCompleta = [descripcion, error ? errorId : undefined].filter(Boolean).join(' ') || undefined

  function restaurarCursor() {
    if (cursor.current === null || !inputRef.current) return
    inputRef.current.setSelectionRange(cursor.current, cursor.current)
    cursor.current = null
  }
  useLayoutEffect(restaurarCursor)

  function actualizar(raw: string, posicion: number) {
    if (bloqueado) return
    const digitos = raw.replace(/\D/g, '')
    if (!digitos && raw) {
      if (inputRef.current) inputRef.current.value = texto
      return
    }
    const siguiente = digitos ? Math.min(maximo, Math.max(minimo, parseMiles(digitos))) : undefined
    const formateado = siguiente ? formatMiles(siguiente) : ''
    const cerosQuitados = digitos.length - digitos.replace(/^0+(?=\d)/, '').length
    const cifrasAntes = Math.max(0, raw.slice(0, posicion).replace(/\D/g, '').length - cerosQuitados)
    let nuevaPosicion = 0
    let cifras = 0
    while (nuevaPosicion < formateado.length && cifras < cifrasAntes) {
      if (/\d/.test(formateado[nuevaPosicion])) cifras++
      nuevaPosicion++
    }
    cursor.current = nuevaPosicion
    onChange(siguiente)
    // React no vuelve a renderizar si la normalización deja el mismo valor.
    if (formateado === texto && inputRef.current) {
      inputRef.current.value = texto
      restaurarCursor()
    }
  }
  function ajustar(paso: number) {
    if (bloqueado) return
    cursor.current = null
    onChange(Math.min(maximo, Math.max(minimo, (numero || 0) + paso)))
  }

  return <div className="min-w-0">
    <div className="flex min-w-0 items-start gap-1">
      <input {...props} id={inputId} ref={inputRef} type="text" inputMode="numeric" placeholder={props.placeholder ?? '0'} value={texto} disabled={disabled} readOnly={readOnly}
        aria-invalid={error ? true : invalido ?? false} aria-describedby={descripcionCompleta}
        className={`${className} min-w-0 ${error ? inputErrorCls : ''}`}
        onChange={event => actualizar(event.target.value, event.target.selectionStart ?? event.target.value.length)}
        onBeforeInput={event => {
          onBeforeInput?.(event)
          const data = (event.nativeEvent as InputEvent).data
          if (!event.defaultPrevented && data && /\D/.test(data)) event.preventDefault()
        }}
        onPaste={event => {
          onPaste?.(event)
          if (event.defaultPrevented) return
          event.preventDefault()
          const digitos = event.clipboardData.getData('text').replace(/\D/g, '')
          if (!digitos) return
          const input = event.currentTarget
          const inicio = input.selectionStart ?? texto.length
          const fin = input.selectionEnd ?? inicio
          actualizar(texto.slice(0, inicio) + digitos + texto.slice(fin), inicio + digitos.length)
        }}
        onKeyDown={event => {
          onKeyDown?.(event)
          if (event.defaultPrevented || bloqueado) return
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            ajustar(event.key === 'ArrowUp' ? 1 : -1)
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !/^\d$/.test(event.key)) {
            event.preventDefault()
          } else if (event.key === 'Backspace' || event.key === 'Delete') {
            const input = event.currentTarget
            const posicion = input.selectionStart ?? 0
            if (posicion !== input.selectionEnd) return
            const atras = event.key === 'Backspace'
            if (texto[atras ? posicion - 1 : posicion] !== '.') return
            event.preventDefault()
            const desde = atras ? posicion - 2 : posicion
            actualizar(texto.slice(0, desde) + texto.slice(desde + 2), desde)
          }
        }} />
      {conFlechas && <div className="mt-1 flex shrink-0 flex-row gap-1">
        <button type="button" aria-label="Aumentar" aria-controls={inputId} disabled={bloqueado || numero >= maximo} onClick={() => ajustar(1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50"><span aria-hidden="true">▴</span></button>
        <button type="button" aria-label="Disminuir" aria-controls={inputId} disabled={bloqueado || numero <= minimo} onClick={() => ajustar(-1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50"><span aria-hidden="true">▾</span></button>
      </div>}
    </div>
    {error && <p id={errorId} className={errorTextCls}>{error}</p>}
  </div>
}
