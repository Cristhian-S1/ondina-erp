import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerVendedoresSucursal } from '../api'

export function useVendedoresSucursal() {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['ventas', 'vendedores', perfil?.sucursal_id],
    queryFn: () => obtenerVendedoresSucursal(perfil?.sucursal_id ?? undefined),
    enabled: !!perfil?.sucursal_id,
  })
}