import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDespacho, corregirDevolucion, registrarDevolucionProductos, registrarDevolucionEnvases } from './api'
import { obtenerVendedores, obtenerVendedoresHistorial, obtenerDespachos, obtenerDetallesDespacho, obtenerEnvasesDespacho, obtenerDevolucionesProducto, obtenerDevolucionesEnvase, obtenerStockBodega, obtenerStockEnvases, obtenerCargaVendedores } from './api'

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

const escrituras = [
  ['crearDespacho', () => crearDespacho({ sucursal_id: 's-1', vendedor_id: 'u-1', despachador_id: 'u-2', creado_por: 'u-2', lineas: [], envases: [] })],
  ['corregirDevolucion', () => corregirDevolucion({ despacho_id: 'd-1', creado_por: 'u-2', lineas_producto: [], lineas_envase: [] })],
  ['registrarDevolucionProductos', () => registrarDevolucionProductos({ despacho_id: 'd-1', creado_por: 'u-2', lineas: [] })],
  ['registrarDevolucionEnvases', () => registrarDevolucionEnvases({ despacho_id: 'd-1', creado_por: 'u-2', lineas: [] })],
] as const

describe.each(escrituras)('REV-4 · %s', (_nombre, escribir) => {
  it.each(casos)('devuelve un mensaje público ante %s', async (_caso, causa, rechazar, esperado) => {
    mock.fallar(causa, rechazar)
    const resultado = await escribir()
    expect(resultado.error).toBe(esperado)
  })
})

const lecturas = [
  ['vendedores', () => obtenerVendedores('s-1')],
  ['vendedores históricos', () => obtenerVendedoresHistorial('s-1')],
  ['despachos', () => obtenerDespachos('s-1')],
  ['detalles', () => obtenerDetallesDespacho(['d-1'])],
  ['envases', () => obtenerEnvasesDespacho(['d-1'])],
  ['devoluciones de productos', () => obtenerDevolucionesProducto(['d-1'])],
  ['devoluciones de envases', () => obtenerDevolucionesEnvase(['d-1'])],
  ['stock de productos', () => obtenerStockBodega('s-1')],
  ['stock de envases', () => obtenerStockEnvases('s-1')],
  ['carga', () => obtenerCargaVendedores(['u-1'])],
] as const

describe('REV-4 · rechazos de red en lecturas', () => {
  it.each(lecturas)('sanea el rechazo de %s', async (_nombre, leer) => {
    mock.fallar(new TypeError('Failed to fetch: private endpoint'), true)
    await expect(leer()).rejects.toThrow('No fue posible completar la operación. Inténtalo de nuevo.')
  })
})
