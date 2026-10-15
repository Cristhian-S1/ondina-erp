import InputNumerico from '../../../components/InputNumerico'
import { formatMiles } from '../../../lib/format'
import { btnDangerOutline, inputCls, labelCls } from '../../../lib/ui'
import type { Producto } from '../../../types'

interface AtributosCampo {
  id: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

interface LineaDespachoProps {
  indice: number
  lineaId: string
  productoId: string
  cantidad: string
  productos: Producto[]
  // Productos ya elegidos en otras líneas (no se pueden repetir).
  productosEnOtrasLineas: string[]
  disponible: (productoId: string) => number
  // Carga actual del vendedor para el producto; undefined si aún no hay vendedor.
  cargaVendedor?: number
  errorCantidad?: string
  atributosProducto: AtributosCampo
  atributosCantidad: AtributosCampo
  onProducto: (productoId: string) => void
  onCantidad: (valor: number | undefined) => void
  onQuitar: () => void
}

// Tarjeta por línea de producto del despacho (mismo lenguaje que FilaProductoVenta): insignia con
// número, nombre como título, producto, disponibilidad y cantidad alineadas, y Quitar de 44 px.
export default function LineaDespacho({
  indice, lineaId, productoId, cantidad, productos, productosEnOtrasLineas, disponible, cargaVendedor,
  errorCantidad, atributosProducto, atributosCantidad, onProducto, onCantidad, onQuitar,
}: LineaDespachoProps) {
  const elegido = productos.find((p) => p.id === productoId)
  const ayudaId = `disponible-despacho-${lineaId}`
  return (
    <li data-testid="linea-despacho" className="@container min-w-0 list-none rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">Línea {indice + 1}</span>
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
          {elegido ? elegido.nombre : 'Sin producto seleccionado'}
        </span>
        <button type="button" onClick={onQuitar}
          className={`${btnDangerOutline} shrink-0 !px-3`}>
          Quitar
        </button>
      </div>
      <div className="mt-3 space-y-3">
        <div className="min-w-0">
          <label htmlFor={atributosProducto.id} className={labelCls}>Producto</label>
          <select className={inputCls} value={productoId} {...atributosProducto}
            aria-describedby={[atributosProducto['aria-describedby'], productoId ? ayudaId : undefined].filter(Boolean).join(' ') || undefined}
            onChange={(event) => onProducto(event.target.value)}>
            <option value="">Selecciona producto...</option>
            {productos.map((producto) => (
              <option key={producto.id} value={producto.id} disabled={productosEnOtrasLineas.includes(producto.id)}>
                {producto.nombre} (disp. {formatMiles(disponible(producto.id))})
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-0 grid-cols-1 items-start gap-3 @sm:grid-cols-[minmax(0,1fr)_13rem]">
          <div className="min-w-0 @sm:pt-6">
            {productoId ? (
              <span id={ayudaId} className="block space-y-0.5 text-xs text-slate-600">
                <span className="block">En bodega <b className="text-sm text-slate-900">{formatMiles(disponible(productoId))}</b></span>
                {cargaVendedor !== undefined && (
                  <span className="block">Carga del vendedor <b className="text-sm text-slate-900">{formatMiles(cargaVendedor)}</b></span>
                )}
              </span>
            ) : (
              <span className="block text-xs text-slate-600">Elige un producto para ver su disponibilidad.</span>
            )}
          </div>
          <div className="w-52 max-w-full min-w-0">
            <label htmlFor={atributosCantidad.id} className={labelCls}>Cantidad</label>
            <InputNumerico {...atributosCantidad} value={cantidad} error={errorCantidad} onChange={onCantidad} />
          </div>
        </div>
      </div>
    </li>
  )
}
