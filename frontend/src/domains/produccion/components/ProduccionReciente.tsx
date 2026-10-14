import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import EstadoVista from '../../../components/EstadoVista'
import { cardCls } from '../../../lib/ui'
import { fmtFechaHora, formatMiles } from '../../../lib/format'
import { mensajeErrorSupabase } from '../../../lib/errors'
import type { Producto } from '../../../types'
import { obtenerHistorialProduccion } from '../api'
import type { Produccion } from '../types'
import FiltrosProduccion from './FiltrosProduccion'
import { filtrosVacios, hayFiltros, rangoInvertido } from './filtros'
import type { ValoresFiltros } from './filtros'
import TablaProduccionResponsive from './TablaProduccionResponsive'

// Sin filtros usa la lista reciente ya cargada; con filtros consulta el historial (mismo servicio que Historial).
export default function ProduccionReciente({ perfilId, sucursalId, productos, recientes }: {
  perfilId: string
  sucursalId: string
  productos: Producto[]
  recientes: Produccion[]
}) {
  const [filtros, setFiltros] = useState<ValoresFiltros>(filtrosVacios)
  const filtrando = hayFiltros(filtros)
  const rangoInvalido = rangoInvertido(filtros)
  const consulta = useQuery({
    queryKey: ['produccion', perfilId, sucursalId, 'historial', 'reciente', filtros.productoId, filtros.desde, filtros.hasta],
    queryFn: () => obtenerHistorialProduccion({ sucursalId, ...filtros, limite: 200 }),
    retry: false,
    enabled: filtrando && !rangoInvalido,
  })
  const registros = filtrando ? consulta.data ?? [] : recientes
  const cargando = filtrando && !rangoInvalido && consulta.isPending
  const error = filtrando && consulta.error ? mensajeErrorSupabase(consulta.error) : null
  const nombre = (id: string) => productos.find(item => item.id === id)?.nombre ?? 'Nombre no disponible'

  return <div className="min-w-0 space-y-4">
    <FiltrosProduccion valores={filtros} productos={productos} onChange={setFiltros} etiquetaProducto="Filtrar por producto" />
    <section className={`${cardCls} min-w-0`}>
      <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Producción reciente</h2>
      <div data-testid="lista-produccion-reciente" className="min-w-0 xl:max-h-[36rem] xl:overflow-y-auto">
        {rangoInvalido ? null : cargando ? <EstadoVista variante="cargando" mensaje="Cargando producción..." />
          : error ? <EstadoVista variante="error" mensaje={error} onReintentar={() => void consulta.refetch()} />
          : registros.length === 0 ? <EstadoVista variante="vacio" mensaje={filtrando ? 'No hay producciones para los filtros seleccionados.' : 'No hay producciones registradas.'} />
          : <TablaProduccionResponsive columnas={[{ titulo: 'Fecha y hora (America/Santiago)', sinSalto: true, insignia: true }, { titulo: 'Producto', destacada: true }, { titulo: 'Cantidad', numerica: true }]} filas={registros.map(item => ({ id: item.id, celdas: [fmtFechaHora(item.creado_en), nombre(item.producto_id), formatMiles(item.cantidad)] }))} />}
      </div>
    </section>
  </div>
}
