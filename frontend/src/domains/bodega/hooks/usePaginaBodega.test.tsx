import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import * as api from '../api'
import type { VendedorSucursal } from '../api'
import { usePaginaBodega } from './usePaginaBodega'
vi.mock('../api')

function Nombres({ vendedores = [] }: { vendedores?: VendedorSucursal[] }) {
  const q = usePaginaBodega('suc-1', {}, vendedores, 'fuera-de-pagina')
  return <><p data-testid="lista">{q.data?.despachos[0]?.vendedorNombre}</p>
    <p data-testid="individual">{q.individual?.despachos[0]?.vendedorNombre}</p></>
}

it('C3-05 · resuelve vendedor activo llegado después del historial en lista y detalle fuera de página', async () => {
  vi.mocked(api.obtenerDespacho).mockResolvedValue([{ id: 'fuera-de-pagina', vendedor_id: 'v1' } as never])
  const vista = renderWithProviders(<Nombres />)
  await waitFor(() => expect(screen.getByTestId('individual')).toHaveTextContent('Vendedor no disponible'))
  vista.rerender(<Nombres vendedores={[{ id: 'v1', nombres: 'Valentina', apellidos: 'Rojas' }]} />)
  expect(screen.getByTestId('lista')).toHaveTextContent('Valentina Rojas')
  expect(screen.getByTestId('individual')).toHaveTextContent('Valentina Rojas')
  vista.rerender(<Nombres />)
  expect(screen.getByTestId('lista')).toHaveTextContent('Vendedor no disponible')
  expect(screen.getByTestId('individual')).toHaveTextContent('Vendedor no disponible')
})
function Vista({ vendedor = '' }: { vendedor?: string }) {
  const q = usePaginaBodega('suc-1', { vendedorId: vendedor })
  return <><p>{q.pagina}</p><p>{q.data?.despachos.map(d => d.id).join(',')}</p><button onClick={() => q.setPagina(2)}>Siguiente</button><button onClick={() => void q.actualizar()}>Actualizar</button></>
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerPaginaDespachos).mockResolvedValue({ filas: [{ id: 'page-1', vendedor_id: 'v1' } as never], total: 45 })
  for (const fn of [api.obtenerDetallesDespacho, api.obtenerEnvasesDespacho, api.obtenerDevolucionesProducto, api.obtenerDevolucionesEnvase]) vi.mocked(fn).mockResolvedValue([])
})
describe('usePaginaBodega', () => {
  it('loads children only for visible ids, includes page/filter and resets synchronously on filter change', async () => {
    const vista = renderWithProviders(<Vista />)
    await screen.findByText('page-1')
    expect(api.obtenerDetallesDespacho).toHaveBeenCalledWith(['page-1'])
    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(api.obtenerPaginaDespachos).toHaveBeenLastCalledWith('suc-1', expect.objectContaining({ pagina: 2, vendedorId: '' })))
    vista.rerender(<Vista vendedor="v2" />)
    await waitFor(() => expect(api.obtenerPaginaDespachos).toHaveBeenLastCalledWith('suc-1', expect.objectContaining({ pagina: 1, vendedorId: 'v2' })))
    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(api.obtenerPaginaDespachos).toHaveBeenLastCalledWith('suc-1', expect.objectContaining({ pagina: 2, vendedorId: 'v2' })))
    vista.rerender(<Vista />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })
  it('retains rows while next page is pending and invalidates cached pages on update', async () => {
    renderWithProviders(<Vista />)
    await screen.findByText('page-1')
    let resolver!: (value: Awaited<ReturnType<typeof api.obtenerPaginaDespachos>>) => void
    vi.mocked(api.obtenerPaginaDespachos).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve }))
    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(api.obtenerPaginaDespachos).toHaveBeenCalledTimes(2))
    expect(screen.getByText('page-1')).toBeInTheDocument()
    resolver({ filas: [{ id: 'page-2', vendedor_id: 'v1' } as never], total: 45 })
    await screen.findByText('page-2')
    fireEvent.click(screen.getByText('Actualizar'))
    await waitFor(() => expect(api.obtenerPaginaDespachos).toHaveBeenCalledTimes(3))
  })
})

it('invalidates every scoped cached page, resources, selected dispatch, stock and seller load', async () => {
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
  const { AuthContext } = await import('@/context/auth-context')
  const { makePerfil } = await import('@/test/render')
  const { render } = await import('@testing-library/react')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const perfil = makePerfil()
  const scope = ['bodega', perfil.id, perfil.rol, perfil.sucursal_id, 'suc-1']
  const affected = [[...scope, 'historial', {}, 99], [...scope, 'recursos', true], [...scope, 'despacho', 'pinned'], ['stock', perfil.id, 'suc-1'], ['ventas', 'carga', perfil.id]]
  const unrelated = ['bodega', 'someone-else', perfil.rol, perfil.sucursal_id, 'suc-1', 'historial', {}, 1]
  for (const key of [...affected, unrelated]) client.setQueryData(key, 'cached')
  render(<QueryClientProvider client={client}><AuthContext.Provider value={{ perfil, loading: false, signIn: async () => {}, signOut: async () => {} }}><Vista /></AuthContext.Provider></QueryClientProvider>)
  await screen.findByText('page-1')
  fireEvent.click(screen.getByText('Actualizar'))
  await waitFor(() => {
    for (const key of affected) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  })
  expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false)
  client.clear()
})
