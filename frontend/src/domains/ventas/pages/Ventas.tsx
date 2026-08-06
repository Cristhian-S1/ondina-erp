import { Link } from 'react-router-dom'
import { useCargaVendedor } from '../hooks/useCargaVendedor'
import { btnPrimary, btnSecondary, cardCls } from '../../../lib/ui'
import {
  DollarIcon,
  DropletIcon,
  PlusCircleIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '../../../components/icons'

export default function Ventas() {
  const carga = useCargaVendedor()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumen de tu ruta: carga asignada y accesos rápidos.
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
            <p className="text-xs text-slate-500">Una sola confirmación atómica</p>
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
            <p className="text-xs text-slate-500">Tu cartera y alta nueva</p>
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
            <p className="text-xs text-slate-500">Productos asignados</p>
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
          <h2 className="text-base font-semibold text-slate-900">Mi carga de hoy</h2>
          <Link
            to="/carga"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Ver todo
          </Link>
        </div>
        {carga.isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Cargando...</p>
        ) : carga.data && carga.data.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {carga.data.slice(0, 5).map((c) => (
              <li
                key={c.producto_id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <span className="truncate text-sm text-slate-900">
                  {c.producto?.nombre ?? 'Producto'}
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-900">
                  {c.cantidad}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Aún no se te ha asignado carga hoy.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/ventas/registrar" className={btnPrimary}>
          <ShoppingCartIcon className="h-4 w-4" />
          Registrar venta
        </Link>
        <Link to="/clientes" className={btnSecondary}>
          <UsersIcon className="h-4 w-4" />
          Ver clientes
        </Link>
      </div>
    </div>
  )
}