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
  idempotency_key: string
  sucursal_id: string
  vendedor_id: string
  despachador_id: string
  creado_por: string
  lineas: { producto_id: string; cantidad: number }[]
  envases: { tipo_empaque_id: string; cantidad: number }[]
}

export interface DevolucionProductosPayload {
  idempotency_key: string
  despacho_id: string
  creado_por: string
  lineas: { producto_id: string; cantidad: number }[]
}

export interface DevolucionEnvasesPayload {
  idempotency_key: string
  despacho_id: string
  creado_por: string
  lineas: { tipo_empaque_id: string; cantidad: number; estado: 'bueno' | 'malo' }[]
}

export interface CorregirDevolucionPayload {
  idempotency_key: string
  despacho_id: string
  creado_por: string
  motivo?: string
  lineas_producto: { producto_id: string; cantidad: number }[]
  lineas_envase: { tipo_empaque_id: string; cantidad: number; estado: 'bueno' | 'malo' }[]
}

// Solo nombre e identificador: bodega no lee perfiles de vendedores (RB-15).
export type VendedorSucursal = Pick<Perfil, 'id' | 'nombres' | 'apellidos'>

export async function obtenerVendedores(sucursalId?: string): Promise<VendedorSucursal[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase.rpc('vendedores_sucursal', { p_sucursal_id: sucursalId })
    if (error) throw new Error('No fue posible cargar los vendedores. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerDespachos(sucursalId?: string): Promise<Despacho[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase
      .from('despachos')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('creado_en', { ascending: false })
      .returns<Despacho[]>()
    if (error) throw new Error('No fue posible cargar los despachos. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerDetallesDespacho(despachoIds: string[]): Promise<DespachoDetalle[]> {
  try {
    if (despachoIds.length === 0) return []
    const { data, error } = await supabase
      .from('despacho_detalles')
      .select('*')
      .in('despacho_id', despachoIds)
      .returns<DespachoDetalle[]>()
    if (error) throw new Error('No fue posible cargar los detalles del despacho. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerEnvasesDespacho(despachoIds: string[]): Promise<DespachoEnvase[]> {
  try {
    if (despachoIds.length === 0) return []
    const { data, error } = await supabase
      .from('despacho_envases')
      .select('*')
      .in('despacho_id', despachoIds)
      .returns<DespachoEnvase[]>()
    if (error) throw new Error('No fue posible cargar los envases del despacho. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerDevolucionesProducto(despachoIds: string[]): Promise<DevolucionProducto[]> {
  try {
    if (despachoIds.length === 0) return []
    const { data, error } = await supabase
      .from('devoluciones_productos')
      .select('*')
      .in('despacho_id', despachoIds)
      .eq('anulado', false)
      .returns<DevolucionProducto[]>()
    if (error) throw new Error('No fue posible cargar las devoluciones de productos. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerDevolucionesEnvase(despachoIds: string[]): Promise<DevolucionEnvase[]> {
  try {
    if (despachoIds.length === 0) return []
    const { data, error } = await supabase
      .from('devoluciones_envases')
      .select('*')
      .in('despacho_id', despachoIds)
      .eq('anulado', false)
      .returns<DevolucionEnvase[]>()
    if (error) throw new Error('No fue posible cargar las devoluciones de envases. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerStockBodega(sucursalId: string): Promise<StockBodega[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase
      .from('stock_bodega')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .returns<StockBodega[]>()
    if (error) throw new Error('No fue posible cargar el stock de productos. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerStockEnvases(sucursalId: string): Promise<StockEnvases[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase
      .from('stock_envases')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .returns<StockEnvases[]>()
    if (error) throw new Error('No fue posible cargar el stock de envases. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerCargaVendedores(vendedorIds: string[]): Promise<CargaVendedor[]> {
  try {
    if (vendedorIds.length === 0) return []
    const { data, error } = await supabase
      .from('carga_vendedor')
      .select('*')
      .in('vendedor_id', vendedorIds)
      .returns<CargaVendedor[]>()
    if (error) throw new Error('No fue posible cargar la carga de los vendedores. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function crearDespacho(payload: NuevoDespacho): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('crear_despacho', {
      p_sucursal_id: payload.sucursal_id,
      p_vendedor_id: payload.vendedor_id,
      p_despachador_id: payload.despachador_id,
      p_creado_por: payload.creado_por,
      p_lineas: payload.lineas,
      p_envases: payload.envases,
      p_idempotency_key: payload.idempotency_key,
    })

    return { error: error ? mensajeErrorSupabase(error) : null }
  } catch (error: unknown) {
    return { error: mensajeErrorSupabase(error) }
  }
}

export async function registrarDevolucionProductos(
  payload: DevolucionProductosPayload,
): Promise<{ error: string | null }> {
  return registrarDevolucion({
    despacho_id: payload.despacho_id,
    creado_por: payload.creado_por,
    lineas_producto: payload.lineas,
    lineas_envase: [],
    idempotency_key: payload.idempotency_key,
  })
}

export async function corregirDevolucion(
  payload: CorregirDevolucionPayload,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('corregir_devolucion', {
      p_despacho_id: payload.despacho_id,
      p_creado_por: payload.creado_por,
      p_productos: payload.lineas_producto,
      p_envases: payload.lineas_envase,
      p_motivo: payload.motivo,
      p_idempotency_key: payload.idempotency_key,
    })

    return { error: error ? mensajeErrorSupabase(error) : null }
  } catch (error: unknown) {
    return { error: mensajeErrorSupabase(error) }
  }
}

export async function registrarDevolucionEnvases(
  payload: DevolucionEnvasesPayload,
): Promise<{ error: string | null }> {
  return registrarDevolucion({
    despacho_id: payload.despacho_id,
    creado_por: payload.creado_por,
    lineas_envase: payload.lineas,
    lineas_producto: [],
    idempotency_key: payload.idempotency_key,
  })
}

export async function registrarDevolucion(
  payload: Omit<CorregirDevolucionPayload, 'motivo'>,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('registrar_devolucion', {
      p_despacho_id: payload.despacho_id,
      p_productos: payload.lineas_producto,
      p_envases: payload.lineas_envase,
      p_idempotency_key: payload.idempotency_key,
    })
    return { error: error ? mensajeErrorSupabase(error) : null }
  } catch (error: unknown) {
    return { error: mensajeErrorSupabase(error) }
  }
}
