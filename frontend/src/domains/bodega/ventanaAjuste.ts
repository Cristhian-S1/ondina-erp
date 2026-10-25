// HU-26: la ventana real vive en `configuracion.ventana_ajuste_minutos` y la aplica la base con el
// reloj del servidor. Bodega no puede leer `configuracion`, así que la interfaz la pide a la RPC
// `ventana_ajuste_despacho` (minutos + hora del servidor). Si no responde, usa el valor por defecto con
// el reloj del dispositivo como pista aproximada; tras un ajuste manda el `ventana_expira_en` de la RPC.
export const VENTANA_AJUSTE_MINUTOS_REFERENCIA = 15

export interface VentanaServidor {
  minutos: number
  // Hora del servidor menos hora del dispositivo al recibir la respuesta.
  desfaseMs: number
}

export function ventanaDesdeServidor(
  respuesta: { minutos: number; servidorAhora: string },
  ahoraDispositivo: number,
): VentanaServidor | null {
  const servidor = Date.parse(respuesta.servidorAhora)
  if (!Number.isFinite(servidor) || !Number.isFinite(respuesta.minutos) || respuesta.minutos <= 0) return null
  return { minutos: respuesta.minutos, desfaseMs: servidor - ahoraDispositivo }
}

export function expiraVentana(creadoEn: string, expiraConocido?: string, ventana?: VentanaServidor | null): number {
  if (expiraConocido) {
    const conocido = Date.parse(expiraConocido)
    if (Number.isFinite(conocido)) return conocido
  }
  return Date.parse(creadoEn) + (ventana?.minutos ?? VENTANA_AJUSTE_MINUTOS_REFERENCIA) * 60_000
}

// `ahora` es la hora del dispositivo; el desfase la lleva al reloj del servidor.
export function milisegundosRestantes(creadoEn: string, ahora: number, expiraConocido?: string, ventana?: VentanaServidor | null): number {
  const restante = expiraVentana(creadoEn, expiraConocido, ventana) - (ahora + (ventana?.desfaseMs ?? 0))
  return Number.isFinite(restante) ? Math.max(0, restante) : 0
}

// Texto de la pista: con respuesta de la RPC indica los minutos configurados; sin ella, es aproximada.
export function origenVentana(ventana: VentanaServidor | null | undefined, expiraConocido?: string): string {
  if (ventana) return ` (ventana de ${ventana.minutos} min)`
  return expiraConocido ? '' : ' (aprox.)'
}

export function formatearRestante(milisegundos: number): string {
  const segundos = Math.ceil(milisegundos / 1000)
  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60
  return minutos > 0 ? `${minutos} min ${String(resto).padStart(2, '0')} s` : `${resto} s`
}
