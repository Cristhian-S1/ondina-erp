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
  expect(mock.supabase.channel).toHaveBeenCalledWith(expect.stringMatching(/^produccion-s2-/))
  for (const table of ['producciones', 'mermas', 'stock_envases', 'stock_bodega']) {
    const call = mock.channel.on.mock.calls.find(([, config]) => config.table === table)
    expect(call?.[1]).toEqual({ event: '*', schema: 'public', table, filter: 'sucursal_id=eq.s2' })
    call?.[2]()
    expect(onChange).toHaveBeenLastCalledWith(table)
  }
  expect(mock.channel.subscribe).toHaveBeenCalledOnce()
  unsubscribe()
  expect(mock.supabase.removeChannel).toHaveBeenCalledWith(mock.channel)
})


it('R2-11 · limpieza controla rechazos y montajes simultáneos usan tópicos distintos', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  mock.supabase.removeChannel.mockRejectedValueOnce(new Error('offline'))
  const first = subscribeProduccion('s2', vi.fn())
  const second = subscribeProduccion('s2', vi.fn())
  const topics = mock.supabase.channel.mock.calls.slice(-2).map(([topic]) => topic)
  expect(topics[0]).not.toBe(topics[1])
  await expect(first()).resolves.toBeUndefined()
  second()
  warn.mockRestore()
})
