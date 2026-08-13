import { useQuery } from '@tanstack/react-query'
import { obtenerProductosVenta } from '../api'

export function useProductosVenta() {
  return useQuery({
    queryKey: ['ventas', 'productos'],
    queryFn: obtenerProductosVenta,
  })
}