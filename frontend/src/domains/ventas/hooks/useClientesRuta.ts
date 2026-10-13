import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerClientesRuta } from '../api'

export function useClientesRuta(sucursalSeleccionada?: string, vendedorSeleccionado?: string) {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'
  const sucursalId = esAdmin ? sucursalSeleccionada : perfil?.sucursal_id
  const vendedorId = esAdmin ? vendedorSeleccionado : perfil?.id
  return useQuery({
    queryKey: ['ventas', 'clientes', perfil?.id, sucursalId, vendedorId],
    queryFn: () => perfil ? obtenerClientesRuta(perfil, sucursalId ?? undefined, vendedorId) : Promise.resolve([]),
    enabled: !!perfil && (!esAdmin || (!!sucursalId && !!vendedorId)),
  })
}
