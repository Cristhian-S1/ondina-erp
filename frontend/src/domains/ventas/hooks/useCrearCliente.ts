import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { crearCliente, type CrearClientePayload } from '../api'
import type { CrearClienteInput } from '../schemas'

export function useCrearCliente() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CrearClienteInput) => {
      if (!perfil) throw new Error('No hay sesión activa')
      if (!perfil.sucursal_id) throw new Error('Tu usuario no tiene sucursal asignada')
      const payload: CrearClientePayload = {
        nombre: input.nombre,
        direccion: input.direccion,
        telefono: input.telefono || null,
        numero_local: input.numero_local || null,
        tipo: input.tipo,
        vendedor_id: input.vendedor_id,
        sucursal_id: perfil.sucursal_id,
        creado_por: perfil.id,
      }
      return crearCliente(payload)
    },
    onSuccess: (res) => {
      if (res.error) return
      void queryClient.invalidateQueries({ queryKey: ['ventas', 'clientes'] })
    },
  })
}