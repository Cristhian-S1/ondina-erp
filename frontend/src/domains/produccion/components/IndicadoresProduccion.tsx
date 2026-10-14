import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import EstadoVista from '../../../components/EstadoVista'
import { cardCls, inputCls, labelCls } from '../../../lib/ui'
import { fmtFecha, formatMiles } from '../../../lib/format'
import { mensajeErrorSupabase } from '../../../lib/errors'
import type { Producto } from '../../../types'
import { obtenerIndicadoresProduccion } from '../api'
import { calcularResumenIndicadores } from '../calculos'
import TablaProduccionResponsive from './TablaProduccionResponsive'

type Periodo = 'hoy' | '7dias' | '30dias'

interface IndicadoresProduccionProps {
  sucursalId: string
  productos: Producto[]
  versionDatos?: number
  perfilId?: string
}

function fechaLocal(fecha: Date) {
  return fmtFecha(fecha).split('-').reverse().join('-')
}

export default function IndicadoresProduccion({ sucursalId, productos, versionDatos = 0, perfilId = '' }: IndicadoresProduccionProps) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const consulta = useQuery({
    queryKey: ['produccion', perfilId, sucursalId, 'indicadores', periodo, versionDatos],
    queryFn: () => {
      // Mediodía UTC conserva el día de Santiago al restar días, incluso al cambiar DST.
      const hoy = new Date(`${fechaLocal(new Date())}T12:00:00Z`)
      const inicio = new Date(hoy)
      if (periodo === '7dias') inicio.setUTCDate(hoy.getUTCDate() - 6)
      if (periodo === '30dias') inicio.setUTCDate(hoy.getUTCDate() - 29)
      return obtenerIndicadoresProduccion(sucursalId, fechaLocal(inicio), fechaLocal(hoy))
    },
    retry: false,
  })
  const cargando = consulta.isPending || consulta.isFetching
  const error = consulta.error ? mensajeErrorSupabase(consulta.error) : null
  const resumen = useMemo(() => calcularResumenIndicadores(consulta.data ?? []), [consulta.data])
  const datoValido = !error && !cargando && consulta.isSuccess

  return <section className="min-w-0 space-y-5">
    <label className={`${labelCls} max-w-xs`}>Período
      <select className={inputCls} value={periodo} onChange={event => setPeriodo(event.target.value as Periodo)}>
        <option value="hoy">Hoy</option><option value="7dias">Últimos 7 días</option><option value="30dias">Últimos 30 días</option>
      </select>
    </label>
    {cargando ? <EstadoVista variante="cargando" mensaje="Calculando indicadores..." />
      : error ? <EstadoVista variante="error" mensaje={error} onReintentar={() => void consulta.refetch()} /> : null}
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <article className={`${cardCls} min-w-0 p-5`}>
        <p className="text-sm text-slate-500">Unidades producidas</p>
        <p className="mt-2 text-3xl font-bold text-brand-800">{formatMiles(datoValido ? resumen.totalUnidades : null)}</p>
      </article>
      <article className={`${cardCls} min-w-0 p-5`}>
        <p className="text-sm text-slate-500">Registros de producción</p>
        <p className="mt-2 text-3xl font-bold text-brand-800">{formatMiles(datoValido ? resumen.totalRegistros : null)}</p>
      </article>
    </div>
    {datoValido && <div className={`${cardCls} min-w-0`}>
      <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Totales por producto</h2>
      {resumen.porProducto.length === 0 ? <EstadoVista variante="vacio" mensaje="No hay producción en el período." /> : <TablaProduccionResponsive
        columnas={[{ titulo: 'Producto' }, { titulo: 'Unidades', numerica: true }, { titulo: 'Registros', numerica: true }]}
        filas={resumen.porProducto.map(item => ({ id: item.productoId, celdas: [productos.find(producto => producto.id === item.productoId)?.nombre ?? 'Producto', formatMiles(item.cantidad), formatMiles(item.registros)] }))}
      />}
    </div>}
  </section>
}
