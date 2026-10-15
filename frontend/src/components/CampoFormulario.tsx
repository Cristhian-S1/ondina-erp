import { useId } from 'react'
import type { ReactNode } from 'react'
import { errorTextCls, inputCls, inputErrorCls, labelCls } from '../lib/ui'

interface AtributosCampo {
  id: string
  className: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

// Optional id preserves caller-owned focus/arrow references; descripcionId adds
// help after the error description; alerta opts the error into role="alert".
// Existing callers retain generated IDs, classes and markup by default.
export default function CampoFormulario({ id: idExterno, etiqueta, error, descripcionId, alerta = false, children }: {
  id?: string
  descripcionId?: string
  alerta?: boolean
  etiqueta: string
  error?: string
  children: (atributos: AtributosCampo) => ReactNode
}) {
  const idGenerado = useId()
  const id = idExterno ?? idGenerado
  const errorId = `${id}-error`
  return <div className="min-w-0">
    <label htmlFor={id} className={labelCls}>{etiqueta}</label>
    {children({ id, className: `${inputCls} ${error ? inputErrorCls : ''}`, 'aria-invalid': !!error, 'aria-describedby': [error ? errorId : undefined, descripcionId].filter(Boolean).join(' ') || undefined })}
    {error && <p id={errorId} role={alerta ? 'alert' : undefined} className={errorTextCls}>{error}</p>}
  </div>
}
