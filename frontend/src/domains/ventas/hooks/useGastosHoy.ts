import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerGastosHoy } from '../api'

export function useGastosHoy() {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['ventas', 'gastos', 'hoy', perfil?.id],
    queryFn: () => {
      if (!perfil) return Promise.resolve([])
      return obtenerGastosHoy(perfil)
    },
    enabled: !!perfil,
  })
}