import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../../context/auth-context'
import { makePerfil } from '../../../test/render'
import { useCarteraPaginada } from './useCarteraPaginada'
import { useCrearCliente } from './useCrearCliente'
import { useCrearGasto } from './useCrearGasto'
import * as api from '../api'
vi.mock('../api')
beforeEach(() => { vi.clearAllMocks() })
function setup() {
  const perfil = makePerfil({ rol: 'administrador', sucursal_id: 's1' })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><AuthContext.Provider value={{ perfil, loading: false, signIn: async () => {}, signOut: async () => {} }}>{children}</AuthContext.Provider></QueryClientProvider>
  return { perfil, client, wrapper }
}
it('resets the cartera page on seller changes and returns an empty page safely', async () => {
  vi.mocked(api.obtenerPaginaClientes).mockResolvedValue({ filas: [], total: 0 })
  const { wrapper } = setup()
  const { result, rerender } = renderHook(({ seller }) => useCarteraPaginada('s1', seller), { wrapper, initialProps: { seller: 'v1' } })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([])
  act(() => result.current.setPagina(2))
  await waitFor(() => expect(api.obtenerPaginaClientes).toHaveBeenLastCalledWith(expect.anything(), 's1', 'v1', 2))
  rerender({ seller: 'v2' })
  await waitFor(() => expect(api.obtenerPaginaClientes).toHaveBeenLastCalledWith(expect.anything(), 's1', 'v2', 1))
})
it('successful client creation invalidates all cartera pages of that seller', async () => {
  const { perfil, client, wrapper } = setup()
  const key = ['ventas', 'clientes', perfil.id, 's1', 'v1', 'cartera', 'administrador', 9]
  client.setQueryData(key, 'cached')
  vi.mocked(api.obtenerVendedoresSucursal).mockResolvedValue([{ id: 'v1', nombres: 'Ana', apellidos: 'López' }])
  vi.mocked(api.crearCliente).mockResolvedValue({ error: null })
  const { result } = renderHook(() => useCrearCliente('s1'), { wrapper })
  await act(async () => { await result.current.mutateAsync({ nombre: 'Cliente', direccion: 'Calle 1', tipo: 'minorista', telefono: '', numero_local: '', vendedor_id: 'v1' }) })
  expect(client.getQueryState(key)?.isInvalidated).toBe(true)
})
it.each([true, false])('expense mutation success=%s invalidates pages and day totals only on success', async success => {
  const { client, wrapper } = setup()
  const keys = [['ventas', 'gastos', 'hoy', 'user-1', 'lista', 9], ['ventas', 'gastos', 'hoy', 'user-1', 'total']]
  keys.forEach(key => client.setQueryData(key, 'cached'))
  vi.mocked(api.crearGasto).mockResolvedValue({ error: success ? null : 'Error público' })
  const { result } = renderHook(() => useCrearGasto(), { wrapper })
  await act(async () => { await result.current.mutateAsync({ tipo: 'otra', monto: 10, motivo: 'Prueba' }) })
  for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(success)
})

it('resets expenses to page 1 when the Santiago day changes without changing identity', async () => {
  const { useGastosHoy } = await import('./useGastosHoy')
  let day = '2026-10-14'
  vi.mocked(api.jornadaGastos).mockImplementation(() => day)
  vi.mocked(api.obtenerPaginaGastos).mockResolvedValue({ filas: [], total: 41 })
  vi.mocked(api.obtenerTotalGastosHoy).mockResolvedValue(50)
  const { wrapper } = setup()
  const { result } = renderHook(() => useGastosHoy(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  act(() => result.current.setPagina(2))
  await waitFor(() => expect(api.obtenerPaginaGastos).toHaveBeenLastCalledWith(expect.anything(), '2026-10-14', 2))
  day = '2026-10-15'
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(api.obtenerPaginaGastos).toHaveBeenLastCalledWith(expect.anything(), '2026-10-15', 1))
  expect(result.current.pagina).toBe(1)
})
