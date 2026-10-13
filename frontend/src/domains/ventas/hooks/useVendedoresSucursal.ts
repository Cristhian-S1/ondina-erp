import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerVendedoresSucursal } from '../api'

export function useVendedoresSucursal(sucursalSeleccionada?: string) {
  const { perfil } = useAuth()
  const sucursalId = perfil?.rol === 'administrador' ? sucursalSeleccionada : perfil?.sucursal_id
  return useQuery({
    queryKey: ['ventas', 'vendedores', perfil?.id, sucursalId],
    queryFn: () => obtenerVendedoresSucursal(sucursalId ?? undefined),
    enabled: !!sucursalId,
  })
}