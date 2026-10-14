import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { registrarVenta } from '../api'
import type { RegistrarVentaForm } from '../schemas'
import type { DetalleVentaInput } from '../types'

function aArgs(form: RegistrarVentaForm): {
  p_cliente_id: string
  p_metodo_pago: RegistrarVentaForm['metodoPago']
  p_detalles: DetalleVentaInput[]
  p_descuento: number
  p_observaciones: string | undefined
} {
  return {
    p_cliente_id: form.clienteId,
    p_metodo_pago: form.metodoPago,
    p_detalles: form.detalles.map((d) => ({
      producto_id: d.productoId,
      cantidad: d.cantidad,
      precio_unitario: d.precioUnitario,
      envases_recibidos: 0,
    })),
    p_descuento: form.descuento,
    p_observaciones: form.observaciones ? form.observaciones : undefined,
  }
}

export function useRegistrarVenta() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const intento = useRef<{ contenido: string; clave: string } | null>(null)

  return useMutation({
    mutationFn: (form: RegistrarVentaForm) => {
      if (!perfil) throw new Error('No hay sesión activa')
      const args = aArgs(form)
      const contenido = JSON.stringify([perfil.id, args])
      if (intento.current?.contenido !== contenido) {
        intento.current = { contenido, clave: crypto.randomUUID() }
      }
      return registrarVenta({ ...args, p_idempotency_key: intento.current.clave })
    },
    onSuccess: (res, form) => {
      if (res.error) return
      if (intento.current?.contenido === JSON.stringify([perfil?.id, aArgs(form)])) {
        intento.current = null
      }
      void queryClient.invalidateQueries({ queryKey: ['ventas', 'carga'] })
      void queryClient.invalidateQueries({ queryKey: ['ventas', 'historico'] })
      void queryClient.invalidateQueries({ queryKey: ['ventas', 'ranking'] })
      void queryClient.invalidateQueries({ queryKey: ['mi-comision'] })
    },
  })
}