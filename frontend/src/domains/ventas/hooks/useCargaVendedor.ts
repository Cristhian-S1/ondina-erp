import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerCargaVendedor } from '../api'

export function useCargaVendedor() {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['ventas', 'carga', perfil?.id],
    queryFn: () => {
      if (!perfil) return Promise.resolve([])
      return obtenerCargaVendedor(perfil)
    },
    enabled: !!perfil,
  })
}