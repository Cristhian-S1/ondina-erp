import { Link } from 'react-router-dom'
import { useAuth } from '../../../context/auth-context'
import EstadoVista from '../../../components/EstadoVista'
import { useCargaVendedor } from '../hooks/useCargaVendedor'
import { cardCls } from '../../../lib/ui'
import { formatMiles } from '../../../lib/format'
import {
  DollarIcon,
  DropletIcon,
  PlusCircleIcon,
  UsersIcon,
} from '../../../components/icons'

export default function Ventas() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'
  const carga = useCargaVendedor()
  const cargaDisponible = (carga.data ?? []).filter((c) => c.cantidad > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
        <p className="mt-1 text-sm text-slate-500">
          {esAdmin
            ? 'Accesos rápidos de ventas y la carga asignada a tu usuario.'
            : 'Resumen de tu ruta: carga asignada y accesos rápidos.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/ventas/registrar"
          className={`${cardCls} group flex items-center gap-4 p-5 transition hover:border-brand-300`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <PlusCircleIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">
              Registrar venta
            </p>
            <p className="text-xs text-slate-500">Productos, cliente y forma de pago</p>
          </div>
        </Link>

        <Link
          to="/clientes"
          className={`${cardCls} group flex items-center gap-4 p-5 transition hover:border-brand-300`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <UsersIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">
              Clientes
            </p>
            <p className="text-xs text-slate-500">{esAdmin ? 'Cartera por vendedor y alta nueva' : 'Tu cartera y alta nueva'}</p>
          </div>
        </Link>

        <Link
          to="/carga"
          className={`${cardCls} group flex items-center gap-4 p-5 transition hover:border-brand-300`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <DropletIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">
              Mi carga
            </p>
            <p className="text-xs text-slate-500">{esAdmin ? 'Carga de tu usuario' : 'Productos asignados'}</p>
          </div>
        </Link>

        <Link
          to="/gastos"
          className={`${cardCls} group flex items-center gap-4 p-5 transition hover:border-brand-300`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <DollarIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">
              Gastos
            </p>
            <p className="text-xs text-slate-500">Combustible, averías, otros</p>
          </div>
        </Link>
      </div>

      {/* HU-03: resumen de carga */}
      <section className={cardCls}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{esAdmin ? 'Carga de tu usuario hoy' : 'Mi carga de hoy'}</h2>
          <Link
            to="/carga"
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Ver todo
          </Link>
        </div>
        {carga.isLoading ? (
          <EstadoVista variante="cargando" mensaje="Cargando carga..." />
        ) : carga.error ? (
          <EstadoVista
            variante="error"
            mensaje="No fue posible cargar tu carga."
            onReintentar={() => void carga.refetch()}
          />
        ) : cargaDisponible.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {cargaDisponible.slice(0, 5).map((c) => (
              <li
                key={c.producto_id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <span className="truncate text-sm text-slate-900">
                  {c.producto?.nombre ?? 'Producto'}
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-900">
                  {formatMiles(c.cantidad)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EstadoVista
            variante="vacio"
            mensaje={
              carga.data?.length
                ? 'Carga agotada. No quedan unidades disponibles.'
                : esAdmin
                  ? 'Tu usuario no tiene carga asignada. La carga de ruta se asigna a cada vendedor mediante despacho.'
                  : 'Aún no se te ha asignado carga hoy.'
            }
          />
        )}
      </section>
    </div>
  )
}
