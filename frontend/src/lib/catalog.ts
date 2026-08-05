import { supabase } from './supabase'
import type { Producto, Sucursal, TipoEmpaque } from '../types'

export async function obtenerProductos(): Promise<Producto[]> {
  const { data } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('nombre')
    .returns<Producto[]>()
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
