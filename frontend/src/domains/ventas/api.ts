import { rangoPagina } from '../../lib/paginacion'
import type { Pagina } from '../../lib/paginacion'
// Servicios de Supabase del módulo de ventas. Único punto que importa el
// cliente compartido: los hooks consumen estas funciones, no al cliente directo.

import { supabase } from '../../lib/supabase'
import { mensajeErrorSupabase } from '../../lib/errors'
import type { Json } from '../../types/database-generated.types'
import type { Perfil } from '../../types'
import type {
  CargaVendedor,
  ClienteCartera,
  GastoExtra,
  ProductoVenta,
  RegistrarVentaArgs,
} from './types'

// --- HU-04: clientes de la ruta ---
export async function obtenerClientesRuta(perfil: Perfil, sucursalSeleccionada?: string, vendedorSeleccionado?: string): Promise<ClienteCartera[]> {
  try {
    const esAdmin = perfil.rol === 'administrador'
    const sucursalId = esAdmin ? sucursalSeleccionada : perfil.sucursal_id
    const vendedorId = esAdmin ? vendedorSeleccionado : perfil.id
    if (esAdmin && (!sucursalId || !vendedorId)) return []
    let consulta = supabase
      .from('clientes')
      .select(
        'id, nombre, telefono, direccion, numero_local, tipo, activo, creado_en',
      )
      .eq('vendedor_id', vendedorId ?? perfil.id)
      .eq('activo', true)
    if (sucursalId) consulta = consulta.eq('sucursal_id', sucursalId)
    const { data, error } = await consulta.order('nombre', { ascending: true }).returns<ClienteCartera[]>()
    if (error) throw new Error('No fue posible cargar los clientes de tu ruta. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerPaginaClientes(perfil: Perfil, sucursalSeleccionada?: string, vendedorSeleccionado?: string, pagina = 1): Promise<Pagina<ClienteCartera>> {
  try {
    const esAdmin = perfil.rol === 'administrador'
    const sucursalId = esAdmin ? sucursalSeleccionada : perfil.sucursal_id
    const vendedorId = esAdmin ? vendedorSeleccionado : perfil.id
    if (!sucursalId || !vendedorId) return { filas: [], total: 0 }
    const { data, count, error } = await supabase.from('clientes')
      .select('id, nombre, telefono, direccion, numero_local, tipo, activo, creado_en', { count: 'exact' })
      .eq('sucursal_id', sucursalId).eq('vendedor_id', vendedorId).eq('activo', true)
      .order('nombre', { ascending: true }).order('id', { ascending: true })
      .range(...rangoPagina(pagina)).returns<ClienteCartera[]>()
    if (error) throw new Error('No fue posible cargar los clientes de tu ruta. Inténtalo de nuevo.')
    return { filas: data ?? [], total: count ?? 0 }
  } catch (error: unknown) { throw new Error(mensajeErrorSupabase(error), { cause: error }) }
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
  try {
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
    return { error: error ? mensajeErrorSupabase(error) : null }
  } catch (error: unknown) {
    return { error: mensajeErrorSupabase(error) }
  }
}

// Vendedores activos de la sucursal (para admin en HU-02).
export async function obtenerVendedoresSucursal(
  sucursalId?: string,
): Promise<Pick<Perfil, 'id' | 'nombres' | 'apellidos'>[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombres, apellidos')
      .eq('sucursal_id', sucursalId)
      .eq('rol', 'vendedor')
      .eq('activo', true)
      .order('nombres')
      .returns<Pick<Perfil, 'id' | 'nombres' | 'apellidos'>[]>()
    if (error) throw new Error('No fue posible cargar los vendedores. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

// --- HU-01: productos para el formulario de venta ---
export async function obtenerProductosVenta(): Promise<ProductoVenta[]> {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select(
        'id, nombre, tipo, tipo_empaque_id, precio_base, activo, creado_en, tipos_empaque(id, nombre, categoria)',
      )
      .eq('activo', true)
      .order('nombre')
      .returns<ProductoVenta[]>()
    if (error) throw new Error('No fue posible cargar los productos para la venta. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

// --- HU-03: carga del vendedor ---
export async function obtenerCargaVendedor(perfil: Perfil): Promise<CargaVendedor[]> {
  try {
    const { data, error } = await supabase
      .from('carga_vendedor')
      .select(
        'producto_id, vendedor_id, cantidad, modificado_en, producto:productos(id, nombre, tipo, precio_base)',
      )
      .eq('vendedor_id', perfil.id)
      .returns<CargaVendedor[]>()
    if (error) throw new Error('No fue posible cargar tu carga. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

// --- HU-07: gastos del día ---
export async function obtenerGastosHoy(perfil: Perfil): Promise<GastoExtra[]> {
  try {
    const inicio = new Date()
    inicio.setHours(0, 0, 0, 0)
    const fin = new Date(inicio)
    fin.setDate(fin.getDate() + 1)

    const { data, error } = await supabase
      .from('gastos_extras')
      .select('id, tipo, monto, motivo, creado_en, anulado, vendedor_id, sucursal_id')
      .eq('vendedor_id', perfil.id)
      .gte('creado_en', inicio.toISOString())
      .lt('creado_en', fin.toISOString())
      .order('creado_en', { ascending: false })
      .returns<GastoExtra[]>()
    if (error) throw new Error('No fue posible cargar los gastos de hoy. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

const fechaGastos = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' })
export function jornadaGastos() { return fechaGastos.format(new Date()) }
function inicioDiaGastos(dia: string) {
  const referencia = Date.parse(`${dia}T12:00:00Z`)
  let desde = referencia - 36 * 3600_000
  let hasta = referencia + 36 * 3600_000
  while (desde < hasta) {
    const medio = Math.floor((desde + hasta) / 2)
    if (fechaGastos.format(medio) < dia) desde = medio + 1
    else hasta = medio
  }
  return new Date(desde).toISOString()
}
function limitesGastos(dia: string) {
  const siguiente = new Date(`${dia}T12:00:00Z`)
  siguiente.setUTCDate(siguiente.getUTCDate() + 1)
  return [inicioDiaGastos(dia), inicioDiaGastos(siguiente.toISOString().slice(0, 10))]
}

export async function obtenerPaginaGastos(perfil: Perfil, dia: string, pagina = 1): Promise<Pagina<GastoExtra>> {
  try {
    const [desde, hasta] = limitesGastos(dia)
    const { data, count, error } = await supabase.from('gastos_extras')
      .select('id, tipo, monto, motivo, creado_en, anulado, vendedor_id, sucursal_id', { count: 'exact' })
      .eq('vendedor_id', perfil.id).eq('sucursal_id', perfil.sucursal_id ?? '')
      .gte('creado_en', desde).lt('creado_en', hasta)
      .order('creado_en', { ascending: false }).order('id', { ascending: false })
      .range(...rangoPagina(pagina)).returns<GastoExtra[]>()
    if (error) throw new Error('No fue posible cargar los gastos de hoy. Inténtalo de nuevo.')
    return { filas: data ?? [], total: count ?? 0 }
  } catch (error: unknown) { throw new Error(mensajeErrorSupabase(error), { cause: error }) }
}

// A complete day total needs all active amounts, never just the visible page.
// Read compact, bounded batches; no SQL change or PostgREST aggregate feature required.
export async function obtenerTotalGastosHoy(perfil: Perfil, dia: string): Promise<number> {
  try {
    const [desde, hasta] = limitesGastos(dia)
    let total = 0
    for (let offset = 0; ; offset += 500) {
      const { data, count, error } = await supabase.from('gastos_extras').select('monto', { count: 'exact' })
        .eq('vendedor_id', perfil.id).eq('sucursal_id', perfil.sucursal_id ?? '').eq('anulado', false)
        .gte('creado_en', desde).lt('creado_en', hasta)
        .order('id', { ascending: true }).range(offset, offset + 499).returns<{ monto: number }[]>()
      if (error) throw new Error('No fue posible cargar el total de gastos. Inténtalo de nuevo.')
      total += (data ?? []).reduce((sum, row) => sum + Number(row.monto), 0)
      if ((data?.length ?? 0) < 500 || (count !== null && offset + 500 >= count)) return total
    }
  } catch (error: unknown) { throw new Error(mensajeErrorSupabase(error), { cause: error }) }
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
  try {
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
    return { error: error ? mensajeErrorSupabase(error) : null }
  } catch (error: unknown) {
    return { error: mensajeErrorSupabase(error) }
  }
}

// --- HU-01: RPC registrar_venta ---
export async function registrarVenta(
  args: RegistrarVentaArgs & { p_idempotency_key: string },
): Promise<{ id: string | null; error: string | null }> {
  try {
    const rpcArgs = {
      p_cliente_id: args.p_cliente_id,
      p_metodo_pago: args.p_metodo_pago,
      // TODO(#51): DetalleVentaInput is an interface, so it lacks the Json index signature; change it to a type alias in ventas/types.ts to drop this cast.
      p_detalles: args.p_detalles as unknown as Json,
      p_descuento: args.p_descuento,
      p_observaciones: args.p_observaciones,
      p_idempotency_key: args.p_idempotency_key,
    }
    const { data, error } = await supabase.rpc('registrar_venta', rpcArgs)

    if (error) {
      return { id: null, error: mensajeErrorSupabase(error) }
    }
    return { id: (data as string | null) ?? null, error: null }
  } catch (error: unknown) {
    return { id: null, error: mensajeErrorSupabase(error) }
  }
}

// --- HU-09: visualizar mi comisión ---
export interface ComisionVendedor {
  vendedor_id: string
  jornada: string
  tipo: 'agua' | 'hielo'
  base_comision: number
  porcentaje: number | null
  monto_fijo: number | null
  ventas_del_tipo: number
  comision: number
}

export async function obtenerMiComision(
  vendedorId: string,
): Promise<ComisionVendedor[]> {
  try {
    const { data, error } = await supabase
      .from('v_comision_vendedor')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .order('jornada', { ascending: false })
      .returns<ComisionVendedor[]>()

    if (error) {
      throw new Error('No fue posible obtener la comisión del vendedor')
    }

    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerCantidadVentasJornada(
  vendedorId: string,
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('contar_ventas_jornada', {
      p_vendedor_id: vendedorId,
    })

    if (error) {
      throw new Error('No fue posible obtener la cantidad de ventas')
    }

    return typeof data === 'number' ? data : 0
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

// --- HU-08: ranking de vendedores ---
export interface RankingVendedor {
  vendedor_id: string
  sucursal_id: string | null
  vendedor: string
  mes: string
  cantidad_ventas: number
  total_vendido: number
}

export async function obtenerRankingVendedores(
  mes: string,
): Promise<RankingVendedor[]> {
  try {
    const inicioMes = `${mes}-01`
    const [anio, numeroMes] = mes.split('-').map(Number)

    const inicioMesSiguiente = new Date(
      Date.UTC(anio, numeroMes, 1),
    ).toISOString()

    const { data, error } = await supabase
      .from('v_ranking_vendedores')
      .select('*')
      .gte('mes', inicioMes)
      .lt('mes', inicioMesSiguiente)
      .order('total_vendido', { ascending: false })
      .returns<RankingVendedor[]>()

    if (error) {
      throw new Error('No fue posible obtener el ranking de vendedores')
    }

    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}
export async function obtenerResumenVenta(id: string): Promise<{ id: string; total: number }> {
  try {
    const { data, error } = await supabase.from('ventas').select('id, total').eq('id', id)
      .returns<{ id: string; total: number }[]>()
    if (error || !data?.[0]) throw error ?? new Error('Venta no disponible')
    return data[0]
  } catch (cause: unknown) {
    throw new Error('No fue posible cargar el resumen de la venta. Inténtalo de nuevo.', { cause })
  }
}
