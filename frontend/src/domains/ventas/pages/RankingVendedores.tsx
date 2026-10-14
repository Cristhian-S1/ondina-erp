import { useState } from 'react'
import { useAuth } from '../../../context/auth-context'
import EstadoVista from '../../../components/EstadoVista'
import { cardCls, inputCls, labelCls } from '../../../lib/ui'
import { formatMiles } from '../../../lib/format'
import { mesActualSantiago, useRankingVendedores } from '../hooks/useRankingVendedores'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const ANIOS_ATRAS = 3

const formatearMoneda = (valor: number): string => `$${formatMiles(valor)}`

export default function RankingVendedores() {
  const { perfil } = useAuth()
  const mesActual = mesActualSantiago()
  const [mesSeleccionado, setMesSeleccionado] = useState(mesActual)
  const { data, isPending, isError, refetch } = useRankingVendedores(mesSeleccionado)

  const [anioActual, mesNumeroActual] = mesActual.split('-').map(Number)
  const [anio, mesNumero] = mesSeleccionado.split('-').map(Number)
  const anios = Array.from({ length: ANIOS_ATRAS + 1 }, (_, i) => anioActual - i)
  const maxMes = anio === anioActual ? mesNumeroActual : 12

  function cambiar(nuevoAnio: number, nuevoMes: number) {
    const tope = nuevoAnio === anioActual ? mesNumeroActual : 12
    setMesSeleccionado(`${nuevoAnio}-${String(Math.min(nuevoMes, tope)).padStart(2, '0')}`)
  }

  const esAdmin = perfil?.rol === 'administrador'
  const descripcion = esAdmin
    ? 'Posición de los vendedores según sus ventas del período seleccionado.'
    : 'Tu posición entre los vendedores según las ventas del período seleccionado.'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ranking de vendedores</h1>
        <p className="mt-1 text-sm text-slate-500">{descripcion}</p>
      </div>

      <fieldset className="grid max-w-md grid-cols-2 gap-3">
        <legend className={labelCls}>Período</legend>
        <label className="text-sm text-slate-600">
          <span className="sr-only">Mes</span>
          <select
            aria-label="Mes"
            className={inputCls}
            value={mesNumero}
            onChange={(e) => cambiar(anio, Number(e.target.value))}
          >
            {MESES.map((nombre, i) => (
              <option key={nombre} value={i + 1} disabled={i + 1 > maxMes}>{nombre}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="sr-only">Año</span>
          <select
            aria-label="Año"
            className={inputCls}
            value={anio}
            onChange={(e) => cambiar(Number(e.target.value), mesNumero)}
          >
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </fieldset>

      {isPending ? (
        <EstadoVista variante="cargando" mensaje="Cargando ranking..." />
      ) : isError ? (
        <EstadoVista
          variante="error"
          mensaje="No fue posible cargar el ranking de vendedores."
          onReintentar={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EstadoVista variante="vacio" mensaje="No hay ventas registradas para este período." />
      ) : (
        <ol className="space-y-3">
          {data.map((item, index) => {
            const esPropia = item.vendedor_id === perfil?.id
            const destacado = index < 3
            return (
              <li
                key={item.vendedor_id}
                aria-current={esPropia ? 'true' : undefined}
                className={`${cardCls} flex items-center justify-between gap-3 p-4 ${
                  esPropia ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : ''
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      destacado ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {item.vendedor}
                      {esPropia && <span className="ml-2 text-xs font-semibold text-brand-800">(Tú)</span>}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatMiles(item.cantidad_ventas)} {item.cantidad_ventas === 1 ? 'venta' : 'ventas'}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-slate-900">{formatearMoneda(item.total_vendido)}</p>
                  <p className="text-xs text-slate-500">Total vendido</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
