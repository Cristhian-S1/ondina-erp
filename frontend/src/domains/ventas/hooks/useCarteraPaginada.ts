import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerPaginaClientes } from '../api'

export function useCarteraPaginada(sucursalSeleccionada?: string, vendedorSeleccionado?: string) {
  const { perfil } = useAuth()
  const admin = perfil?.rol === 'administrador'
  const sucursalId = admin ? sucursalSeleccionada : perfil?.sucursal_id
  const vendedorId = admin ? vendedorSeleccionado : perfil?.id
  const scope = ['ventas', 'clientes', perfil?.id, sucursalId, vendedorId, 'cartera', perfil?.rol]
  const ambito = JSON.stringify(scope)
  const [estado, setEstado] = useState({ ambito, pagina: 1 })
  if (estado.ambito !== ambito) setEstado({ ambito, pagina: 1 })
  const pagina = estado.ambito === ambito ? estado.pagina : 1
  const query = useQuery({
    queryKey: [...scope, pagina],
    queryFn: () => obtenerPaginaClientes(perfil!, sucursalId ?? undefined, vendedorId, pagina),
    enabled: !!perfil && !!sucursalId && !!vendedorId,
    retry: false,
    placeholderData: (prev, query) => JSON.stringify(query?.queryKey.slice(0, -1)) === ambito ? keepPreviousData(prev) : undefined,
  })
  return { ...query, data: query.data?.filas, total: query.data?.total ?? 0, pagina,
    setPagina: (pagina: number) => setEstado({ ambito, pagina }) }
}
