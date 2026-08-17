import { useEffect, useState } from 'react'

export type ToastTipo = 'exito' | 'error'

export interface ToastState {
  mensaje: string
  tipo: ToastTipo
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  function mostrar(mensaje: string, tipo: ToastTipo = 'exito') {
    setToast({ mensaje, tipo })
  }

  function cerrar() {
    setToast(null)
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  return { toast, mostrar, cerrar }
}
