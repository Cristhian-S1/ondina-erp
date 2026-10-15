import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { TAMANO_PAGINA, totalPaginas } from '../../../lib/paginacion'
import { obtenerPaginaDespachos, obtenerDespacho, obtenerDetallesDespacho, obtenerEnvasesDespacho,
  obtenerDevolucionesProducto, obtenerDevolucionesEnvase } from '../api'
import type { Despacho } from '../types'
import type { FiltrosDespachos, VendedorSucursal } from '../api'

async function detalles(despachos: Despacho[]) {
  const ids = despachos.map(d => d.id)
  const [despachoDetalles, despachoEnvases, desvProducto, desvEnvase] = await Promise.all([
    obtenerDetallesDespacho(ids), obtenerEnvasesDespacho(ids), obtenerDevolucionesProducto(ids), obtenerDevolucionesEnvase(ids),
  ])
  return { despachos, despachoDetalles, despachoEnvases, desvProducto, desvEnvase }
}

export function usePaginaBodega(sucursalId: string, filtros: FiltrosDespachos, vendedores: VendedorSucursal[] = [], seleccionado = '') {
  const { perfil } = useAuth()
  const client = useQueryClient()
  const scope = ['bodega', perfil?.id, perfil?.rol, perfil?.sucursal_id, sucursalId]
  const claveFiltro = JSON.stringify([filtros.vendedorId ?? '', filtros.desde ?? '', filtros.hasta ?? ''])
  const [posicion, setPosicion] = useState({ filtro: claveFiltro, pagina: 1 })
  if (posicion.filtro !== claveFiltro) setPosicion({ filtro: claveFiltro, pagina: 1 })
  const paginaSolicitada = posicion.filtro === claveFiltro ? posicion.pagina : 1
  const query = useQuery({
    queryKey: [...scope, 'historial', filtros, paginaSolicitada],
    queryFn: async () => {
      const resultado = await obtenerPaginaDespachos(sucursalId, { ...filtros, pagina: paginaSolicitada, tamanoPagina: TAMANO_PAGINA })
      return { ...await detalles(resultado.filas), total: resultado.total }
    },
    enabled: !!perfil && !!sucursalId,
    retry: false,
    staleTime: 30_000,
    // Retain rows only within the same identity, branch and filters.
    placeholderData: (prev, prevQuery) => JSON.stringify(prevQuery?.queryKey.slice(0, -1)) === JSON.stringify([...scope, 'historial', filtros]) ? keepPreviousData(prev) : undefined,
  })
  const pagina = query.data && !query.isPlaceholderData ? Math.min(paginaSolicitada, totalPaginas(query.data.total)) : paginaSolicitada
  if (pagina !== paginaSolicitada) setPosicion({ filtro: claveFiltro, pagina })
  const individual = useQuery({
    queryKey: [...scope, 'despacho', seleccionado],
    queryFn: async () => detalles(await obtenerDespacho(sucursalId, seleccionado)),
    enabled: !!perfil && !!sucursalId && !!seleccionado,
    retry: false,
    staleTime: 30_000,
    initialData: () => {
      const visible = query.data
      if (!seleccionado || !visible?.despachos.some(d => d.id === seleccionado)) return undefined
      return { despachos: visible.despachos.filter(d => d.id === seleccionado),
        despachoDetalles: visible.despachoDetalles.filter(d => d.despacho_id === seleccionado),
        despachoEnvases: visible.despachoEnvases.filter(d => d.despacho_id === seleccionado),
        desvProducto: visible.desvProducto.filter(d => d.despacho_id === seleccionado),
        desvEnvase: visible.desvEnvase.filter(d => d.despacho_id === seleccionado) }
    },
  })
  const nombres = new Map(vendedores.map(v => [v.id, `${v.nombres} ${v.apellidos}`]))
  function enriquecer(datos: Awaited<ReturnType<typeof detalles>>) {
    return { ...datos, despachos: datos.despachos.map(d => ({ ...d,
      vendedorNombre: nombres.get(d.vendedor_id) ?? `Vendedor no disponible (#${d.vendedor_id.slice(0, 8)})`,
      vendedorDisponible: nombres.has(d.vendedor_id),
      totalUnidades: datos.despachoDetalles.filter(x => x.despacho_id === d.id).reduce((sum, x) => sum + x.cantidad, 0),
    })) }
  }
  async function actualizar() {
    await Promise.all([
      client.invalidateQueries({ queryKey: scope }),
      client.invalidateQueries({ queryKey: ['stock', perfil?.id, sucursalId] }),
      client.invalidateQueries({ queryKey: ['ventas', 'carga'] }),
    ])
  }
  return { ...query, data: query.data ? { ...enriquecer(query.data), total: query.data.total } : undefined,
    individual: individual.data ? enriquecer(individual.data) : undefined,
    errorIndividual: seleccionado && individual.isError, pagina,
    setPagina: (valor: number) => setPosicion({ filtro: claveFiltro, pagina: valor }), actualizar }
}
