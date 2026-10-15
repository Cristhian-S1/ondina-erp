import { useId } from 'react'
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
  const invalido = rangoInvertido(valores)
  const aria = { 'aria-invalid': invalido || undefined, 'aria-describedby': invalido ? errorRangoId : undefined }
  return <div className={`${cardCls} min-w-0 grid grid-cols-1 gap-3 p-4 min-[360px]:grid-cols-2`}>
    <label className={`${labelCls} min-w-0 min-[360px]:col-span-2`}>
      {etiquetaProducto}
      <select className={`${inputCls} min-w-0 max-w-full`} value={valores.productoId} onChange={event => onChange({ ...valores, productoId: event.target.value })}>
        <option value="">Todos</option>
        {productos.filter(producto => producto.activo).map(producto => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}
      </select>
    </label>
    <label className={`${labelCls} min-w-0`}>Desde<input type="date" className={`${inputCls} min-w-0 max-w-full`} value={valores.desde} {...aria} max={valores.hasta || undefined} onChange={event => onChange({ ...valores, desde: event.target.value })} /></label>
    <label className={`${labelCls} min-w-0`}>Hasta<input type="date" className={`${inputCls} min-w-0 max-w-full`} value={valores.hasta} {...aria} min={valores.desde || undefined} onChange={event => onChange({ ...valores, hasta: event.target.value })} /></label>
    {invalido && <p id={errorRangoId} role="alert" className="text-sm text-red-700 min-[360px]:col-span-2">Desde debe ser anterior o igual a Hasta.</p>}
    <div className="flex items-end min-[360px]:col-span-2"><button type="button" className={btnSecondary} onClick={() => onChange(filtrosVacios)}>Limpiar filtros</button></div>
  </div>
}
