// HU-26: la ventana real vive en `configuracion.ventana_ajuste_minutos` y la aplica la base con el
// reloj del servidor. Bodega no puede leer `configuracion` (RLS solo para administración), así que la
// interfaz usa el valor por defecto como pista y, tras un ajuste, el `ventana_expira_en` de la RPC.
export const VENTANA_AJUSTE_MINUTOS_REFERENCIA = 15

export function expiraVentana(creadoEn: string, expiraConocido?: string): number {
  if (expiraConocido) {
    const conocido = Date.parse(expiraConocido)
    if (Number.isFinite(conocido)) return conocido
  }
  return Date.parse(creadoEn) + VENTANA_AJUSTE_MINUTOS_REFERENCIA * 60_000
}

export function milisegundosRestantes(creadoEn: string, ahora: number, expiraConocido?: string): number {
  const restante = expiraVentana(creadoEn, expiraConocido) - ahora
  return Number.isFinite(restante) ? Math.max(0, restante) : 0
}

export function formatearRestante(milisegundos: number): string {
  const segundos = Math.ceil(milisegundos / 1000)
  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60
  return minutos > 0 ? `${minutos} min ${String(resto).padStart(2, '0')} s` : `${resto} s`
}
