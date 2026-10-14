import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useRegistrarVenta } from './useRegistrarVenta'
import { registrarVenta } from '../api'
import type { RegistrarVentaForm } from '../schemas'

const auth = vi.hoisted(() => ({ perfil: { id: 'u1' } }))
vi.mock('../../../context/auth-context', () => ({ useAuth: () => auth }))
vi.mock('../api', () => ({ registrarVenta: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); auth.perfil = { id: 'u1' } })
const form: RegistrarVentaForm = { clienteId: 'c1', metodoPago: 'efectivo', descuento: 0, observaciones: '', detalles: [{ productoId: 'p1', cantidad: 2, precioUnitario: 1000 }] }
function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { ...renderHook(() => useRegistrarVenta(), { wrapper }), client }
}
it('retains one key after a lost response and creates a new key after success', async () => {
  vi.mocked(registrarVenta).mockResolvedValueOnce({ id: null, error: 'No fue posible completar la operación. Inténtalo de nuevo.' }).mockResolvedValue({ id: 'sale', error: null })
  const { result } = setup()
  await act(async () => { await result.current.mutateAsync(form) })
  await act(async () => { await result.current.mutateAsync({ ...form }) })
  const first = vi.mocked(registrarVenta).mock.calls[0][0].p_idempotency_key
  expect(first).toMatch(/^[a-f0-9-]{36}$/)
  expect(vi.mocked(registrarVenta).mock.calls[1][0].p_idempotency_key).toBe(first)
  await act(async () => { await result.current.mutateAsync(form) })
  expect(vi.mocked(registrarVenta).mock.calls[2][0].p_idempotency_key).not.toBe(first)
})
it('starts another attempt when form contents or identity change', async () => {
  vi.mocked(registrarVenta).mockResolvedValue({ id: null, error: 'Retry' })
  const { result, rerender } = setup()
  await act(async () => { await result.current.mutateAsync(form) })
  await act(async () => { await result.current.mutateAsync({ ...form, descuento: 10 }) })
  auth.perfil = { id: 'u2' }
  rerender()
  await act(async () => { await result.current.mutateAsync({ ...form, descuento: 10 }) })
  expect(new Set(vi.mocked(registrarVenta).mock.calls.map(([args]) => args.p_idempotency_key)).size).toBe(3)
})


it('A1-06 · éxito invalida comisión y carga una sola vez; error no invalida', async () => {
  vi.mocked(registrarVenta).mockResolvedValueOnce({ id: null, error: 'fallo' }).mockResolvedValue({ id: 'sale', error: null })
  const { result, client } = setup()
  client.setQueryData(['mi-comision', 'u1', 's1'], [{ comision: 10 }])
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  await act(async () => { await result.current.mutateAsync(form) })
  expect(invalidate).not.toHaveBeenCalled()
  await act(async () => { await result.current.mutateAsync(form) })
  expect(client.getQueryState(['mi-comision', 'u1', 's1'])?.isInvalidated).toBe(true)
  expect(invalidate.mock.calls.filter(([arg]) => arg?.queryKey?.[1] === 'carga')).toHaveLength(1)
})
