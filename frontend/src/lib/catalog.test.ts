import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => {
  const result = vi.fn()
  const query = {
    select: () => query, eq: () => query, order: () => query, returns: result,
  }
  return { result, supabase: { from: () => query } }
})
vi.mock('./supabase', () => ({ supabase: mock.supabase }))
import { obtenerProductos, obtenerSucursales, obtenerTiposEmpaque } from './catalog'

beforeEach(() => mock.result.mockReset())

describe('FE-05 · catálogo', () => {
  const lecturas = [obtenerProductos, obtenerSucursales, obtenerTiposEmpaque]
  it.each(lecturas)('distingue errores de resultados vacíos en %s', async (leer) => {
    mock.result.mockResolvedValue({ data: null, error: { message: 'private SQL detail' } })
    await expect(leer()).rejects.toThrow(/^No fue posible cargar .* Inténtalo de nuevo\.$/)
    mock.result.mockResolvedValue({ data: null, error: null })
    await expect(leer()).resolves.toEqual([])
  })
})
