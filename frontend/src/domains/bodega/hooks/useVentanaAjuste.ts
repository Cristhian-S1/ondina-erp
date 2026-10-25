import { useEffect, useState } from 'react'
import { milisegundosRestantes } from '../ventanaAjuste'
import { useVentanaServidor } from './useVentanaServidor'

// Pista de la ventana de ajuste (HU-26): se recalcula cada segundo y se detiene al cerrarse. Usa los minutos
// y el reloj del servidor cuando la RPC respondió; la decisión real la toma la base al guardar.
export function useVentanaAjuste(creadoEn: string, expiraConocido?: string) {
  const ventana = useVentanaServidor().data ?? null
  const [ahora, setAhora] = useState(() => Date.now())
  const restanteMs = milisegundosRestantes(creadoEn, ahora, expiraConocido, ventana)
  const abierta = restanteMs > 0
  useEffect(() => {
    if (!abierta) return
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(reloj)
  }, [abierta, creadoEn, expiraConocido])
  return { restanteMs, abierta, ventana }
}
