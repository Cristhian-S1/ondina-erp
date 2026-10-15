import Paginacion from '../../../components/Paginacion'
import { usePaginaProduccion } from '../hooks/usePaginaProduccion'
import TablaProduccionResponsive from './TablaProduccionResponsive'
import FiltrosProduccion from './FiltrosProduccion'
import { filtrosVacios, rangoInvertido } from './filtros'
import type { ValoresFiltros } from './filtros'
import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import EstadoVista from '../../../components/EstadoVista'
import { cardCls } from '../../../lib/ui'
import { fmtFechaHora, formatMiles } from '../../../lib/format'
import { mensajeErrorSupabase } from '../../../lib/errors'
import type { Producto } from '../../../types'
import { obtenerPaginaHistorial, TAMANO_PRODUCCION } from '../api'

interface HistorialProduccionProps {
  sucursalId: string
  productos: Producto[]
  versionDatos?: number
  perfilId?: string
}

export default function HistorialProduccion({ sucursalId, productos, versionDatos = 0, perfilId = '' }: HistorialProduccionProps) {
  const [filtros, setFiltros] = useState<ValoresFiltros>(filtrosVacios)
  const { productoId, desde, hasta } = filtros
  const rangoInvalido = rangoInvertido(filtros)
  const { pagina, setPagina } = usePaginaProduccion(JSON.stringify([perfilId, sucursalId, filtros]))
  const consulta = useQuery({
    queryKey: ['produccion', perfilId, sucursalId, 'historial', productoId, desde, hasta, versionDatos, pagina],
    queryFn: () => obtenerPaginaHistorial({ sucursalId, productoId, desde, hasta }, pagina),
    retry: false,
    placeholderData: (prev, query) => JSON.stringify(query?.queryKey.slice(0, -1)) === JSON.stringify(['produccion', perfilId, sucursalId, 'historial', productoId, desde, hasta, versionDatos]) ? keepPreviousData(prev) : undefined,
    enabled: !rangoInvalido,
  })
  const registros = consulta.data?.filas ?? []
  const cargando = !rangoInvalido && consulta.isPending
  const error = consulta.error ? mensajeErrorSupabase(consulta.error) : null

  return <section aria-busy={!rangoInvalido && consulta.isFetching} className="min-w-0 space-y-4">
    <FiltrosProduccion valores={filtros} productos={productos} onChange={setFiltros} />

    <div className={`${cardCls} min-w-0`}>
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Historial de producción</h2><p className="mt-1 text-xs text-slate-500">Registros ordenados desde el más reciente. Horas de America/Santiago.</p></div>
      {!rangoInvalido && consulta.isFetching && !consulta.isPending && <p role="status" className="px-5 py-2 text-sm text-slate-600">Actualizando...</p>}
      {!rangoInvalido && (cargando ? <EstadoVista variante="cargando" mensaje="Cargando historial..." /> : error ? <EstadoVista variante="error" mensaje={error} onReintentar={() => void consulta.refetch()} /> : null)}
      {!rangoInvalido && !cargando && !error && registros.length === 0 ? <EstadoVista variante="vacio" mensaje="No hay registros para los filtros seleccionados." /> : null}
      {!rangoInvalido && !cargando && !error && registros.length > 0 ? <TablaProduccionResponsive
        columnas={[{ titulo: 'Fecha y hora', sinSalto: true, insignia: true }, { titulo: 'Producto', destacada: true }, { titulo: 'Cantidad', numerica: true }, { titulo: 'Observaciones' }]}
        filas={registros.map(registro => ({ id: registro.id, celdas: [fmtFechaHora(registro.creado_en), productos.find(producto => producto.id === registro.producto_id)?.nombre ?? 'Nombre no disponible', formatMiles(registro.cantidad), registro.observaciones || '—'] }))}
      /> : null}
      {!rangoInvalido && <Paginacion pagina={pagina} tamanoPagina={TAMANO_PRODUCCION} total={consulta.data?.total ?? 0} onCambiar={setPagina} cargando={consulta.isFetching} etiqueta="Paginación del historial de producción" />}
    </div>
  </section>
}
