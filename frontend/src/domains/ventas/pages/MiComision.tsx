import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/auth-context'
import { obtenerCantidadVentasJornada, obtenerMiComision } from '../api'

//h
interface ComisionVendedor {
  vendedor_id: string
  jornada: string
  tipo: 'agua' | 'hielo'
  base_comision: number
  porcentaje: number | null
  monto_fijo: number | null
  ventas_del_tipo: number
  comision: number
}

export default function MiComision() {
  const { perfil } = useAuth()

  const [comisiones, setComisiones] = useState<ComisionVendedor[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalVentas, setTotalVentas] = useState(0)

  useEffect(() => {
    async function cargarComision(): Promise<void> {
      if (!perfil) {
        setCargando(false)
        return
      }

      try {
        setCargando(true)
        setError(null)

        const [data, cantidadVentas] = await Promise.all([
          obtenerMiComision(perfil.id),
          obtenerCantidadVentasJornada(perfil.id),
        ])

        setComisiones(data)
        setTotalVentas(cantidadVentas)
      } catch {
        setError('No fue posible cargar tu comisión.')
      } finally {
        setCargando(false)
      }
    }

    void cargarComision()
  }, [perfil])

  if (cargando) {
    return <p className="text-sm text-slate-500">Cargando comisión...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  const jornadaActual = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const nombreJornadaActual = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

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

  const formatearMoneda = (valor: number): string =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(valor)

  return (
    <div>
      <h1 className="text-2xl font-semibold">Mi comisión</h1>

      <p className="mt-2 text-gray-600">
        Consulta la comisión acumulada según tus ventas registradas.
      </p>
      <p className="mt-1 text-sm text-gray-500 capitalize">
        Jornada: {nombreJornadaActual}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Comisión acumulada</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatearMoneda(totalComision)}
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Ventas consideradas</p>
          <p className="mt-1 text-2xl font-semibold">{totalVentas}</p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total vendido</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatearMoneda(totalVendido)}
          </p>
        </div>
      </div>

      {!tieneComisiones && (
        <p className="mt-6 text-sm text-gray-500">
          No hay comisiones registradas para esta jornada.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {comisionesJornada.map((item) => (
          <div
            key={`${item.jornada}-${item.tipo}`}
            className="rounded-xl bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium capitalize">{item.tipo}</h2>

              <span className="font-semibold">
                {formatearMoneda(item.comision)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Total vendido</p>
                <p>{formatearMoneda(item.base_comision)}</p>
              </div>

              <div>
                <p className="text-gray-500">Ventas</p>
                <p>{item.ventas_del_tipo}</p>
              </div>

              <div>
                <p className="text-gray-500">Porcentaje</p>
                <p>
                  {item.porcentaje !== null
                    ? `${item.porcentaje}%`
                    : 'Sin definir'}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Monto fijo</p>
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