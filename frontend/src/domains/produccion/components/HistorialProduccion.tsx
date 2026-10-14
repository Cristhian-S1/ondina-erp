import TablaProduccionResponsive from './TablaProduccionResponsive'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import EstadoVista from '../../../components/EstadoVista'
import { btnSecondary, cardCls, inputCls, labelCls } from '../../../lib/ui'
import { fmtFechaHora, formatMiles } from '../../../lib/format'
import { mensajeErrorSupabase } from '../../../lib/errors'
import type { Producto } from '../../../types'
import { obtenerHistorialProduccion } from '../api'

interface HistorialProduccionProps {
  sucursalId: string
  productos: Producto[]
  versionDatos?: number
  perfilId?: string
}

export default function HistorialProduccion({ sucursalId, productos, versionDatos = 0, perfilId = '' }: HistorialProduccionProps) {
  const [productoId, setProductoId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const consulta = useQuery({
    queryKey: ['produccion', perfilId, sucursalId, 'historial', productoId, desde, hasta, versionDatos],
    queryFn: () => obtenerHistorialProduccion({ sucursalId, productoId, desde, hasta, limite: 200 }),
    retry: false,
  })
  const registros = consulta.data ?? []
  const cargando = consulta.isPending || consulta.isFetching
  const error = consulta.error ? mensajeErrorSupabase(consulta.error) : null

  function limpiarFiltros() {
    setProductoId('')
    setDesde('')
    setHasta('')
  }

  return <section className="min-w-0 space-y-4">
    <div className={`${cardCls} min-w-0 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4`}>
      <label className={`${labelCls} min-w-0`}>
        Producto
        <select
          className={`${inputCls} min-w-0 max-w-full`}
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
      <label className={`${labelCls} min-w-0`}>Desde<input type="date" className={`${inputCls} min-w-0 max-w-full`} value={desde} max={hasta || undefined} onChange={(event) => setDesde(event.target.value)} /></label>
      <label className={`${labelCls} min-w-0`}>Hasta<input type="date" className={`${inputCls} min-w-0 max-w-full`} value={hasta} min={desde || undefined} onChange={(event) => setHasta(event.target.value)} /></label>
      <div className="flex items-end"><button type="button" className={btnSecondary} onClick={limpiarFiltros}>Limpiar filtros</button></div>
    </div>

    <div className={`${cardCls} min-w-0`}>
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Historial de producción</h2><p className="mt-1 text-xs text-slate-500">Máximo 200 registros, ordenados desde el más reciente. Horas de America/Santiago.</p></div>
      {cargando ? <EstadoVista variante="cargando" mensaje="Cargando historial..." /> : error ? <EstadoVista variante="error" mensaje={error} onReintentar={() => void consulta.refetch()} /> : null}
      {!cargando && !error && registros.length === 0 ? <EstadoVista variante="vacio" mensaje="No hay registros para los filtros seleccionados." /> : null}
      {!cargando && !error && registros.length > 0 ? <TablaProduccionResponsive
        columnas={[{ titulo: 'Fecha y hora', sinSalto: true }, { titulo: 'Producto' }, { titulo: 'Cantidad', numerica: true }, { titulo: 'Observaciones' }]}
        filas={registros.map(registro => ({ id: registro.id, celdas: [fmtFechaHora(registro.creado_en), productos.find(producto => producto.id === registro.producto_id)?.nombre ?? 'Producto', formatMiles(registro.cantidad), registro.observaciones || '—'] }))}
      /> : null}
    </div>
  </section>
}
