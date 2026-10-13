import { beforeEach, expect, it, vi } from 'vitest'
import { makePerfil } from '@/test/render'
import { obtenerClientesRuta } from './api'

const mock = vi.hoisted(() => {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), returns: vi.fn().mockResolvedValue({ data: [], error: null }) }
  return { query, from: vi.fn(() => query) }
})
vi.mock('../../lib/supabase', () => ({ supabase: { from: mock.from } }))
beforeEach(() => vi.clearAllMocks())

it('scopes administrator portfolio queries by selected branch and seller', async () => {
  await obtenerClientesRuta(makePerfil({ rol: 'administrador', sucursal_id: null }), 's2', 'v2')
  expect(mock.query.eq).toHaveBeenCalledWith('sucursal_id', 's2')
  expect(mock.query.eq).toHaveBeenCalledWith('vendedor_id', 'v2')
})
it('does not query an administrator portfolio without both explicit selections', async () => {
  const admin = makePerfil({ rol: 'administrador' })
  expect(await obtenerClientesRuta(admin)).toEqual([])
  expect(await obtenerClientesRuta(admin, 's2')).toEqual([])
  expect(mock.from).not.toHaveBeenCalled()
})
it('ignores supplied foreign scope for a vendedor', async () => {
  await obtenerClientesRuta(makePerfil({ id: 'self', sucursal_id: 'own' }), 'foreign', 'other')
  expect(mock.query.eq).toHaveBeenCalledWith('sucursal_id', 'own')
  expect(mock.query.eq).toHaveBeenCalledWith('vendedor_id', 'self')
  expect(mock.query.eq).not.toHaveBeenCalledWith('sucursal_id', 'foreign')
  expect(mock.query.eq).not.toHaveBeenCalledWith('vendedor_id', 'other')
})
