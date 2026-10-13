import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerProductos, obtenerTiposEmpaque } from '../../../lib/catalog'
import { obtenerEnvasesDisponibles, obtenerMermas, obtenerProducciones, subscribeProduccion } from '../api'

export function useDatosProduccion(perfilId: string, sucursalId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['produccion', perfilId, sucursalId],
    queryFn: async () => {
      const [productos, empaques, producciones, mermas] = await Promise.all([
        obtenerProductos(true), obtenerTiposEmpaque(), obtenerProducciones(sucursalId), obtenerMermas(sucursalId),
      ])
      const envases = await obtenerEnvasesDisponibles(sucursalId, empaques)
      return { productos, empaques, producciones, mermas, envases }
    },
  })
  useEffect(() => {
    let vigente = true
    const unsubscribe = subscribeProduccion(sucursalId, () => {
      if (vigente) void queryClient.invalidateQueries({ queryKey: ['produccion', perfilId, sucursalId] })
    })
    return () => { vigente = false; unsubscribe() }
  }, [perfilId, sucursalId, queryClient])
  return query
}
