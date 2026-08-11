import { useEffect, useMemo, useState } from 'react'
import { cardCls, inputCls, labelCls, tdCls, thCls } from '../../../lib/ui'
import type { Producto } from '../../../types'
import { obtenerIndicadoresProduccion } from '../api'
import { calcularResumenIndicadores } from '../calculos'
import type { IndicadorProduccionDiario } from '../types'

type Periodo = 'hoy' | '7dias' | '30dias'

interface IndicadoresProduccionProps {
  sucursalId: string
  productos: Producto[]
  versionDatos: number
}

function fechaLocal(fecha: Date) {
  const offset = fecha.getTimezoneOffset() * 60_000
  return new Date(fecha.getTime() - offset).toISOString().slice(0, 10)
}

export default function IndicadoresProduccion({ sucursalId, productos, versionDatos }: IndicadoresProduccionProps) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [registros, setRegistros] = useState<IndicadorProduccionDiario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hoy = new Date()
    const inicio = new Date(hoy)
    if (periodo === '7dias') inicio.setDate(hoy.getDate() - 6)
    if (periodo === '30dias') inicio.setDate(hoy.getDate() - 29)
    let vigente = true
    const timer = window.setTimeout(() => {
      setCargando(true)
      setError(null)
      void obtenerIndicadoresProduccion(sucursalId, fechaLocal(inicio), fechaLocal(hoy))
        .then((data) => { if (vigente) setRegistros(data) })
        .catch((cause: unknown) => { if (vigente) setError(cause instanceof Error ? cause.message : 'No fue posible calcular indicadores.') })
        .finally(() => { if (vigente) setCargando(false) })
    }, 0)
    return () => { vigente = false; window.clearTimeout(timer) }
  }, [periodo, sucursalId, versionDatos])

  const resumen = useMemo(() => calcularResumenIndicadores(registros), [registros])

  return <section className="space-y-5">
    <label className={`${labelCls} max-w-xs`}>Período<select className={inputCls} value={periodo} onChange={(event) => setPeriodo(event.target.value as Periodo)}><option value="hoy">Hoy</option><option value="7dias">Últimos 7 días</option><option value="30dias">Últimos 30 días</option></select></label>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {cargando ? <p className="text-sm text-slate-500">Calculando indicadores...</p> : null}
    {!cargando ? <><div className="grid gap-4 sm:grid-cols-2"><article className={`${cardCls} p-5`}><p className="text-sm text-slate-500">Unidades producidas</p><p className="mt-2 text-3xl font-bold text-brand-800">{resumen.totalUnidades}</p></article><article className={`${cardCls} p-5`}><p className="text-sm text-slate-500">Registros de producción</p><p className="mt-2 text-3xl font-bold text-brand-800">{resumen.totalRegistros}</p></article></div><div className={cardCls}><h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Totales por producto</h2>{resumen.porProducto.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No hay producción en el período.</p> : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50"><th className={thCls}>Producto</th><th className={`${thCls} text-right`}>Unidades</th><th className={`${thCls} text-right`}>Registros</th></tr></thead><tbody className="divide-y divide-slate-100">{resumen.porProducto.map((item) => <tr key={item.productoId}><td className={tdCls}>{productos.find((producto) => producto.id === item.productoId)?.nombre ?? 'Producto'}</td><td className={`${tdCls} text-right font-semibold`}>{item.cantidad}</td><td className={`${tdCls} text-right`}>{item.registros}</td></tr>)}</tbody></table></div>}</div></> : null}
  </section>
}
