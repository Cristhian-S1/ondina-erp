import { usePaginaProduccion } from './usePaginaProduccion'
import { useEffect } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerProductos } from '../../../lib/catalog'
import { obtenerStockBodega, obtenerEnvasesDisponibles, obtenerPaginaIncidencias, obtenerPaginaMermas, obtenerPaginaProducciones, subscribeProduccion } from '../api'
import type { RecursoProduccion } from '../api'

export type SeccionProduccion = 'registrar' | 'envases' | 'historial' | 'indicadores' | 'incidencias'
type Consulta = 'stock' | 'productos' | 'producciones' | 'mermas' | 'incidencias' | 'envases' | 'historial' | 'indicadores'
const recursos: Record<RecursoProduccion, Consulta[]> = {
  producciones: ['producciones', 'historial', 'indicadores'],
  mermas: ['mermas', 'stock'],
  stock_bodega: ['stock'],
  stock_envases: ['envases'],
  incidencias_produccion: ['incidencias'],
}
const secciones: Record<SeccionProduccion, Consulta[]> = {
  registrar: ['productos', 'producciones', 'envases'],
  envases: ['envases'],
  historial: ['productos', 'historial'],
  indicadores: ['productos', 'indicadores'],
  incidencias: ['productos', 'mermas', 'incidencias', 'stock'],
}

export function useDatosProduccion(perfilId: string, sucursalId: string, seccion: SeccionProduccion = 'registrar') {
  const queryClient = useQueryClient()
  const key = (recurso: Consulta) => ['produccion', perfilId, sucursalId, recurso]
  const productos = useQuery({ queryKey: key('productos'), queryFn: () => obtenerProductos(true), enabled: seccion !== 'envases', retry: false })
  const pagProducciones = usePaginaProduccion(`${perfilId}:${sucursalId}:producciones`)
  const pagMermas = usePaginaProduccion(`${perfilId}:${sucursalId}:mermas`)
  const pagIncidencias = usePaginaProduccion(`${perfilId}:${sucursalId}:incidencias`)
  const produccionesQuery = useQuery({ queryKey: [...key('producciones'), pagProducciones.pagina], queryFn: () => obtenerPaginaProducciones(sucursalId, pagProducciones.pagina), enabled: seccion === 'registrar', retry: false, placeholderData: (prev, query) => JSON.stringify(query?.queryKey.slice(0, -1)) === JSON.stringify(key('producciones')) ? keepPreviousData(prev) : undefined })
  const mermasQuery = useQuery({ queryKey: [...key('mermas'), pagMermas.pagina], queryFn: () => obtenerPaginaMermas(sucursalId, pagMermas.pagina), enabled: seccion === 'incidencias', retry: false, placeholderData: (prev, query) => JSON.stringify(query?.queryKey.slice(0, -1)) === JSON.stringify(key('mermas')) ? keepPreviousData(prev) : undefined })
  const incidenciasQuery = useQuery({ queryKey: [...key('incidencias'), pagIncidencias.pagina], queryFn: () => obtenerPaginaIncidencias(sucursalId, pagIncidencias.pagina), enabled: seccion === 'incidencias', retry: false, placeholderData: (prev, query) => JSON.stringify(query?.queryKey.slice(0, -1)) === JSON.stringify(key('incidencias')) ? keepPreviousData(prev) : undefined })
  const producciones = { ...produccionesQuery, data: produccionesQuery.data?.filas, total: produccionesQuery.data?.total ?? 0, ...pagProducciones }
  const mermas = { ...mermasQuery, data: mermasQuery.data?.filas, total: mermasQuery.data?.total ?? 0, ...pagMermas }
  const incidencias = { ...incidenciasQuery, data: incidenciasQuery.data?.filas, total: incidenciasQuery.data?.total ?? 0, ...pagIncidencias }
  const stock = useQuery({ queryKey: key('stock'), queryFn: () => obtenerStockBodega(sucursalId), enabled: seccion === 'incidencias', retry: false, staleTime: 0, refetchOnWindowFocus: 'always' })
  const envases = useQuery({ queryKey: key('envases'), queryFn: () => obtenerEnvasesDisponibles(sucursalId), enabled: seccion === 'envases' || seccion === 'registrar', retry: false })

  function invalidarConsultas(consultas: Consulta[]) {
    return Promise.all(consultas.map(recurso => queryClient.invalidateQueries({ queryKey: key(recurso) })))
  }
  function invalidar(recurso: RecursoProduccion) {
    // Registrar producción consume envases; las otras escrituras no los alteran.
    return invalidarConsultas(recurso === 'producciones' ? [...recursos[recurso], 'envases', 'stock'] : recursos[recurso])
  }
  useEffect(() => {
    let vigente = true
    const unsubscribe = subscribeProduccion(sucursalId, (recurso) => {
      if (vigente) {
        for (const consulta of recursos[recurso]) {
          void queryClient.invalidateQueries({ queryKey: ['produccion', perfilId, sucursalId, consulta] })
        }
      }
    })
    return () => { vigente = false; unsubscribe() }
  }, [perfilId, sucursalId, queryClient])
  return { productos, producciones, mermas, incidencias, envases, stock, invalidar, actualizar: () => invalidarConsultas(secciones[seccion]) }
}
