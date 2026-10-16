import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { UseFormGetValues, UseFormSubscribe } from 'react-hook-form'
import type { RegistrarVentaFormInput } from '../schemas'

export default function PersistenciaBorradorVenta({ storageKey, identidad, activo, subscribe, getValues }: {
  storageKey: string | null
  identidad: RefObject<string | undefined>
  activo: RefObject<boolean>
  subscribe: UseFormSubscribe<RegistrarVentaFormInput>
  getValues: UseFormGetValues<RegistrarVentaFormInput>
}) {
  useEffect(() => {
    if (!storageKey) return
    const perfilId = identidad.current
    let pendiente = false
    let timer: ReturnType<typeof setTimeout> | undefined
    function flush() {
      clearTimeout(timer)
      if (!pendiente || !activo.current || identidad.current !== perfilId) return
      pendiente = false
      try { sessionStorage.setItem(storageKey!, JSON.stringify(getValues())) } catch { /* El formulario sigue disponible si el navegador bloquea almacenamiento. */ }
    }
    const unsubscribe = subscribe({ formState: { values: true }, callback: () => {
      pendiente = true
      clearTimeout(timer)
      timer = setTimeout(flush, 250)
    } })
    const alOcultar = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', alOcultar)
    return () => {
      unsubscribe()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', alOcultar)
      flush()
    }
  }, [storageKey, identidad, activo, subscribe, getValues])
  return null
}
