import { useState, useSyncExternalStore } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { jornadaGastos, obtenerPaginaGastos, obtenerTotalGastosHoy } from '../api'

function suscribir(callback: () => void) {
  const reloj = window.setInterval(callback, 1000)
  window.addEventListener('focus', callback)
  document.addEventListener('visibilitychange', callback)
  return () => {
    window.clearInterval(reloj)
    window.removeEventListener('focus', callback)
    document.removeEventListener('visibilitychange', callback)
  }
}

export function useGastosHoy() {
  const { perfil } = useAuth()
  const jornada = useSyncExternalStore(suscribir, jornadaGastos)
  const scope = ['ventas', 'gastos', 'hoy', perfil?.id, perfil?.rol, perfil?.sucursal_id, jornada]
  const ambito = JSON.stringify(scope)
  const [estado, setEstado] = useState({ ambito, pagina: 1 })
  if (estado.ambito !== ambito) setEstado({ ambito, pagina: 1 })
  const pagina = estado.ambito === ambito ? estado.pagina : 1
  const query = useQuery({
    queryKey: [...scope, 'lista', pagina],
    queryFn: () => obtenerPaginaGastos(perfil!, jornada, pagina),
    enabled: !!perfil?.sucursal_id,
    retry: false,
    placeholderData: (prev, query) => JSON.stringify(query?.queryKey.slice(0, -1)) === JSON.stringify([...scope, 'lista']) ? keepPreviousData(prev) : undefined,
  })
  const total = useQuery({ queryKey: [...scope, 'total'], queryFn: () => obtenerTotalGastosHoy(perfil!, jornada), enabled: !!perfil?.sucursal_id, retry: false })
  return { ...query, data: query.data?.filas, totalRegistros: query.data?.total ?? 0,
    totalHoy: total.data, errorTotal: total.error, cargandoTotal: total.isPending,
    pagina, setPagina: (pagina: number) => setEstado({ ambito, pagina }),
    refetch: () => Promise.all([query.refetch(), total.refetch()]) }
}
