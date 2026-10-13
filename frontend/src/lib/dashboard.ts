import { supabase } from './supabase'
import type { Sucursal } from '../types'

export async function obtenerSucursalDashboard(sucursalId: string): Promise<Sucursal | null> {
  try {
    const { data, error } = await supabase.from('sucursales').select('*').eq('id', sucursalId).single()
    if (error) throw error
    return data
  } catch (error) {
    throw new Error('No fue posible cargar la sucursal. Inténtalo de nuevo.', { cause: error })
  }
}
