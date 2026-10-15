import { useId } from 'react'
import type { ReactNode } from 'react'
import { errorTextCls, inputCls, inputErrorCls, labelCls } from '../lib/ui'

interface AtributosCampo {
  id: string
  className: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

export default function CampoFormulario({ etiqueta, error, children }: {
  etiqueta: string
  error?: string
  children: (atributos: AtributosCampo) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`
  return <div className="min-w-0">
    <label htmlFor={id} className={labelCls}>{etiqueta}</label>
    {children({ id, className: `${inputCls} ${error ? inputErrorCls : ''}`, 'aria-invalid': !!error, 'aria-describedby': error ? errorId : undefined })}
    {error && <p id={errorId} className={errorTextCls}>{error}</p>}
  </div>
}
