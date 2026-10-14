import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerProductos } from '../../../lib/catalog'
import { obtenerEnvasesDisponibles, obtenerIncidencias, obtenerMermas, obtenerProducciones, subscribeProduccion } from '../api'
import type { RecursoProduccion } from '../api'

export type SeccionProduccion = 'registrar' | 'envases' | 'historial' | 'indicadores' | 'incidencias'
type Consulta = 'productos' | 'producciones' | 'mermas' | 'incidencias' | 'envases' | 'historial' | 'indicadores'
const recursos: Record<RecursoProduccion, Consulta[]> = {
  producciones: ['producciones', 'historial', 'indicadores'],
  mermas: ['mermas'],
  stock_envases: ['envases'],
  incidencias_produccion: ['incidencias'],
}
const secciones: Record<SeccionProduccion, Consulta[]> = {
  registrar: ['productos', 'producciones'],
  envases: ['envases'],
  historial: ['productos', 'historial'],
  indicadores: ['productos', 'indicadores'],
  incidencias: ['productos', 'mermas', 'incidencias'],
}

export function useDatosProduccion(perfilId: string, sucursalId: string, seccion: SeccionProduccion = 'registrar') {
  const queryClient = useQueryClient()
  const key = (recurso: Consulta) => ['produccion', perfilId, sucursalId, recurso]
  const productos = useQuery({ queryKey: key('productos'), queryFn: () => obtenerProductos(true), enabled: seccion !== 'envases', retry: false })
  const producciones = useQuery({ queryKey: key('producciones'), queryFn: () => obtenerProducciones(sucursalId), enabled: seccion === 'registrar', retry: false })
  const mermas = useQuery({ queryKey: key('mermas'), queryFn: () => obtenerMermas(sucursalId), enabled: seccion === 'incidencias', retry: false })
  const incidencias = useQuery({ queryKey: key('incidencias'), queryFn: () => obtenerIncidencias(sucursalId), enabled: seccion === 'incidencias', retry: false })
  const envases = useQuery({ queryKey: key('envases'), queryFn: () => obtenerEnvasesDisponibles(sucursalId), enabled: seccion === 'envases', retry: false })

  function invalidarConsultas(consultas: Consulta[]) {
    return Promise.all(consultas.map(recurso => queryClient.invalidateQueries({ queryKey: key(recurso) })))
  }
  function invalidar(recurso: RecursoProduccion) {
    // Registrar producción consume envases; las otras escrituras no los alteran.
    return invalidarConsultas(recurso === 'producciones' ? [...recursos[recurso], 'envases'] : recursos[recurso])
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
  return { productos, producciones, mermas, incidencias, envases, invalidar, actualizar: () => invalidarConsultas(secciones[seccion]) }
}
