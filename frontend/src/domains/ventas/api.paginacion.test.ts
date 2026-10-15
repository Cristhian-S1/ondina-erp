import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePerfil } from '../../test/render'
const q = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), gte: vi.fn(), lt: vi.fn(), returns: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(() => q) } }))
import { obtenerPaginaClientes, obtenerPaginaGastos, obtenerTotalGastosHoy } from './api'
beforeEach(() => {
  vi.clearAllMocks()
  for (const method of ['select', 'eq', 'order', 'range', 'gte', 'lt'] as const) q[method].mockReturnValue(q)
  q.returns.mockResolvedValue({ data: [{ id: 'visible' }], count: 301, error: null })
})
describe('P2 ventas pages', () => {
  it('paginates the selected seller cartera and counts all active clients', async () => {
    expect(await obtenerPaginaClientes(makePerfil({ rol: 'administrador' }), 's2', 'v2', 3)).toEqual({ filas: [{ id: 'visible' }], total: 301 })
    expect(q.eq).toHaveBeenCalledWith('vendedor_id', 'v2')
    expect(q.eq).toHaveBeenCalledWith('sucursal_id', 's2')
    expect(q.eq).toHaveBeenCalledWith('activo', true)
    expect(q.range).toHaveBeenCalledWith(40, 59)
  })
  it('returns no client rows for an incomplete admin scope', async () => {
    expect(await obtenerPaginaClientes(makePerfil({ rol: 'administrador' }), '', '', 1)).toEqual({ filas: [], total: 0 })
    expect(q.select).not.toHaveBeenCalled()
  })
  it('paginates expenses in the Santiago day and preserves the authoritative day total across batches', async () => {
    await obtenerPaginaGastos(makePerfil(), '2026-10-14', 2)
    expect(q.range).toHaveBeenCalledWith(20, 39)
    expect(q.gte).toHaveBeenCalledWith('creado_en', '2026-10-14T03:00:00.000Z')
    expect(q.lt).toHaveBeenCalledWith('creado_en', '2026-10-15T03:00:00.000Z')
    q.returns.mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => ({ monto: 2 })), count: 501, error: null })
      .mockResolvedValueOnce({ data: [{ monto: 17 }], count: 501, error: null })
    expect(await obtenerTotalGastosHoy(makePerfil(), '2026-10-14')).toBe(1017)
    expect(q.select).toHaveBeenCalledWith('monto', { count: 'exact' })
    expect(q.eq).toHaveBeenCalledWith('anulado', false)
    expect(q.range).toHaveBeenLastCalledWith(500, 999)
  })
})
