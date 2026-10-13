import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarIncidencia, obtenerIncidencias, registrarProduccion, registrarMerma, obtenerProducciones, obtenerHistorialProduccion, obtenerIndicadoresProduccion, obtenerMermas, obtenerEnvasesDisponibles } from './api'

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

const datos = { sucursal_id: 's-1', producto_id: 'p-1', cantidad: 2, creado_por: 'u-1' }
const escrituras = [
  ['registrarIncidencia', () => registrarIncidencia({ sucursal_id: 's-1', creado_por: 'u-1', produccion_id: null, descripcion: 'Observación' })],
  ['registrarProduccion', () => registrarProduccion({ ...datos, observaciones: null })],
  ['registrarMerma', () => registrarMerma({ ...datos, motivo: 'Daño', tipo_empaque_id: null, despacho_id: null })],
] as const
const lecturas = [
  ['incidencias', () => obtenerIncidencias('s-1')],
  ['producciones', () => obtenerProducciones('s-1')],
  ['historial', () => obtenerHistorialProduccion({ sucursalId: 's-1' })],
  ['indicadores', () => obtenerIndicadoresProduccion('s-1', '2026-10-01', '2026-10-13')],
  ['mermas', () => obtenerMermas('s-1')],
  ['envases', () => obtenerEnvasesDisponibles('s-1', [])],
] as const

describe.each(escrituras)('REV-4 · %s', (_nombre, escribir) => {
  it.each(casos)('devuelve un mensaje público ante %s', async (_caso, causa, rechazar, esperado) => {
    mock.fallar(causa, rechazar)
    const resultado = await escribir()
    expect(resultado).toBe(esperado)
  })
})

describe.each(lecturas)('REV-4 · lectura de %s', (_nombre, leer) => {
  it.each(casos)('rechaza con un mensaje público ante %s', async (_caso, causa, rechazar, esperado) => {
    mock.fallar(causa, rechazar)
    await expect(leer()).rejects.toThrow(esperado)
  })
})
