import { useEffect, useState } from 'react'
import { MonthPickerInput } from '@mantine/dates'
import 'dayjs/locale/es'
import { obtenerRankingVendedores } from '../api'

interface RankingVendedor {
  vendedor_id: string
  sucursal_id: string | null
  vendedor: string
  mes: string
  cantidad_ventas: number
  total_vendido: number
}

export default function RankingVendedores() {
  const mesActual = new Date().toISOString().slice(0, 7)

  const [mesSeleccionado, setMesSeleccionado] = useState(mesActual)
  const [ranking, setRanking] = useState<RankingVendedor[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function cargarRanking(): Promise<void> {
      try {
        setCargando(true)
        setError(null)

        const data = await obtenerRankingVendedores(mesSeleccionado)
        setRanking(data)
      } catch {
        setError('No fue posible cargar el ranking de vendedores.')
      } finally {
        setCargando(false)
      }
    }

    void cargarRanking()
  }, [mesSeleccionado])

  const formatearMoneda = (valor: number): string =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(valor)

  const valorPicker = `${mesSeleccionado}-01`

  return (
    <div>
      <h1 className="text-2xl font-semibold">Ranking de vendedores</h1>

      <p className="mt-2 text-gray-600">
        Consulta la posición de los vendedores según sus ventas del período
        seleccionado.
      </p>

      <div className="mt-4 w-full max-w-xs">
        <MonthPickerInput
          label="Seleccionar período"
          placeholder="Selecciona un mes"
          value={valorPicker}
          onChange={(fecha) => {
            if (!fecha) return

            setMesSeleccionado(fecha.slice(0, 7))
          }}
          maxDate={new Date()}
          locale="es"
          valueFormat="MMMM YYYY"
          radius="md"
          size="md"
          dropdownType="popover"
        />
      </div>

      {cargando ? (
        <p className="mt-6 text-sm text-slate-500">
          Cargando ranking...
        </p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      ) : ranking.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No hay ventas registradas para este período.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {ranking.map((item, index) => (
            <div
              key={item.vendedor_id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="text-2xl font-semibold">
                  #{index + 1}
                </div>

                <div>
                  <p className="font-medium">{item.vendedor}</p>

                  <p className="text-sm text-gray-500">
                    {item.cantidad_ventas}{' '}
                    {item.cantidad_ventas === 1 ? 'venta' : 'ventas'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-semibold">
                  {formatearMoneda(item.total_vendido)}
                </p>

                <p className="text-sm text-gray-500">
                  Total vendido
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}