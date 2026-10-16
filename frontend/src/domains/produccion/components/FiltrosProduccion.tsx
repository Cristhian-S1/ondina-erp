import { useId } from 'react'
import InputFecha from '../../../components/InputFecha'
import { btnSecondary, cardCls, inputCls, labelCls } from '../../../lib/ui'
import type { Producto } from '../../../types'
import { filtrosVacios, rangoInvertido } from './filtros'
import type { ValoresFiltros } from './filtros'

// Filtros compartidos por Historial y Producción reciente (producto y rango de fechas).
export default function FiltrosProduccion({ valores, productos, onChange, etiquetaProducto = 'Producto' }: {
  etiquetaProducto?: string
  valores: ValoresFiltros
  productos: Producto[]
  onChange: (valores: ValoresFiltros) => void
}) {
  const errorRangoId = useId()
  const desdeId = useId()
  const hastaId = useId()
  const invalido = rangoInvertido(valores)
  const aria = { 'aria-invalid': invalido || undefined, 'aria-describedby': invalido ? errorRangoId : undefined }
  // Two date columns only from 400px: below that a column is ~141px, too narrow for Firefox's
  // spaced "dd / mm / aaaa" (~100px) plus the 44px calendar button.
  return <div className={`${cardCls} min-w-0 grid grid-cols-1 gap-3 p-4 min-[400px]:grid-cols-2`}>
    <label className={`${labelCls} min-w-0 min-[400px]:col-span-2`}>
      {etiquetaProducto}
      <select className={`${inputCls} min-w-0 max-w-full`} value={valores.productoId} onChange={event => onChange({ ...valores, productoId: event.target.value })}>
        <option value="">Todos</option>
        {productos.filter(producto => producto.activo).map(producto => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}
      </select>
    </label>
    <div className="min-w-0"><label htmlFor={desdeId} className={labelCls}>Desde</label><InputFecha id={desdeId} etiquetaCalendario="Abrir calendario de Desde" className={`${inputCls} min-w-0 max-w-full`} value={valores.desde} {...aria} max={valores.hasta || undefined} onChange={event => onChange({ ...valores, desde: event.target.value })} /></div>
    <div className="min-w-0"><label htmlFor={hastaId} className={labelCls}>Hasta</label><InputFecha id={hastaId} etiquetaCalendario="Abrir calendario de Hasta" className={`${inputCls} min-w-0 max-w-full`} value={valores.hasta} {...aria} min={valores.desde || undefined} onChange={event => onChange({ ...valores, hasta: event.target.value })} /></div>
    {invalido && <p id={errorRangoId} role="alert" className="text-sm text-red-700 min-[400px]:col-span-2">Desde debe ser anterior o igual a Hasta.</p>}
    <div className="flex items-end min-[400px]:col-span-2"><button type="button" className={btnSecondary} onClick={() => onChange(filtrosVacios)}>Limpiar filtros</button></div>
  </div>
}
