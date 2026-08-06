// Servicios de Supabase del módulo de ventas. Único punto que importa el
// cliente compartido: los hooks consumen estas funciones, no al cliente directo.

import { supabase } from '../../lib/supabase'
import type { Json } from '../../types/database-generated.types'
import type { Perfil } from '../../types'
import type {
  BidonesVacios,
  CargaVendedor,
  ClienteCartera,
  GastoExtra,
  ProductoVenta,
  RegistrarVentaArgs,
} from './types'

// --- HU-04: clientes de la ruta ---
export async function obtenerClientesRuta(perfil: Perfil): Promise<ClienteCartera[]> {
  const { data } = await supabase
    .from('clientes')
    .select(
      'id, nombre, telefono, direccion, numero_local, tipo, activo, creado_en',
    )
    .eq('vendedor_id', perfil.id)
    .eq('activo', true)
    .order('nombre', { ascending: true })
    .returns<ClienteCartera[]>()
  return data ?? []
}

// --- HU-02: crear cliente ---
export interface CrearClientePayload {
  nombre: string
  direccion: string
  telefono: string | null
  numero_local: string | null
  tipo: string
  vendedor_id: string
  sucursal_id: string
  creado_por: string
}

export async function crearCliente(
  payload: CrearClientePayload,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('clientes').insert({
    nombre: payload.nombre,
    direccion: payload.direccion,
    telefono: payload.telefono || null,
    numero_local: payload.numero_local || null,
    tipo: payload.tipo,
    vendedor_id: payload.vendedor_id,
    sucursal_id: payload.sucursal_id,
    creado_por: payload.creado_por,
    activo: true,
  })
  return { error: error?.message ?? null }
}

// Vendedores activos de la sucursal (para admin en HU-02).
export async function obtenerVendedoresSucursal(
  sucursalId?: string,
): Promise<Pick<Perfil, 'id' | 'nombres' | 'apellidos'>[]> {
  if (!sucursalId) return []
  const { data } = await supabase
    .from('perfiles')
    .select('id, nombres, apellidos')
    .eq('sucursal_id', sucursalId)
    .eq('rol', 'vendedor')
    .eq('activo', true)
    .order('nombres')
    .returns<Pick<Perfil, 'id' | 'nombres' | 'apellidos'>[]>()
  return data ?? []
}

// --- HU-01: productos para el formulario de venta ---
export async function obtenerProductosVenta(): Promise<ProductoVenta[]> {
  const { data } = await supabase
    .from('productos')
    .select(
      'id, nombre, tipo, tipo_empaque_id, precio_base, activo, creado_en, tipos_empaque(id, nombre, categoria)',
    )
    .eq('activo', true)
    .order('nombre')
    .returns<ProductoVenta[]>()
  return data ?? []
}

// --- HU-03: carga del vendedor ---
export async function obtenerCargaVendedor(perfil: Perfil): Promise<CargaVendedor[]> {
  const { data } = await supabase
    .from('carga_vendedor')
    .select(
      'producto_id, vendedor_id, cantidad, modificado_en, productos(id, nombre, tipo, precio_base)',
    )
    .eq('vendedor_id', perfil.id)
    .returns<CargaVendedor[]>()
  return data ?? []
}

// --- HU-05: bidones vacíos hoy ---
export function hoyLocalISO(): string {
  // YYYY-MM-DD en zona horaria local.
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export async function obtenerBidonesVacios(perfil: Perfil): Promise<BidonesVacios[]> {
  const { data } = await supabase
    .from('v_bidones_vacios_vendedor')
    .select('vendedor_id, fecha, tipo_empaque_id, empaque_nombre, cantidad')
    .eq('vendedor_id', perfil.id)
    .eq('fecha', hoyLocalISO())
    .returns<BidonesVacios[]>()
  return data ?? []
}

// --- HU-07: gastos del día ---
export async function obtenerGastosHoy(perfil: Perfil): Promise<GastoExtra[]> {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 1)

  const { data } = await supabase
    .from('gastos_extras')
    .select('id, tipo, monto, motivo, creado_en, anulado, vendedor_id, sucursal_id')
    .eq('vendedor_id', perfil.id)
    .gte('creado_en', inicio.toISOString())
    .lt('creado_en', fin.toISOString())
    .order('creado_en', { ascending: false })
    .returns<GastoExtra[]>()
  return data ?? []
}

export interface CrearGastoPayload {
  tipo: string
  monto: number
  motivo: string
  vendedor_id: string
  sucursal_id: string
  creado_por: string
}

export async function crearGasto(
  payload: CrearGastoPayload,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('gastos_extras').insert({
    tipo: payload.tipo,
    monto: payload.monto,
    motivo: payload.motivo,
    vendedor_id: payload.vendedor_id,
    sucursal_id: payload.sucursal_id,
    creado_por: payload.creado_por,
    anulado: false,
    comprobante_url: null,
  })
  return { error: error?.message ?? null }
}

// --- HU-01: RPC registrar_venta ---
function traducirErrorRegistarVenta(msg: string): string {
  if (/Cliente inexistente o fuera de su cartera\/sucursal/i.test(msg))
    return 'El cliente no pertenece a tu cartera o sucursal.'
  if (/Método de pago inválido/i.test(msg))
    return 'El método de pago no es válido.'
  if (/La venta debe incluir al menos un detalle/i.test(msg))
    return 'Debes agregar al menos un producto a la venta.'
  if (/El vendedor no tiene carga del producto|Carga insuficiente del vendedor para el producto/i.test(
    msg,
  ))
    return 'No tienes carga suficiente de uno de los productos.'
  return msg
}

export async function registrarVenta(
  args: RegistrarVentaArgs,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_cliente_id: args.p_cliente_id,
    p_metodo_pago: args.p_metodo_pago,
    p_detalles: args.p_detalles as unknown as Json,
    p_descuento: args.p_descuento,
    p_observaciones: args.p_observaciones,
  })

  if (error) {
    return { id: null, error: traducirErrorRegistarVenta(error.message) }
  }
  return { id: (data as string | null) ?? null, error: null }
}