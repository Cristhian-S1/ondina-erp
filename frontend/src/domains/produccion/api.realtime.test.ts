import { expect, it, vi } from 'vitest'
import { subscribeProduccion } from './api'

const mock = vi.hoisted(() => {
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }
  return { channel, supabase: { channel: vi.fn(() => channel), removeChannel: vi.fn() } }
})
vi.mock('../../lib/supabase', () => ({ supabase: mock.supabase }))

it('keeps the three existing listeners scoped by sucursal and removes the channel', () => {
  const onChange = vi.fn()
  const unsubscribe = subscribeProduccion('s2', onChange)
  expect(mock.supabase.channel).toHaveBeenCalledWith('produccion-s2')
  for (const table of ['producciones', 'mermas', 'stock_envases']) {
    expect(mock.channel.on).toHaveBeenCalledWith('postgres_changes', { event: '*', schema: 'public', table, filter: 'sucursal_id=eq.s2' }, onChange)
  }
  expect(mock.channel.subscribe).toHaveBeenCalledOnce()
  unsubscribe()
  expect(mock.supabase.removeChannel).toHaveBeenCalledWith(mock.channel)
})
