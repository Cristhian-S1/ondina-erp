import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/auth-context'
import { obtenerSucursalDashboard } from '../lib/dashboard'
import type { Role } from '../types'

const rolEstilos: Record<Role, { etiqueta: string; clase: string }> = {
  vendedor: { etiqueta: 'Vendedor', clase: 'bg-sky-100 text-sky-700' },
  bodega: { etiqueta: 'Bodega', clase: 'bg-amber-100 text-amber-700' },
  produccion: { etiqueta: 'Producción', clase: 'bg-violet-100 text-violet-700' },
  administrador: { etiqueta: 'Administrador', clase: 'bg-emerald-100 text-emerald-700' },
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const { data: sucursal, isPending, isError, refetch } = useQuery({
    queryKey: ['dashboard-sucursal', perfil?.id, perfil?.sucursal_id],
    queryFn: () => obtenerSucursalDashboard(perfil!.sucursal_id!),
    enabled: !!perfil?.sucursal_id,
  })

  if (!perfil) return null

  const rol = rolEstilos[perfil.rol]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Hola, {perfil.nombres}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {!perfil.sucursal_id ? 'Todas las sucursales' : isError ? 'Sucursal no disponible' : isPending ? 'Cargando sucursal...' : sucursal?.nombre ?? 'Sucursal no disponible'}
        </p>
      </div>

      {isError && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        <p>No fue posible cargar la sucursal. Inténtalo de nuevo.</p>
        <button type="button" onClick={() => void refetch()} className="mt-2 min-h-11 min-w-11 rounded-lg border border-red-200 px-4">Reintentar</button>
      </div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {perfil.nombres} {perfil.apellidos}
          </h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${rol.clase}`}>
            {rol.etiqueta}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">RUT</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {perfil.rut ?? 'Sin RUT'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Teléfono
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {perfil.telefono ?? 'Sin teléfono'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Sucursal
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {perfil.sucursal_id ? sucursal?.nombre ?? 'Sucursal no disponible' : 'Todas las sucursales'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Estado
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {perfil.activo ? 'Activo' : 'Inactivo'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
