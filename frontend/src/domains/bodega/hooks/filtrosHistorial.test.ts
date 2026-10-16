import { describe, expect, it } from 'vitest'
import { filtrosHistorial, inicioDiaSantiago } from './filtrosHistorial'

describe('Santiago server filters', () => {
  it('uses local midnight and an exclusive next day', () => {
    expect(filtrosHistorial('2026-10-14', 'hoy', '', 'v1')).toEqual({ vendedorId: 'v1', desde: '2026-10-14T03:00:00.000Z', hasta: '2026-10-15T03:00:00.000Z' })
    expect(filtrosHistorial('2026-07-14', 'ayer', '', '')).toEqual({ vendedorId: '', desde: '2026-07-13T04:00:00.000Z', hasta: '2026-07-14T04:00:00.000Z' })
  })
  it('supports seven days, all history, explicit dates and a skipped DST midnight', () => {
    expect(filtrosHistorial('2026-10-14', '7d', '', '').desde).toBe('2026-10-08T03:00:00.000Z')
    expect(filtrosHistorial('2026-10-14', 'todo', '', '')).toEqual({ vendedorId: '' })
    expect(filtrosHistorial('2026-10-14', 'fecha', '2026-07-01', '').hasta).toBe('2026-07-02T04:00:00.000Z')
    expect(inicioDiaSantiago('2026-09-06')).toBe('2026-09-06T04:00:00.000Z')
  })
})
