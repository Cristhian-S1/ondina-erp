import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import EstadoVista from '../../../components/EstadoVista'
import { cardCls, inputCls, labelCls } from '../../../lib/ui'
import { formatMiles } from '../../../lib/format'
import { inicioPeriodo, useJornadaSantiago } from '../../../lib/jornada'
import { mensajeErrorSupabase } from '../../../lib/errors'
import type { Producto } from '../../../types'
import { obtenerIndicadoresProduccion } from '../api'
import { calcularResumenIndicadores } from '../calculos'
import TablaProduccionResponsive from './TablaProduccionResponsive'

type Periodo = 'hoy' | '7dias' | '30dias'

interface IndicadoresProduccionProps {
  sucursalId: string
  productos: Producto[]
  perfilId: string
}

export default function IndicadoresProduccion({ sucursalId, productos, perfilId }: IndicadoresProduccionProps) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const jornada = useJornadaSantiago()
  const consulta = useQuery({
    queryKey: ['produccion', perfilId, sucursalId, 'indicadores', periodo, jornada],
    queryFn: () => obtenerIndicadoresProduccion(sucursalId, inicioPeriodo(jornada, periodo === '7dias' ? 6 : periodo === '30dias' ? 29 : 0), jornada),
    retry: false,
  })
  const cargando = consulta.isPending
  const error = consulta.error ? mensajeErrorSupabase(consulta.error) : null
  const resumen = useMemo(() => calcularResumenIndicadores(consulta.data ?? []), [consulta.data])
  const datoValido = !error && !cargando && consulta.isSuccess

  return <section aria-busy={consulta.isFetching} className="min-w-0 space-y-5">
    <label className={`${labelCls} max-w-xs`}>Período
      <select className={inputCls} value={periodo} onChange={event => setPeriodo(event.target.value as Periodo)}>
        <option value="hoy">Hoy</option><option value="7dias">Últimos 7 días</option><option value="30dias">Últimos 30 días</option>
      </select>
    </label>
    {consulta.isFetching && !consulta.isPending && <p role="status" className="text-sm text-slate-600">Actualizando...</p>}
    {cargando ? <EstadoVista variante="cargando" mensaje="Calculando indicadores..." />
      : error ? <EstadoVista variante="error" mensaje={error} onReintentar={() => void consulta.refetch()} /> : null}
    <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2">
      <article className={`${cardCls} min-w-0 p-5`}>
        <p className="text-sm text-slate-600">Unidades producidas</p>
        <p className="mt-2 text-3xl font-bold text-brand-800">{formatMiles(datoValido ? resumen.totalUnidades : null)}</p>
      </article>
      <article className={`${cardCls} min-w-0 p-5`}>
        <p className="text-sm text-slate-600">Registros de producción</p>
        <p className="mt-2 text-3xl font-bold text-brand-800">{formatMiles(datoValido ? resumen.totalRegistros : null)}</p>
      </article>
    </div>
    {datoValido && <div className={`${cardCls} min-w-0`}>
      <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Totales por producto</h2>
      {resumen.porProducto.length === 0 ? <EstadoVista variante="vacio" mensaje="No hay producción en el período." /> : <TablaProduccionResponsive resumenNumerico
        columnas={[{ titulo: 'Producto', destacada: true }, { titulo: 'Unidades', numerica: true }, { titulo: 'Registros', numerica: true }]}
        filas={resumen.porProducto.map(item => ({ id: item.productoId, celdas: [productos.find(producto => producto.id === item.productoId)?.nombre ?? 'Nombre no disponible', formatMiles(item.cantidad), formatMiles(item.registros)] }))}
      />}
    </div>}
  </section>
}
