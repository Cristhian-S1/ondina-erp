import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerSucursales } from '../../../lib/catalog'
import { inputCls, labelCls } from '../../../lib/ui'
import EstadoVista from '../../../components/EstadoVista'

export default function AmbitoBodega({ children }: { children: (sucursalId: string) => ReactNode }) {
  const { perfil } = useAuth()
  const identidad = JSON.stringify([perfil?.id, perfil?.rol, perfil?.sucursal_id])
  const [seleccion, setSeleccion] = useState({ identidad: '', id: '' })
  const sucursales = useQuery({
    queryKey: ['bodega-sucursales', identidad],
    queryFn: obtenerSucursales,
    enabled: !!perfil,
    retry: false,
  })
  if (sucursales.isError) return <EstadoVista variante="error" mensaje="No fue posible cargar las sucursales. Inténtalo de nuevo." onReintentar={() => void sucursales.refetch()} />
  if (sucursales.isPending || !perfil) return <EstadoVista variante="cargando" />
  const sucursalId = seleccion.identidad === identidad ? seleccion.id : perfil.sucursal_id || sucursales.data[0]?.id || ''
  return (
    <div className="min-w-0 space-y-4">
      {perfil.rol === 'administrador' && (
        <label className={`${labelCls} block w-full max-w-sm`}>
          Sucursal
          <select className={inputCls} value={sucursalId} onChange={(e) => setSeleccion({ identidad, id: e.target.value })}>
            {sucursales.data.length === 0 && <option value="">Sin sucursales</option>}
            {sucursales.data.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      )}
      {/* El borrador y las mutaciones pendientes pertenecen a una única identidad/sucursal. */}
      <Fragment key={`${identidad}:${sucursalId}`}>
        {sucursalId ? children(sucursalId) : <div role="status"><EstadoVista variante="vacio" mensaje="No hay sucursales disponibles." /></div>}
      </Fragment>
    </div>
  )
}
