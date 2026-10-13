import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => {
  const single = vi.fn()
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { single, eq, from }
})
vi.mock('./supabase', () => ({ supabase: { from: mock.from } }))
import { obtenerSucursalDashboard } from './dashboard'

beforeEach(() => vi.clearAllMocks())
describe('Dashboard service', () => {
  it('reads only the requested branch', async () => {
    mock.single.mockResolvedValue({ data: { id: 'suc-1', nombre: 'Matriz' }, error: null })
    await expect(obtenerSucursalDashboard('suc-1')).resolves.toMatchObject({ nombre: 'Matriz' })
    expect(mock.from).toHaveBeenCalledWith('sucursales')
    expect(mock.eq).toHaveBeenCalledWith('id', 'suc-1')
  })
  it.each(['response', 'network'])('sanitizes %s failures without treating them as empty results', async (failure) => {
    const error = new Error('private SQL schema and endpoint')
    if (failure === 'response') mock.single.mockResolvedValue({ data: null, error })
    else mock.single.mockRejectedValue(error)
    await expect(obtenerSucursalDashboard('suc-1')).rejects.toThrow('No fue posible cargar la sucursal. Inténtalo de nuevo.')
  })
})
