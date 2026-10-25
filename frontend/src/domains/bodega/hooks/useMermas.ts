import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { TAMANO_PAGINA } from '../../../lib/paginacion'
import { fechaSantiago, inicioPeriodo } from '../../../lib/jornada'
import { obtenerDetallesDespacho, obtenerPaginaDespachos, obtenerPaginaMermas } from '../api'
import type { FiltrosMermas } from '../api'
import type { Despacho, DespachoDetalle } from '../types'
import { inicioDiaSantiago } from './filtrosHistorial'

export function useAlcanceBodega(sucursalId: string) {
  const { perfil } = useAuth()
  return { perfil, alcance: ['bodega', perfil?.id, perfil?.rol, perfil?.sucursal_id, sucursalId] as const }
}

// HU-29: una merma mueve stock de bodega/envases o la carga del vendedor y cambia el cuadre. Se invalida todo
// el alcance de bodega (listas, historial de despachos y cuadre) y los recursos de otros dominios que leen lo mismo.
export function useInvalidarMermas(sucursalId: string) {
  const client = useQueryClient()
  const { perfil, alcance } = useAlcanceBodega(sucursalId)
  return () => Promise.all([
    client.invalidateQueries({ queryKey: alcance }),
    client.invalidateQueries({ queryKey: ['stock', perfil?.id, sucursalId] }),
    client.invalidateQueries({ queryKey: ['produccion', perfil?.id, sucursalId] }),
    client.invalidateQueries({ queryKey: ['ventas', 'carga'] }),
  ])
}

export function useListaMermas(sucursalId: string, filtros: FiltrosMermas) {
  const { perfil, alcance } = useAlcanceBodega(sucursalId)
  const claveFiltro = JSON.stringify([filtros.origen ?? '', filtros.anuladas ?? ''])
  const [posicion, setPosicion] = useState({ filtro: claveFiltro, pagina: 1 })
  if (posicion.filtro !== claveFiltro) setPosicion({ filtro: claveFiltro, pagina: 1 })
  const pagina = posicion.filtro === claveFiltro ? posicion.pagina : 1
  const clave = [...alcance, 'mermas', filtros]
  const query = useQuery({
    queryKey: [...clave, pagina],
    queryFn: () => obtenerPaginaMermas(sucursalId, { ...filtros, pagina, tamanoPagina: TAMANO_PAGINA }),
    enabled: !!perfil && !!sucursalId,
    retry: false,
    staleTime: 30_000,
    placeholderData: (prev, prevQuery) => JSON.stringify(prevQuery?.queryKey.slice(0, -1)) === JSON.stringify(clave) ? keepPreviousData(prev) : undefined,
  })
  return { ...query, pagina, setPagina: (valor: number) => setPosicion({ filtro: claveFiltro, pagina: valor }) }
}

export interface DespachoDelDia {
  despacho: Despacho
  detalles: DespachoDetalle[]
}

// Despachos activos de la jornada de Santiago con sus líneas: el origen "despacho" solo ofrece estos.
export function useDespachosDelDia(sucursalId: string, jornada: string) {
  const { perfil, alcance } = useAlcanceBodega(sucursalId)
  return useQuery({
    queryKey: [...alcance, 'mermas-despachos-dia', jornada],
    queryFn: async (): Promise<DespachoDelDia[]> => {
      const { filas } = await obtenerPaginaDespachos(sucursalId, {
        pagina: 1, tamanoPagina: 100,
        desde: inicioDiaSantiago(jornada), hasta: inicioDiaSantiago(inicioPeriodo(jornada, -1)),
      })
      const activos = filas.filter(d => !d.anulado && fechaSantiago(new Date(d.creado_en)) === jornada)
      const detalles = await obtenerDetallesDespacho(activos.map(d => d.id))
      return activos.map(despacho => ({ despacho, detalles: detalles.filter(d => d.despacho_id === despacho.id) }))
    },
    enabled: !!perfil && !!sucursalId,
    retry: false,
    staleTime: 30_000,
  })
}
