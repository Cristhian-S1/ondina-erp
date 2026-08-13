import { supabase } from './supabase'
import type { Producto, Sucursal, TipoEmpaque } from '../types'

export async function obtenerProductos(
  incluirInactivos = false,
): Promise<Producto[]> {
  let query = supabase.from('productos').select('*')
  if (!incluirInactivos) query = query.eq('activo', true)
  const { data } = await query.order('nombre').returns<Producto[]>()
  return data ?? []
}

export async function obtenerTiposEmpaque(): Promise<TipoEmpaque[]> {
  const { data } = await supabase
    .from('tipos_empaque')
    .select('*')
    .eq('activo', true)
    .order('nombre')
    .returns<TipoEmpaque[]>()
  return data ?? []
}

export async function obtenerSucursales(): Promise<Sucursal[]> {
  const { data } = await supabase
    .from('sucursales')
    .select('*')
    .eq('activa', true)
    .order('nombre')
    .returns<Sucursal[]>()
  return data ?? []
}
