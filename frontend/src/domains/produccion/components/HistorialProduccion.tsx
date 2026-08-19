import { useEffect, useState } from 'react'
import { btnSecondary, cardCls, inputCls, labelCls, tdCls, thCls } from '../../../lib/ui'
import type { Producto } from '../../../types'
import { obtenerHistorialProduccion } from '../api'
import type { Produccion } from '../types'

interface HistorialProduccionProps {
  sucursalId: string
  productos: Producto[]
  versionDatos: number
}

export default function HistorialProduccion({ sucursalId, productos, versionDatos }: HistorialProduccionProps) {
  const [productoId, setProductoId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [registros, setRegistros] = useState<Produccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const timer = window.setTimeout(() => {
      setCargando(true)
      setError(null)
      void obtenerHistorialProduccion({ sucursalId, productoId, desde, hasta, limite: 200 })
        .then((data) => { if (vigente) setRegistros(data) })
        .catch((cause: unknown) => { if (vigente) setError(cause instanceof Error ? cause.message : 'No fue posible cargar el historial.') })
        .finally(() => { if (vigente) setCargando(false) })
    }, 0)
    return () => { vigente = false; window.clearTimeout(timer) }
  }, [desde, hasta, productoId, sucursalId, versionDatos])

  function limpiarFiltros() {
    setProductoId('')
    setDesde('')
    setHasta('')
  }

  return <section className="space-y-4">
    <div className={`${cardCls} grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4`}>
      <label className={labelCls}>
        Producto
        <select 
          className={inputCls} 
          value={productoId} 
          onChange={(event) => setProductoId(event.target.value)}
        >
          <option value="">Todos</option>
          
          {productos
            .filter((producto) => producto.activo)
            .map((producto) => (
              <option key={producto.id} value={producto.id}>
                {producto.nombre}
              </option>
            ))}
        </select>
      </label>
      <label className={labelCls}>Desde<input type="date" className={inputCls} value={desde} max={hasta || undefined} onChange={(event) => setDesde(event.target.value)} /></label>
      <label className={labelCls}>Hasta<input type="date" className={inputCls} value={hasta} min={desde || undefined} onChange={(event) => setHasta(event.target.value)} /></label>
      <div className="flex items-end"><button type="button" className={btnSecondary} onClick={limpiarFiltros}>Limpiar filtros</button></div>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <div className={cardCls}>
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Historial de producción</h2><p className="mt-1 text-xs text-slate-500">Máximo 200 registros, ordenados desde el más reciente.</p></div>
      {cargando ? <p className="p-8 text-center text-sm text-slate-500">Cargando historial...</p> : null}
      {!cargando && registros.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No hay registros para los filtros seleccionados.</p> : null}
      {!cargando && registros.length > 0 ? <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50"><th className={thCls}>Fecha y hora</th><th className={thCls}>Producto</th><th className={`${thCls} text-right`}>Cantidad</th><th className={thCls}>Observaciones</th></tr></thead><tbody className="divide-y divide-slate-100">{registros.map((registro) => <tr key={registro.id}><td className={tdCls}>{new Date(registro.creado_en).toLocaleString('es-CL')}</td><td className={tdCls}>{productos.find((producto) => producto.id === registro.producto_id)?.nombre ?? 'Producto'}</td><td className={`${tdCls} text-right font-semibold`}>{registro.cantidad}</td><td className={tdCls}>{registro.observaciones || '—'}</td></tr>)}</tbody></table></div> : null}
    </div>
  </section>
}
