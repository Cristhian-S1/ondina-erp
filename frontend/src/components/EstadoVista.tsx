import type { ReactNode } from 'react'
import { btnSecondary } from '../lib/ui'

interface EstadoVistaProps {
  variante: 'cargando' | 'vacio' | 'error'
  /** Texto visible. Por defecto: "Cargando..." (cargando) o un aviso genérico (error). */
  mensaje?: string
  /** Sólo variante `vacio`: acción sugerida (p. ej. un botón para crear el primer registro). */
  accion?: ReactNode
  /** Sólo variante `error`: si se entrega, muestra el botón "Reintentar". */
  onReintentar?: () => void
}

/**
 * Estado de vista compartido para listas/páginas.
 *
 * ```tsx
 * if (isPending) return <EstadoVista variante="cargando" mensaje="Cargando clientes..." />
 * if (isError) return <EstadoVista variante="error" mensaje={mensajeError(error)} onReintentar={() => void refetch()} />
 * if (!data.length) return <EstadoVista variante="vacio" mensaje="Aún no hay clientes." accion={<button .../>} />
 * ```
 */
export default function EstadoVista({ variante, mensaje, accion, onReintentar }: EstadoVistaProps) {
  const base = 'flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center text-sm'

  if (variante === 'cargando') {
    return (
      <div role="status" className={`${base} text-slate-600`}>
        {mensaje ?? 'Cargando...'}
      </div>
    )
  }

  if (variante === 'error') {
    return (
      <div role="alert" className={`${base} border border-red-200 bg-red-50 text-red-800`}>
        <p>{mensaje ?? 'No fue posible cargar la información.'}</p>
        {onReintentar && (
          <button type="button" className={btnSecondary} onClick={onReintentar}>
            Reintentar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`${base} border border-dashed border-slate-300 bg-white text-slate-600`}>
      <p>{mensaje}</p>
      {accion}
    </div>
  )
}
