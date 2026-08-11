import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerClientesRuta } from '../api'

export function useClientesRuta() {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['ventas', 'clientes', perfil?.id],
    queryFn: () => {
      if (!perfil) return Promise.resolve([])
      return obtenerClientesRuta(perfil)
    },
    enabled: !!perfil,
  })
}