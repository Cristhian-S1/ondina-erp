import { useQuery } from '@tanstack/react-query'
import { obtenerProductos, obtenerTiposEmpaque } from '../../../lib/catalog'
import {
  obtenerVendedores, obtenerVendedoresHistorial, obtenerStockBodega, obtenerStockEnvases,
  obtenerCargaVendedores,
} from '../api'
import { useAuth } from '../../../context/auth-context'

export function useDatosBodega(sucursalId: string, incluirStock: boolean) {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['bodega', perfil?.id, perfil?.rol, perfil?.sucursal_id, sucursalId, 'recursos', incluirStock],
    enabled: !!perfil && !!sucursalId,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      const [vendedores, vendedoresHistorial, productos, tiposEmpaque, stockBodega, stockEnvases] = await Promise.all([
        obtenerVendedores(sucursalId), obtenerVendedoresHistorial(sucursalId), obtenerProductos(true), obtenerTiposEmpaque(),
        incluirStock ? obtenerStockBodega(sucursalId) : Promise.resolve([]),
        obtenerStockEnvases(sucursalId),
      ])
      const cargaVendedor = await obtenerCargaVendedores(vendedores.map(v => v.id))
      // `vendedores` (solo activos) alimenta el selector de nuevo despacho; `vendedoresHistorial`, nombres y filtros del historial.
      return { vendedores, vendedoresHistorial, productos, tiposEmpaque, stockBodega, stockEnvases, cargaVendedor }
    },
  })
}
