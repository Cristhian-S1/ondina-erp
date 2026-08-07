import { supabase } from '../../lib/supabase'
import { mensajeErrorSupabase } from '../../lib/errors'
import type { Perfil } from '../../types'
import type {
  CargaVendedor,
  Despacho,
  DespachoDetalle,
  DespachoEnvase,
  DevolucionEnvase,
  DevolucionProducto,
  StockBodega,
  StockEnvases,
} from './types'

export interface NuevoDespacho {
  sucursal_id: string
  vendedor_id: string
  despachador_id: string
  creado_por: string
  lineas: { producto_id: string; cantidad: number }[]
  envases: { tipo_empaque_id: string; cantidad: number }[]
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

export interface CorregirDevolucionPayload {
  despacho_id: string
  creado_por: string
  lineas_producto: { producto_id: string; cantidad: number }[]
  lineas_envase: { tipo_empaque_id: string; cantidad: number; estado: 'bueno' | 'malo' }[]
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

export async function obtenerEnvasesDespacho(despachoIds: string[]): Promise<DespachoEnvase[]> {
  if (despachoIds.length === 0) return []
  const { data } = await supabase
    .from('despacho_envases')
    .select('*')
    .in('despacho_id', despachoIds)
    .returns<DespachoEnvase[]>()
  return data ?? []
}

export async function obtenerDevolucionesProducto(despachoIds: string[]): Promise<DevolucionProducto[]> {
  if (despachoIds.length === 0) return []
  const { data } = await supabase
    .from('devoluciones_productos')
    .select('*')
    .in('despacho_id', despachoIds)
    .eq('anulado', false)
    .returns<DevolucionProducto[]>()
  return data ?? []
}

export async function obtenerDevolucionesEnvase(despachoIds: string[]): Promise<DevolucionEnvase[]> {
  if (despachoIds.length === 0) return []
  const { data } = await supabase
    .from('devoluciones_envases')
    .select('*')
    .in('despacho_id', despachoIds)
    .eq('anulado', false)
    .returns<DevolucionEnvase[]>()
  return data ?? []
}

export async function obtenerStockBodega(sucursalId: string): Promise<StockBodega[]> {
  if (!sucursalId) return []
  const { data } = await supabase
    .from('stock_bodega')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .returns<StockBodega[]>()
  return data ?? []
}

export async function obtenerStockEnvases(sucursalId: string): Promise<StockEnvases[]> {
  if (!sucursalId) return []
  const { data } = await supabase
    .from('stock_envases')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .returns<StockEnvases[]>()
  return data ?? []
}

export async function obtenerCargaVendedores(vendedorIds: string[]): Promise<CargaVendedor[]> {
  if (vendedorIds.length === 0) return []
  const { data } = await supabase
    .from('carga_vendedor')
    .select('*')
    .in('vendedor_id', vendedorIds)
    .returns<CargaVendedor[]>()
  return data ?? []
}

export async function crearDespacho(payload: NuevoDespacho): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('crear_despacho', {
    p_sucursal_id: payload.sucursal_id,
    p_vendedor_id: payload.vendedor_id,
    p_despachador_id: payload.despachador_id,
    p_creado_por: payload.creado_por,
    p_lineas: payload.lineas,
    p_envases: payload.envases,
  } as never)

  return { error: error ? mensajeErrorSupabase(error) : null }
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

  return { error: error ? mensajeErrorSupabase(error) : null }
}

export async function corregirDevolucion(
  payload: CorregirDevolucionPayload,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('corregir_devolucion', {
    p_despacho_id: payload.despacho_id,
    p_creado_por: payload.creado_por,
    p_productos: payload.lineas_producto,
    p_envases: payload.lineas_envase,
  } as never)

  return { error: error ? mensajeErrorSupabase(error) : null }
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

  return { error: error ? mensajeErrorSupabase(error) : null }
}
