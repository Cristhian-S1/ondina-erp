import { supabase } from './supabase'
import type { Producto, Sucursal, TipoEmpaque } from '../types'

export async function obtenerProductos(
  incluirInactivos = false,
): Promise<Producto[]> {
  let query = supabase.from('productos').select('*')
  if (!incluirInactivos) query = query.eq('activo', true)
  const { data, error } = await query.order('nombre').returns<Producto[]>()
  if (error) throw new Error('No fue posible cargar los productos. Inténtalo de nuevo.')
  return data ?? []
}

export async function obtenerTiposEmpaque(): Promise<TipoEmpaque[]> {
  const { data, error } = await supabase
    .from('tipos_empaque')
    .select('*')
    .eq('activo', true)
    .order('nombre')
    .returns<TipoEmpaque[]>()
  if (error) throw new Error('No fue posible cargar los tipos de empaque. Inténtalo de nuevo.')
  return data ?? []
}

export async function obtenerSucursales(): Promise<Sucursal[]> {
  const { data, error } = await supabase
    .from('sucursales')
    .select('*')
    .eq('activa', true)
    .order('nombre')
    .returns<Sucursal[]>()
  if (error) throw new Error('No fue posible cargar las sucursales. Inténtalo de nuevo.')
  return data ?? []
}
