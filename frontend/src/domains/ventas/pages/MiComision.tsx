import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import EstadoVista from '../../../components/EstadoVista'
import { cardCls } from '../../../lib/ui'
import { formatMiles } from '../../../lib/format'
import { obtenerCantidadVentasJornada, obtenerMiComision } from '../api'

const TIPO_ETIQUETA: Record<string, string> = {
  agua: 'Agua',
  hielo: 'Hielo',
}

const formatearMoneda = (valor: number): string => `$${formatMiles(valor)}`

function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es-CL') + texto.slice(1)
}

export default function MiComision() {
  const { perfil } = useAuth()

  const query = useQuery({
    queryKey: ['mi-comision', perfil?.id, perfil?.sucursal_id],
    queryFn: async () => {
      const [comisiones, totalVentas] = await Promise.all([
        obtenerMiComision(perfil!.id), obtenerCantidadVentasJornada(perfil!.id),
      ])
      return { comisiones, totalVentas }
    },
    enabled: !!perfil,
    // FE-07: refresh on return after sales recorded in other screens or sessions.
    staleTime: 30_000,
    refetchOnWindowFocus: 'always',
  })
  const comisiones = query.data?.comisiones ?? []
  const totalVentas = query.data?.totalVentas ?? 0

  if (query.isLoading || query.isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Mi comisión</h1>
        {query.isError ? (
          <EstadoVista
            variante="error"
            mensaje="No fue posible cargar tu comisión."
            onReintentar={() => void query.refetch()}
          />
        ) : (
          <EstadoVista variante="cargando" mensaje="Cargando comisión..." />
        )}
      </div>
    )
  }

  const jornadaActual = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const nombreJornadaActual = capitalizar(
    new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date()),
  )

  const comisionesJornada = comisiones.filter(
    (item) => item.jornada === jornadaActual,
  )

  const tieneComisiones = comisionesJornada.length > 0

  const totalComision = comisionesJornada.reduce(
    (total, item) => total + item.comision,
    0,
  )

  const totalVendido = comisionesJornada.reduce(
    (total, item) => total + item.base_comision,
    0,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi comisión</h1>
        <p className="mt-1 text-sm text-slate-500">
          Comisión acumulada según tus ventas registradas.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Jornada: {nombreJornadaActual}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`${cardCls} p-4`}>
          <p className="text-sm text-slate-500">Comisión acumulada</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatearMoneda(totalComision)}
          </p>
        </div>

        <div className={`${cardCls} p-4`}>
          <p className="text-sm text-slate-500">Ventas consideradas</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatMiles(totalVentas)}</p>
        </div>

        <div className={`${cardCls} p-4`}>
          <p className="text-sm text-slate-500">Total vendido</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatearMoneda(totalVendido)}
          </p>
        </div>
      </div>

      {!tieneComisiones && (
        <EstadoVista variante="vacio" mensaje="Aún no hay comisiones registradas para esta jornada." />
      )}

      <div className="space-y-3">
        {comisionesJornada.map((item) => (
          <div
            key={`${item.jornada}-${item.tipo}`}
            className={`${cardCls} p-4`}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{TIPO_ETIQUETA[item.tipo] ?? capitalizar(item.tipo)}</h2>

              <span className="font-semibold text-slate-900">
                {formatearMoneda(item.comision)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Total vendido</p>
                <p className="text-slate-900">{formatearMoneda(item.base_comision)}</p>
              </div>

              <div>
                <p className="text-slate-500">Ventas</p>
                <p className="text-slate-900">{formatMiles(item.ventas_del_tipo)}</p>
              </div>

              <div>
                <p className="text-slate-500">Porcentaje</p>
                <p>
                  {item.porcentaje !== null
                    ? `${item.porcentaje}%`
                    : 'Sin definir'}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Monto fijo</p>
                <p>
                  {item.monto_fijo !== null
                    ? formatearMoneda(item.monto_fijo)
                    : 'No aplica'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}