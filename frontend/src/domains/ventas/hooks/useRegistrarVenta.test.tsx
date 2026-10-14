import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
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


it('FX2 R3-01 · venta exitosa invalida el prefijo ranking', async () => {
  vi.mocked(registrarVenta).mockResolvedValueOnce({ id: 'v1', error: null })
  const { result, client } = setup()
  client.setQueryData(['ventas','ranking','2026-10','u1'], [])
  await act(async () => { await result.current.mutateAsync(form) })
  expect(client.getQueryState(['ventas','ranking','2026-10','u1'])?.isInvalidated).toBe(true)
})


it('FX2 R3-01 · volver al ranking dentro de 30 s relee sólo después de venta exitosa', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const leer = vi.fn().mockResolvedValueOnce(2000).mockResolvedValue(3000)
  const useRanking = () => useQuery({ queryKey: ['ventas','ranking','2026-10','u1'], queryFn: leer })
  const inicial = renderHook(useRanking, { wrapper })
  await waitFor(() => expect(inicial.result.current.data).toBe(2000))
  inicial.unmount()
  const venta = renderHook(() => useRegistrarVenta(), { wrapper })
  vi.mocked(registrarVenta).mockResolvedValueOnce({ id: null, error: 'Fallo' }).mockResolvedValueOnce({ id: 'v1', error: null })
  await act(async () => { await venta.result.current.mutateAsync(form) })
  const trasFallo = renderHook(useRanking, { wrapper })
  expect(trasFallo.result.current.data).toBe(2000)
  expect(leer).toHaveBeenCalledTimes(1)
  trasFallo.unmount()
  await act(async () => { await venta.result.current.mutateAsync(form) })
  const trasExito = renderHook(useRanking, { wrapper })
  await waitFor(() => expect(trasExito.result.current.data).toBe(3000))
  expect(leer).toHaveBeenCalledTimes(2)
})
