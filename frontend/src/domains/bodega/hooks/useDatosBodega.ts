import { useQuery } from '@tanstack/react-query'
import { obtenerProductos, obtenerTiposEmpaque } from '../../../lib/catalog'
import {
  obtenerVendedores, obtenerDespachos, obtenerStockBodega, obtenerStockEnvases,
  obtenerDetallesDespacho, obtenerEnvasesDespacho, obtenerDevolucionesProducto,
  obtenerDevolucionesEnvase, obtenerCargaVendedores,
} from '../api'
import { useAuth } from '../../../context/auth-context'

export function useDatosBodega(sucursalId: string, incluirStock: boolean) {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['bodega', perfil?.id, perfil?.rol, perfil?.sucursal_id, sucursalId, incluirStock],
    enabled: !!perfil && !!sucursalId,
    retry: false,
    queryFn: async () => {
      const [vendedores, productos, tiposEmpaque, despachosRaw, stockBodega, stockEnvases] = await Promise.all([
        obtenerVendedores(sucursalId), obtenerProductos(true), obtenerTiposEmpaque(),
        obtenerDespachos(sucursalId), incluirStock ? obtenerStockBodega(sucursalId) : Promise.resolve([]),
        obtenerStockEnvases(sucursalId),
      ])
      const ids = despachosRaw.map((d) => d.id)
      const [despachoDetalles, despachoEnvases, desvProducto, desvEnvase, cargaVendedor] = await Promise.all([
        obtenerDetallesDespacho(ids), obtenerEnvasesDespacho(ids), obtenerDevolucionesProducto(ids),
        obtenerDevolucionesEnvase(ids), obtenerCargaVendedores(vendedores.map((v) => v.id)),
      ])
      const nombres = new Map(vendedores.map((v) => [v.id, `${v.nombres} ${v.apellidos}`]))
      const totales = new Map<string, number>()
      for (const detalle of despachoDetalles) {
        totales.set(detalle.despacho_id, (totales.get(detalle.despacho_id) ?? 0) + detalle.cantidad)
      }
      const despachos = despachosRaw.map((d) => ({
        ...d,
        vendedorNombre: nombres.get(d.vendedor_id) ?? 'Vendedor no disponible',
        totalUnidades: totales.get(d.id) ?? 0,
      }))
      return { vendedores, productos, tiposEmpaque, despachos, stockBodega, stockEnvases,
        despachoDetalles, despachoEnvases, desvProducto, desvEnvase, cargaVendedor }
    },
  })
}
