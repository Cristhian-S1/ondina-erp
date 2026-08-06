import { Link } from 'react-router-dom'
import { useCargaVendedor } from '../hooks/useCargaVendedor'
import { useBidonesVacios } from '../hooks/useBidonesVacios'
import { btnPrimary, btnSecondary, cardCls } from '../../../lib/ui'
import {
  DollarIcon,
  DropletIcon,
  PlusCircleIcon,
  RefreshIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '../../../components/icons'

export default function Ventas() {
  const carga = useCargaVendedor()
  const bidones = useBidonesVacios()

  const totalBidones = (bidones.data ?? []).reduce((sum, b) => sum + (b.cantidad ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumen de tu ruta: carga, envases recibidos y accesos rápidos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/ventas/registrar" className={`${cardCls} group flex items-center gap-4 p-5 transition hover:border-brand-300`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <PlusCircleIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">Registrar venta</p>
            <p className="text-xs text-slate-500">Una sola confirmación atómica</p>
          </div>
        </Link>

        <Link to="/clientes" className={`${cardCls} group flex items-center gap-4 p-5 transition hover:border-brand-300`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <UsersIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">Clientes</p>
            <p className="text-xs text-slate-500">Tu cartera y alta nueva</p>
          </div>
        </Link>

        <Link to="/carga" className={`${cardCls} group flex items-center gap-4 p-5 transition hover:border-brand-300`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <DropletIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">Mi carga</p>
            <p className="text-xs text-slate-500">Productos asignados</p>
          </div>
        </Link>

        <Link to="/gastos" className={`${cardCls} group flex items-center gap-4 p-5 transition hover:border-brand-300`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <DollarIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-800">Gastos</p>
            <p className="text-xs text-slate-500">Combustible, averías, otros</p>
          </div>
        </Link>
      </div>

      {/* HU-05: bidones vacíos recibidos hoy */}
      <section className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <DropletIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Envases recibidos hoy</h2>
              <p className="text-xs text-slate-500">
                Devoluciones en buen estado + envases recibidos en ventas del día.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void bidones.refetch()}
            disabled={bidones.isFetching}
          >
            <RefreshIcon className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        {bidones.isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Cargando...</p>
        ) : bidones.data && bidones.data.length > 0 ? (
          <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-900">{totalBidones}</span>
              <span className="text-sm text-slate-500">envases</span>
            </div>
            <ul className="flex flex-wrap gap-2 sm:ml-auto">
              {bidones.data.map((b) => (
                <li
                  key={b.tipo_empaque_id ?? b.empaque_nombre ?? 'empaque'}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
                >
                  <span className="font-semibold text-slate-900">{b.cantidad ?? 0}</span>
                  <span className="text-slate-600">{b.empaque_nombre ?? 'Empaque'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No has registrado envases recibidos hoy.
          </p>
        )}
      </section>

      {/* HU-03 previsual: resumen de carga */}
      <section className={cardCls}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Mi carga de hoy</h2>
          <Link to="/carga" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Ver todo
          </Link>
        </div>
        {carga.isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Cargando...</p>
        ) : carga.data && carga.data.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {carga.data.slice(0, 5).map((c) => (
              <li key={c.producto_id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="truncate text-sm text-slate-900">
                  {c.producto?.nombre ?? 'Producto'}
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-900">{c.cantidad}</span>
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