import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { useDatosProduccion } from './useDatosProduccion'
import { subscribeProduccion } from '../api'

vi.mock('../../../lib/catalog', () => ({ obtenerProductos: vi.fn().mockResolvedValue([]), obtenerTiposEmpaque: vi.fn().mockResolvedValue([]) }))
vi.mock('../api', () => ({
  obtenerEnvasesDisponibles: vi.fn().mockResolvedValue([]), obtenerMermas: vi.fn().mockResolvedValue([]), obtenerProducciones: vi.fn().mockResolvedValue([]),
  subscribeProduccion: vi.fn(() => vi.fn()),
}))

it('subscribes by branch, invalidates its key, and cleans up on branch/identity changes and unmount', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result, rerender, unmount } = renderHook(({ user, branch }) => useDatosProduccion(user, branch), { wrapper, initialProps: { user: 'u1', branch: 's1' } })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  const oldCallback = vi.mocked(subscribeProduccion).mock.calls[0][1]
  const firstCleanup = vi.mocked(subscribeProduccion).mock.results[0].value
  act(() => oldCallback())
  expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ['produccion', 'u1', 's1'] })
  rerender({ user: 'u1', branch: 's2' })
  expect(firstCleanup).toHaveBeenCalledOnce()
  expect(subscribeProduccion).toHaveBeenLastCalledWith('s2', expect.any(Function))
  invalidate.mockClear()
  act(() => oldCallback())
  expect(invalidate).not.toHaveBeenCalled()
  const secondCleanup = vi.mocked(subscribeProduccion).mock.results[1].value
  rerender({ user: 'u2', branch: 's2' })
  expect(secondCleanup).toHaveBeenCalledOnce()
  const thirdCleanup = vi.mocked(subscribeProduccion).mock.results[2].value
  unmount()
  expect(thirdCleanup).toHaveBeenCalledOnce()
})
