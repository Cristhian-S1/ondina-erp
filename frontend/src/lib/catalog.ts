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

// `incluirInactivos` sirve a las vistas de sólo lectura (p. ej. Stock): un tipo desactivado puede conservar
// existencias y su nombre debe resolverse (N-01). Los formularios siguen usando sólo activos.
export async function obtenerTiposEmpaque(incluirInactivos = false): Promise<TipoEmpaque[]> {
  let query = supabase.from('tipos_empaque').select('*')
  if (!incluirInactivos) query = query.eq('activo', true)
  const { data, error } = await query
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
