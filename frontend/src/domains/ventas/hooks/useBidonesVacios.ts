import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerBidonesVacios } from '../api'

export function useBidonesVacios() {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['ventas', 'bidones', perfil?.id],
    queryFn: () => {
      if (!perfil) return Promise.resolve([])
      return obtenerBidonesVacios(perfil)
    },
    enabled: !!perfil,
  })
}