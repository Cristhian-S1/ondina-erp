import { useEffect, useState } from 'react'
import { milisegundosRestantes } from '../ventanaAjuste'

// Pista de la ventana de ajuste (HU-26): se recalcula cada segundo y se detiene al cerrarse.
// La decisión real la toma la base con el reloj del servidor.
export function useVentanaAjuste(creadoEn: string, expiraConocido?: string) {
  const [ahora, setAhora] = useState(() => Date.now())
  const restanteMs = milisegundosRestantes(creadoEn, ahora, expiraConocido)
  const abierta = restanteMs > 0
  useEffect(() => {
    if (!abierta) return
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(reloj)
  }, [abierta, creadoEn, expiraConocido])
  return { restanteMs, abierta }
}
