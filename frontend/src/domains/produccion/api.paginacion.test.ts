import { beforeEach, describe, expect, it, vi } from 'vitest'
const query = vi.hoisted(() => {
  const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), gte: vi.fn(), lte: vi.fn(), is: vi.fn(), not: vi.fn(), returns: vi.fn() }
  return q
})
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(() => query) } }))
import { obtenerPaginaHistorial, obtenerPaginaIncidencias, obtenerPaginaMermas, obtenerPaginaProducciones } from './api'
beforeEach(() => {
  vi.clearAllMocks()
  for (const method of ['select', 'eq', 'order', 'range', 'gte', 'lte', 'is', 'not'] as const) query[method].mockReturnValue(query)
  query.returns.mockResolvedValue({ data: [{ id: 'visible' }], count: 312, error: null })
})
describe('P2 server pages', () => {
  it.each([obtenerPaginaProducciones, obtenerPaginaIncidencias, obtenerPaginaMermas])('counts and ranges growing resources with branch and deterministic order', async fn => {
    expect(await fn('s1', 3)).toEqual({ filas: [{ id: 'visible' }], total: 312 })
    expect(query.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(query.eq).toHaveBeenCalledWith('sucursal_id', 's1')
    expect(query.range).toHaveBeenCalledWith(20, 29)
    expect(query.order).toHaveBeenCalledWith('id', { ascending: false })
  })
  it('applies all history filters before paging and preserves Santiago date bounds', async () => {
    await obtenerPaginaHistorial({ sucursalId: 's1', productoId: 'p1', desde: '2026-10-14', hasta: '2026-10-14' }, 2)
    expect(query.eq).toHaveBeenCalledWith('producto_id', 'p1')
    expect(query.gte).toHaveBeenCalledWith('creado_en', '2026-10-14T03:00:00.000Z')
    expect(query.lte).toHaveBeenCalledWith('creado_en', '2026-10-15T02:59:59.999Z')
    expect(query.range).toHaveBeenCalledWith(10, 19)
  })
  it('returns an empty page and rejects safe read errors', async () => {
    query.returns.mockResolvedValueOnce({ data: [], count: 0, error: null })
    expect(await obtenerPaginaProducciones('s1', 1)).toEqual({ filas: [], total: 0 })
    query.returns.mockResolvedValueOnce({ data: null, count: null, error: { message: 'private SQL' } })
    await expect(obtenerPaginaMermas('s1', 1)).rejects.not.toThrow('private SQL')
  })
})

it('reads every aggregate batch so indicator totals are never limited to a visible page', async () => {
  const { obtenerIndicadoresProduccion } = await import('./api')
  query.returns.mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => ({ cantidad: 1 })), count: 501, error: null })
    .mockResolvedValueOnce({ data: [{ cantidad: 9 }], count: 501, error: null })
  const rows = await obtenerIndicadoresProduccion('s1', '2026-10-01', '2026-10-14')
  expect(rows).toHaveLength(501)
  expect(query.range).toHaveBeenLastCalledWith(500, 999)
})
