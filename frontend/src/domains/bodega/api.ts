import { supabase } from '../../lib/supabase'
import type { Perfil } from '../../types'
import type {
  DevolucionEnvase,
  DevolucionProducto,
  Despacho,
  DespachoDetalle,
  StockBodega,
  StockEnvases,
} from './types'

export interface NuevoDespacho {
  sucursal_id: string
  vendedor_id: string
  despachador_id: string
  creado_por: string
  lineas: { producto_id: string; cantidad: number }[]
}

export interface DevolucionProductosPayload {
  despacho_id: string
  creado_por: string
  lineas: { producto_id: string; cantidad: number }[]
}

export interface DevolucionEnvasesPayload {
  despacho_id: string
  creado_por: string
  lineas: { tipo_empaque_id: string; cantidad: number; estado: 'bueno' | 'malo' }[]
}

export async function obtenerVendedores(sucursalId?: string): Promise<Perfil[]> {
  if (!sucursalId) return []
  const { data } = await supabase
    .from('perfiles')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .eq('rol', 'vendedor')
    .eq('activo', true)
    .order('nombres')
    .returns<Perfil[]>()
  return data ?? []
}

export async function obtenerDespachos(sucursalId?: string): Promise<Despacho[]> {
  if (!sucursalId) return []
  const { data } = await supabase
    .from('despachos')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .order('creado_en', { ascending: false })
    .limit(20)
    .returns<Despacho[]>()
  return data ?? []
}

export async function obtenerDetallesDespacho(despachoIds: string[]): Promise<DespachoDetalle[]> {
  if (despachoIds.length === 0) return []
  const { data } = await supabase
    .from('despacho_detalles')
    .select('*')
    .in('despacho_id', despachoIds)
    .returns<DespachoDetalle[]>()
  return data ?? []
}

export async function obtenerDevolucionesProducto(despachoIds: string[]): Promise<DevolucionProducto[]> {
  if (despachoIds.length === 0) return []
  const { data } = await supabase
    .from('devoluciones_productos')
    .select('*')
    .in('despacho_id', despachoIds)
    .returns<DevolucionProducto[]>()
  return data ?? []
}

export async function obtenerDevolucionesEnvase(despachoIds: string[]): Promise<DevolucionEnvase[]> {
  if (despachoIds.length === 0) return []
  const { data } = await supabase
    .from('devoluciones_envases')
    .select('*')
    .in('despacho_id', despachoIds)
    .returns<DevolucionEnvase[]>()
  return data ?? []
}

export async function obtenerStockBodega(sucursalId: string): Promise<StockBodega[]> {
  const { data } = await supabase
    .from('stock_bodega')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .returns<StockBodega[]>()
  return data ?? []
}

export async function obtenerStockEnvases(sucursalId: string): Promise<StockEnvases[]> {
  const { data } = await supabase
    .from('stock_envases')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .returns<StockEnvases[]>()
  return data ?? []
}

export async function crearDespacho(payload: NuevoDespacho): Promise<{ error: string | null }> {
  const { data: despacho, error } = await supabase
    .from('despachos')
    .insert([
      {
        sucursal_id: payload.sucursal_id,
        vendedor_id: payload.vendedor_id,
        despachador_id: payload.despachador_id,
        creado_por: payload.creado_por,
      },
    ] as never[])
    .select('id')
    .returns<{ id: string }[]>()
    .single()

  if (error || !despacho) return { error: error?.message ?? 'Error al crear el despacho' }

  const { error: errDetalles } = await supabase
    .from('despacho_detalles')
    .insert(
      payload.lineas.map((l) => ({
        despacho_id: despacho.id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
      })) as never[],
    )

  if (errDetalles) {
    await supabase.from('despachos').delete().eq('id', despacho.id)
    return { error: errDetalles.message }
  }

  return { error: null }
}

export async function registrarDevolucionProductos(
  payload: DevolucionProductosPayload,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('devoluciones_productos')
    .insert(
      payload.lineas.map((l) => ({
        despacho_id: payload.despacho_id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        creado_por: payload.creado_por,
      })) as never[],
    )

  return { error: error?.message ?? null }
}

export async function registrarDevolucionEnvases(
  payload: DevolucionEnvasesPayload,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('devoluciones_envases')
    .insert(
      payload.lineas.map((l) => ({
        despacho_id: payload.despacho_id,
        tipo_empaque_id: l.tipo_empaque_id,
        cantidad: l.cantidad,
        estado: l.estado,
        creado_por: payload.creado_por,
      })) as never[],
    )

  return { error: error?.message ?? null }
}
