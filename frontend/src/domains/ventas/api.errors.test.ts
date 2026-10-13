import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearCliente, crearGasto, registrarVenta } from './api'
import { obtenerClientesRuta, obtenerVendedoresSucursal, obtenerProductosVenta, obtenerCargaVendedor, obtenerGastosHoy, obtenerMiComision, obtenerCantidadVentasJornada, obtenerRankingVendedores } from './api'

const mock = vi.hoisted(() => {
  let error: unknown = null
  let rechazo: unknown = null
  const resolver = () => rechazo
    ? Promise.reject(rechazo)
    : Promise.resolve({ data: null, count: null, error })
  const query = {
    select: () => query, eq: () => query, order: () => query,
    gte: () => query, lt: () => query, lte: () => query,
    in: () => query, is: () => query, not: () => query, limit: () => query,
    insert: resolver, returns: resolver,
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => resolver().then(resolve, reject),
  }
  return {
    supabase: { from: () => query, rpc: resolver },
    fallar: (causa: unknown, rechazar = false) => { error = causa; rechazo = rechazar ? causa : null },
    reset: () => { error = null; rechazo = null },
  }
})
vi.mock('../../lib/supabase', () => ({ supabase: mock.supabase }))
beforeEach(() => mock.reset())

const casos = [
  ['caché de esquema', { code: 'PGRST202', message: 'Could not find public.private_rpc in the schema cache' }, false, 'No fue posible completar la operación. Inténtalo de nuevo.'],
  ['restricción desconocida', { code: '23514', message: 'new row violates constraint private_check' }, false, 'Alguno de los datos no cumple las reglas del negocio.'],
  ['P0001 conocido', { code: 'P0001', message: 'No hay envases vacíos suficientes. Disponibles: 2' }, false, 'No hay envases vacíos suficientes.'],
  ['P0001 desconocido', { code: 'P0001', message: 'private function signature failed' }, false, 'No fue posible completar la operación. Inténtalo de nuevo.'],
  ['red en respuesta', new TypeError('Failed to fetch: private endpoint'), false, 'No fue posible completar la operación. Inténtalo de nuevo.'],
  ['red rechazada', new TypeError('Failed to fetch: private endpoint'), true, 'No fue posible completar la operación. Inténtalo de nuevo.'],
] as const

const cliente = { nombre: 'Cliente', direccion: 'Calle', telefono: null, numero_local: null, tipo: 'minorista', vendedor_id: 'u-1', sucursal_id: 's-1', creado_por: 'u-1' }
const escrituras = [
  ['crearCliente', () => crearCliente(cliente)],
  ['crearGasto', () => crearGasto({ tipo: 'combustible', monto: 5000, motivo: 'Bencina', vendedor_id: 'u-1', sucursal_id: 's-1', creado_por: 'u-1' })],
  ['registrarVenta', () => registrarVenta({ p_cliente_id: 'c-1', p_metodo_pago: 'efectivo', p_detalles: [], p_descuento: 0, p_observaciones: undefined, p_idempotency_key: 'key-venta' })],
] as const

describe.each(escrituras)('REV-4 · %s', (_nombre, escribir) => {
  it.each(casos)('devuelve un mensaje público ante %s', async (_caso, causa, rechazar, esperado) => {
    mock.fallar(causa, rechazar)
    const resultado = await escribir()
    expect(resultado.error).toBe(esperado)
  })
})

const perfil = { id: 'u-1', sucursal_id: 's-1', nombres: 'Ana', apellidos: 'López', rut: null, telefono: null, rol: 'vendedor' as const, activo: true, creado_en: '2026-01-01T00:00:00Z' }
const lecturas = [
  ['clientes', () => obtenerClientesRuta(perfil)],
  ['vendedores', () => obtenerVendedoresSucursal('s-1')],
  ['productos', () => obtenerProductosVenta()],
  ['carga', () => obtenerCargaVendedor(perfil)],
  ['gastos', () => obtenerGastosHoy(perfil)],
  ['comisión', () => obtenerMiComision('u-1')],
  ['cantidad de ventas', () => obtenerCantidadVentasJornada('u-1')],
  ['ranking', () => obtenerRankingVendedores('2026-10')],
] as const

describe('REV-4 · rechazos de red en lecturas', () => {
  it.each(lecturas)('sanea el rechazo de %s', async (_nombre, leer) => {
    mock.fallar(new TypeError('Failed to fetch: private endpoint'), true)
    await expect(leer()).rejects.toThrow('No fue posible completar la operación. Inténtalo de nuevo.')
  })
})
