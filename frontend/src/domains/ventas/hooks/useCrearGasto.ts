import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { crearGasto, type CrearGastoPayload } from '../api'
import type { CrearGastoInput } from '../schemas'

export function useCrearGasto() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CrearGastoInput) => {
      if (!perfil) throw new Error('No hay sesión activa')
      if (!perfil.sucursal_id) throw new Error('Tu usuario no tiene sucursal asignada')
      const payload: CrearGastoPayload = {
        tipo: input.tipo,
        monto: input.monto,
        motivo: input.motivo,
        vendedor_id: perfil.id,
        sucursal_id: perfil.sucursal_id,
        creado_por: perfil.id,
      }
      return crearGasto(payload)
    },
    onSuccess: (res) => {
      if (res.error) return
      void queryClient.invalidateQueries({ queryKey: ['ventas', 'gastos'] })
    },
  })
}