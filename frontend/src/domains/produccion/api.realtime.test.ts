import { expect, it, vi } from 'vitest'
import { subscribeProduccion } from './api'

const mock = vi.hoisted(() => {
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }
  return { channel, supabase: { channel: vi.fn(() => channel), removeChannel: vi.fn() } }
})
vi.mock('../../lib/supabase', () => ({ supabase: mock.supabase }))

it('A1-07 · informa el recurso cambiado, mantiene los filtros por sucursal y elimina el canal', () => {
  const onChange = vi.fn()
  const unsubscribe = subscribeProduccion('s2', onChange)
  expect(mock.supabase.channel).toHaveBeenCalledWith('produccion-s2')
  for (const table of ['producciones', 'mermas', 'stock_envases']) {
    const call = mock.channel.on.mock.calls.find(([, config]) => config.table === table)
    expect(call?.[1]).toEqual({ event: '*', schema: 'public', table, filter: 'sucursal_id=eq.s2' })
    call?.[2]()
    expect(onChange).toHaveBeenLastCalledWith(table)
  }
  expect(mock.channel.subscribe).toHaveBeenCalledOnce()
  unsubscribe()
  expect(mock.supabase.removeChannel).toHaveBeenCalledWith(mock.channel)
})
