import { useQuery } from '@tanstack/react-query'
import { obtenerCuadreDiario } from '../api'
import { useAlcanceBodega } from './useMermas'

// El rango ya viene validado; `habilitado` es false mientras el formulario del filtro es inválido.
export function useCuadreDiario(sucursalId: string, desde: string, hasta: string, vendedorId: string, habilitado: boolean) {
  const { perfil, alcance } = useAlcanceBodega(sucursalId)
  return useQuery({
    queryKey: [...alcance, 'cuadre', desde, hasta, vendedorId],
    queryFn: () => obtenerCuadreDiario(sucursalId, desde, hasta, vendedorId || null),
    enabled: habilitado && !!perfil && !!sucursalId,
    retry: false,
    staleTime: 30_000,
  })
}
