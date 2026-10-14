import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerSucursales } from '../../../lib/catalog'
import { btnSecondary, inputCls, labelCls } from '../../../lib/ui'
import EstadoVista from '../../../components/EstadoVista'

export default function AmbitoBodega({ children }: { children: (sucursalId: string, setOcupado: (ocupado: boolean) => void) => ReactNode }) {
  const { perfil } = useAuth()
  const identidad = JSON.stringify([perfil?.id, perfil?.rol, perfil?.sucursal_id])
  const [ocupado, setOcupado] = useState(false)
  const esAdmin = perfil?.rol === 'administrador'
  const [seleccion, setSeleccion] = useState({ identidad: '', id: '' })
  const sucursales = useQuery({
    queryKey: ['bodega-sucursales', identidad],
    queryFn: obtenerSucursales,
    enabled: esAdmin,
    retry: false,
    staleTime: 30_000,
  })
  if (esAdmin && sucursales.isError && !sucursales.data) return <EstadoVista variante="error" mensaje="No fue posible cargar las sucursales. Inténtalo de nuevo." onReintentar={() => void sucursales.refetch()} />
  if (!perfil || (esAdmin && sucursales.isPending)) return <EstadoVista variante="cargando" />
  const sucursalId = seleccion.identidad === identidad ? seleccion.id : perfil.sucursal_id || sucursales.data?.[0]?.id || ''
  return (
    <div className="min-w-0 space-y-4">
      {esAdmin && sucursales.isError && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No fue posible actualizar las sucursales. Se conserva la selección. <button type="button" className={btnSecondary} onClick={() => void sucursales.refetch()}>Reintentar sucursales</button></div>}
      {perfil.rol === 'administrador' && (
        <label className={`${labelCls} block w-full max-w-sm`}>
          Sucursal
          <select className={inputCls} value={sucursalId} disabled={ocupado} onChange={(e) => setSeleccion({ identidad, id: e.target.value })}>
            {(sucursales.data ?? []).length === 0 && <option value="">Sin sucursales</option>}
            {(sucursales.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      )}
      {/* El borrador y las mutaciones pendientes pertenecen a una única identidad/sucursal. */}
      <Fragment key={`${identidad}:${sucursalId}`}>
        {sucursalId ? children(sucursalId, setOcupado) : <div role="status"><EstadoVista variante="vacio" mensaje="No hay sucursales disponibles." /></div>}
      </Fragment>
    </div>
  )
}
