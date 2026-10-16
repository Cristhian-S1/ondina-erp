import Paginacion from '../../../components/Paginacion'
import { usePaginaProduccion } from '../hooks/usePaginaProduccion'
import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import EstadoVista from '../../../components/EstadoVista'
import { cardCls } from '../../../lib/ui'
import { fmtFechaHora, formatMiles } from '../../../lib/format'
import { mensajeErrorSupabase } from '../../../lib/errors'
import type { Producto } from '../../../types'
import { obtenerPaginaHistorial, TAMANO_PRODUCCION } from '../api'
import type { Produccion } from '../types'
import FiltrosProduccion from './FiltrosProduccion'
import { filtrosVacios, hayFiltros, rangoInvertido } from './filtros'
import type { ValoresFiltros } from './filtros'
import TablaProduccionResponsive from './TablaProduccionResponsive'

// Sin filtros usa la lista reciente ya cargada; con filtros consulta el historial (mismo servicio que Historial).
export default function ProduccionReciente({ perfilId, sucursalId, productos, recientes, paginacion }: {
  perfilId: string
  sucursalId: string
  productos: Producto[]
  recientes: Produccion[]
  paginacion?: { pagina: number; total: number; setPagina: (pagina: number) => void; isFetching: boolean }
}) {
  const [filtros, setFiltros] = useState<ValoresFiltros>(filtrosVacios)
  const filtrando = hayFiltros(filtros)
  const rangoInvalido = rangoInvertido(filtros)
  const { pagina, setPagina } = usePaginaProduccion(JSON.stringify([perfilId, sucursalId, filtros]))
  const consulta = useQuery({
    queryKey: ['produccion', perfilId, sucursalId, 'historial', 'reciente', filtros.productoId, filtros.desde, filtros.hasta, pagina],
    queryFn: () => obtenerPaginaHistorial({ sucursalId, ...filtros }, pagina),
    retry: false,
    placeholderData: (prev, query) => JSON.stringify(query?.queryKey.slice(0, -1)) === JSON.stringify(['produccion', perfilId, sucursalId, 'historial', 'reciente', filtros.productoId, filtros.desde, filtros.hasta]) ? keepPreviousData(prev) : undefined,
    enabled: filtrando && !rangoInvalido,
  })
  const registros = filtrando ? consulta.data?.filas ?? [] : recientes
  const cargando = filtrando && !rangoInvalido && consulta.isPending
  const error = filtrando && consulta.error ? mensajeErrorSupabase(consulta.error) : null
  const nombre = (id: string) => productos.find(item => item.id === id)?.nombre ?? 'Nombre no disponible'

  return <div className="min-w-0 space-y-4">
    <FiltrosProduccion valores={filtros} productos={productos} onChange={valores => { setFiltros(valores); paginacion?.setPagina(1) }} etiquetaProducto="Filtrar por producto" />
    <section className={`${cardCls} min-w-0`}>
      <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Producción reciente</h2>
      <div data-testid="lista-produccion-reciente" className="min-w-0 xl:max-h-[36rem] xl:overflow-y-auto">
        {rangoInvalido ? null : cargando ? <EstadoVista variante="cargando" mensaje="Cargando producción..." />
          : error ? <EstadoVista variante="error" mensaje={error} onReintentar={() => void consulta.refetch()} />
          : registros.length === 0 ? <EstadoVista variante="vacio" mensaje={filtrando ? 'No hay producciones para los filtros seleccionados.' : 'No hay producciones registradas.'} />
          : <TablaProduccionResponsive columnas={[{ titulo: 'Fecha y hora (America/Santiago)', sinSalto: true, insignia: true }, { titulo: 'Producto', destacada: true }, { titulo: 'Cantidad', numerica: true, cantidad: true }]} filas={registros.map(item => ({ id: item.id, celdas: [fmtFechaHora(item.creado_en), nombre(item.producto_id), formatMiles(item.cantidad)] }))} />}
      </div>
      {!rangoInvalido && <Paginacion pagina={filtrando ? pagina : paginacion?.pagina ?? 1} tamanoPagina={TAMANO_PRODUCCION}
        total={filtrando ? consulta.data?.total ?? 0 : paginacion?.total ?? recientes.length}
        onCambiar={filtrando ? setPagina : paginacion?.setPagina ?? (() => {})}
        cargando={filtrando ? consulta.isFetching : paginacion?.isFetching} etiqueta="Paginación de producción reciente" />}
    </section>
  </div>
}
