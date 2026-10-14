import { useAuth } from '../../../context/auth-context'
import EstadoVista from '../../../components/EstadoVista'
import { useCargaVendedor } from '../hooks/useCargaVendedor'
import { btnSecondary, cardCls } from '../../../lib/ui'
import { RefreshIcon } from '../../../components/icons'
import { formatMiles } from '../../../lib/format'

export default function Carga() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'
  const { data, isLoading, refetch, isFetching, error } = useCargaVendedor()

  const cargaDisponible = (data ?? []).filter((c) => c.cantidad > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mi carga</h1>
          <p className="mt-1 text-sm text-slate-500">
            {esAdmin
              ? 'Productos asignados a tu usuario.'
              : 'Productos asignados a tu ruta para vender hoy.'}
          </p>
        </div>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshIcon className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {isLoading ? (
        <EstadoVista variante="cargando" mensaje="Cargando carga..." />
      ) : error ? (
        <EstadoVista
          variante="error"
          mensaje="No fue posible cargar tu carga."
          onReintentar={() => void refetch()}
        />
      ) : !data || data.length === 0 ? (
        <EstadoVista
          variante="vacio"
          mensaje={
            esAdmin
              ? 'Tu usuario no tiene carga asignada. La carga de ruta se asigna a cada vendedor mediante despacho.'
              : 'Aún no se te ha asignado carga hoy.'
          }
        />
      ) : cargaDisponible.length === 0 ? (
        <EstadoVista variante="vacio" mensaje="Carga agotada. No quedan unidades disponibles." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cargaDisponible.map((c) => (
            <article key={c.producto_id} className={cardCls}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  {c.producto?.nombre ?? 'Producto'}
                </h2>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">
                  {c.producto?.tipo === 'agua' ? 'Agua' : 'Hielo'}
                </span>
              </div>
              <p className="px-5 py-4 text-sm text-slate-600">
                Unidades disponibles:{' '}
                <span className="text-lg font-bold text-slate-900">{formatMiles(c.cantidad)}</span>
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        La carga la asigna bodega mediante despacho. Es solo lectura.
      </p>
    </div>
  )
}