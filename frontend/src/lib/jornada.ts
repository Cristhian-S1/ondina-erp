import { useSyncExternalStore } from 'react'

const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function fechaSantiago(fecha: Date): string {
  return formatoDia.format(fecha)
}

function jornadaActual() {
  return fechaSantiago(new Date())
}

function suscribir(onChange: () => void) {
  const reloj = window.setInterval(onChange, 1000)
  window.addEventListener('focus', onChange)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    window.clearInterval(reloj)
    window.removeEventListener('focus', onChange)
    document.removeEventListener('visibilitychange', onChange)
  }
}

export function useJornadaSantiago() {
  return useSyncExternalStore(suscribir, jornadaActual)
}

export function inicioPeriodo(jornada: string, dias: number): string {
  const fecha = new Date(`${jornada}T12:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() - dias)
  return fecha.toISOString().slice(0, 10)
}
