import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerRankingVendedores } from '../api'

const ZONA = 'America/Santiago'

/** Mes calendario actual (AAAA-MM) en America/Santiago; no depende de UTC. */
export function mesActualSantiago(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(ahora)
  const anio = partes.find((p) => p.type === 'year')?.value
  const mes = partes.find((p) => p.type === 'month')?.value
  return `${anio}-${mes}`
}

/** Ranking del mes `AAAA-MM`; la clave incluye el ámbito (usuario, sucursal y rol) para no mezclar cachés. */
export function useRankingVendedores(mes: string) {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['ventas', 'ranking', mes, perfil?.id, perfil?.sucursal_id, perfil?.rol],
    queryFn: () => obtenerRankingVendedores(mes),
    enabled: !!perfil,
  })
}
