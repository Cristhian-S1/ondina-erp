import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useDatosProduccion } from './useDatosProduccion'
import * as api from '../api'
import * as catalog from '../../../lib/catalog'

vi.mock('../../../lib/catalog', () => ({ obtenerProductos: vi.fn().mockResolvedValue([]), obtenerTiposEmpaque: vi.fn().mockResolvedValue([]) }))
vi.mock('../api', () => ({
  obtenerIncidencias: vi.fn().mockResolvedValue([]),
  obtenerEnvasesDisponibles: vi.fn().mockResolvedValue([]), obtenerMermas: vi.fn().mockResolvedValue([]), obtenerProducciones: vi.fn().mockResolvedValue([]),
  subscribeProduccion: vi.fn(() => vi.fn()),
}))
beforeEach(() => vi.clearAllMocks())
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

it.each(['historial', 'indicadores'] as const)('A1-07 · %s sólo solicita el catálogo relevante', async (seccion) => {
  const { wrapper } = setup()
  renderHook(() => useDatosProduccion('u1', 's1', seccion), { wrapper })
  await waitFor(() => expect(catalog.obtenerProductos).toHaveBeenCalledOnce())
  expect(api.obtenerIncidencias).not.toHaveBeenCalled()
  expect(api.obtenerMermas).not.toHaveBeenCalled()
  expect(api.obtenerProducciones).not.toHaveBeenCalled()
  expect(api.obtenerEnvasesDisponibles).not.toHaveBeenCalled()
  expect(catalog.obtenerTiposEmpaque).not.toHaveBeenCalled()
})

it('A1-07 · incidencia pendiente no bloquea la consulta de mermas', async () => {
  vi.mocked(api.obtenerIncidencias).mockReturnValueOnce(new Promise(() => {}))
  const { wrapper } = setup()
  const { result } = renderHook(() => useDatosProduccion('u1', 's1', 'incidencias'), { wrapper })
  await waitFor(() => expect(result.current.mermas.isSuccess).toBe(true))
  expect(result.current.incidencias.isPending).toBe(true)
  expect(api.obtenerEnvasesDisponibles).not.toHaveBeenCalled()
})

it('A1-07 · Realtime invalida sólo el recurso afectado y limpia al cambiar identidad/sucursal', async () => {
  const { client, wrapper } = setup()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { rerender, unmount } = renderHook(({ user, branch }) => useDatosProduccion(user, branch, 'registrar'), { wrapper, initialProps: { user: 'u1', branch: 's1' } })
  const oldCallback = vi.mocked(api.subscribeProduccion).mock.calls[0][1]
  const firstCleanup = vi.mocked(api.subscribeProduccion).mock.results[0].value
  act(() => oldCallback('mermas'))
  expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: ['produccion', 'u1', 's1', 'mermas'] })
  invalidate.mockClear()
  act(() => oldCallback('producciones'))
  expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey?.[3])).toEqual(['producciones', 'historial', 'indicadores'])
  rerender({ user: 'u1', branch: 's2' })
  expect(firstCleanup).toHaveBeenCalledOnce()
  expect(api.subscribeProduccion).toHaveBeenLastCalledWith('s2', expect.any(Function))
  invalidate.mockClear()
  act(() => oldCallback('mermas'))
  expect(invalidate).not.toHaveBeenCalled()
  const secondCleanup = vi.mocked(api.subscribeProduccion).mock.results[1].value
  rerender({ user: 'u2', branch: 's2' })
  expect(secondCleanup).toHaveBeenCalledOnce()
  const thirdCleanup = vi.mocked(api.subscribeProduccion).mock.results[2].value
  unmount()
  expect(thirdCleanup).toHaveBeenCalledOnce()
})

it.each([
  ['producciones', ['producciones', 'historial', 'indicadores', 'envases']],
  ['mermas', ['mermas']],
  ['incidencias_produccion', ['incidencias']],
] as const)('A1-07 · mutación de %s invalida sólo recursos afectados', async (recurso, esperados) => {
  const { client, wrapper } = setup()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => useDatosProduccion('u1', 's1', 'registrar'), { wrapper })
  await act(async () => { await result.current.invalidar(recurso) })
  expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey?.[3])).toEqual(esperados)
})
