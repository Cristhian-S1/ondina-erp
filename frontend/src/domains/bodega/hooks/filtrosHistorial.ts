import { fechaSantiago, inicioPeriodo } from '../../../lib/jornada'

// First instant of a Santiago civil day; handles midnight DST gaps too.
export function inicioDiaSantiago(dia: string): string {
  const mediodia = new Date(`${dia}T12:00:00Z`).getTime()
  let desde = mediodia - 36 * 3600_000
  let hasta = mediodia + 36 * 3600_000
  while (desde < hasta) {
    const medio = Math.floor((desde + hasta) / 2)
    if (fechaSantiago(new Date(medio)) < dia) desde = medio + 1
    else hasta = medio
  }
  return new Date(desde).toISOString()
}

export function filtrosHistorial(jornada: string, dia: string, fecha: string, vendedorId: string) {
  if (dia === 'todo') return { vendedorId }
  const objetivo = dia === 'fecha' ? fecha : inicioPeriodo(jornada, dia === 'ayer' ? 1 : dia === '7d' ? 6 : 0)
  return { vendedorId, desde: inicioDiaSantiago(objetivo || jornada),
    hasta: dia === '7d' ? undefined : inicioDiaSantiago(inicioPeriodo(objetivo || jornada, -1)) }
}
