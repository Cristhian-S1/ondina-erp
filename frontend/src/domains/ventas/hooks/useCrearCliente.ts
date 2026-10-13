import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { crearCliente, obtenerVendedoresSucursal, type CrearClientePayload } from '../api'
import type { CrearClienteInput } from '../schemas'

export function useCrearCliente(sucursalSeleccionada?: string) {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CrearClienteInput) => {
      if (!perfil) throw new Error('No hay sesión activa')
      const esAdmin = perfil.rol === 'administrador'
      const sucursalId = esAdmin ? sucursalSeleccionada : perfil.sucursal_id
      if (!sucursalId) throw new Error(esAdmin ? 'Selecciona una sucursal para registrar el cliente' : 'Tu usuario no tiene sucursal asignada')
      if (esAdmin) {
        const vendedores = await obtenerVendedoresSucursal(sucursalId)
        if (!vendedores.some((vendedor) => vendedor.id === input.vendedor_id)) {
          throw new Error('Selecciona un vendedor activo de la sucursal elegida')
        }
      }
      const payload: CrearClientePayload = {
        nombre: input.nombre,
        direccion: input.direccion,
        telefono: input.telefono || null,
        numero_local: input.numero_local || null,
        tipo: input.tipo,
        vendedor_id: esAdmin ? input.vendedor_id : perfil.id,
        sucursal_id: sucursalId,
        creado_por: perfil.id,
      }
      const result = await crearCliente(payload)
      return { ...result, payload }
    },
    onSuccess: (res) => {
      if (res.error) return
      void queryClient.invalidateQueries({ queryKey: ['ventas', 'clientes', res.payload.creado_por, res.payload.sucursal_id, res.payload.vendedor_id] })
    },
  })
}