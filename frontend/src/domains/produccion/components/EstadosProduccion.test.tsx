import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/render'
import HistorialProduccion from './HistorialProduccion'
import IndicadoresProduccion from './IndicadoresProduccion'
import { obtenerHistorialProduccion, obtenerIndicadoresProduccion } from '../api'

vi.mock('../api', () => ({ TAMANO_PRODUCCION: 10, obtenerPaginaHistorial: vi.fn(async (filtros: Parameters<typeof obtenerHistorialProduccion>[0]) => { const filas = await obtenerHistorialProduccion(filtros); return { filas, total: filas.length } }), obtenerHistorialProduccion: vi.fn(), obtenerIndicadoresProduccion: vi.fn() }))
beforeEach(() => vi.resetAllMocks())

it('A1-05 · un primer fallo de historial excluye el vacío y permite reintentar esa lectura', async () => {
  vi.mocked(obtenerHistorialProduccion).mockRejectedValueOnce(new Error('fallo')).mockResolvedValue([])
  renderWithProviders(<HistorialProduccion sucursalId="s1" productos={[]} versionDatos={0} />)
  await screen.findByRole('alert')
  expect(screen.queryByText(/No hay registros/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText(/No hay registros/)).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('A1-05 · un fallo tras éxito de historial oculta las filas anteriores', async () => {
  vi.mocked(obtenerHistorialProduccion).mockResolvedValueOnce([{ id: 'r1', sucursal_id: 's1', producto_id: 'p1', cantidad: 783, observaciones: 'Turno anterior', anulado: false, creado_por: 'u1', creado_en: '2026-10-13T02:15:59Z' }]).mockRejectedValue(new Error('fallo'))
  const { rerender } = renderWithProviders(<HistorialProduccion sucursalId="s1" productos={[]} versionDatos={0} />)
  await screen.findByText('Turno anterior')
  rerender(<HistorialProduccion sucursalId="s1" productos={[]} versionDatos={1} />)
  await screen.findByRole('alert')
  expect(screen.queryByText('Turno anterior')).not.toBeInTheDocument()
  expect(screen.queryByText(/No hay registros/)).not.toBeInTheDocument()
})

it('A1-05 · indicadores fallidos muestran guiones, sin ceros ni vacío y recuperan con Reintentar', async () => {
  vi.mocked(obtenerIndicadoresProduccion).mockRejectedValueOnce(new Error('fallo')).mockResolvedValue([])
  renderWithProviders(<IndicadoresProduccion sucursalId="s1" productos={[]} versionDatos={0} />)
  await screen.findByRole('alert')
  expect(screen.queryByText('0')).not.toBeInTheDocument()
  expect(screen.queryByText(/No hay producción/)).not.toBeInTheDocument()
  expect(screen.getAllByText('—')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText(/No hay producción/)).toBeInTheDocument()
  await waitFor(() => expect(screen.getAllByText('0')).toHaveLength(2))
})

it('A1-05 · indicadores no presentan datos anteriores al fallar tras éxito', async () => {
  vi.mocked(obtenerIndicadoresProduccion).mockResolvedValueOnce([{ sucursal_id: 's1', producto_id: 'p1', fecha: '2026-10-13', cantidad: 783, registros: 1 }]).mockRejectedValue(new Error('fallo'))
  const { rerender } = renderWithProviders(<IndicadoresProduccion sucursalId="s1" productos={[]} versionDatos={0} />)
  await screen.findAllByText('783')
  rerender(<IndicadoresProduccion sucursalId="s1" productos={[]} versionDatos={1} />)
  await screen.findByRole('alert')
  expect(screen.queryByText('783')).not.toBeInTheDocument()
  expect(screen.getAllByText('—')).toHaveLength(2)
})

it('UX-02/09 · historial contiene etiquetas de tarjeta en una sola fila y fecha sin segundos de Santiago', async () => {
  vi.mocked(obtenerHistorialProduccion).mockResolvedValue([{ id: 'r1', sucursal_id: 's1', producto_id: 'p1', cantidad: 783, observaciones: 'Turno anterior', anulado: false, creado_por: 'u1', creado_en: '2026-10-13T02:15:59Z' }])
  renderWithProviders(<HistorialProduccion sucursalId="s1" productos={[]} />)
  const fila = (await screen.findByText('Turno anterior')).closest('tr')!
  expect(fila).toHaveTextContent('Fecha y hora')
  expect(fila).toHaveTextContent('Producto')
  expect(fila).toHaveTextContent('Cantidad')
  expect(fila).toHaveTextContent('Observaciones')
  expect(fila).toHaveTextContent('12-10-2026 23:15')
  expect(screen.getAllByText('Turno anterior')).toHaveLength(1)
})

it.each(['historial', 'indicadores'] as const)('A1-05 · %s oculta datos retenidos en la misma caché si falla una actualización', async (seccion) => {
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
  const { render, act } = await import('@testing-library/react')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  vi.mocked(obtenerHistorialProduccion).mockResolvedValueOnce([{ id: 'r1', sucursal_id: 's1', producto_id: 'p1', cantidad: 783, observaciones: 'Turno anterior', anulado: false, creado_por: 'u1', creado_en: '2026-10-13T02:15:59Z' }]).mockRejectedValue(new Error('fallo'))
  vi.mocked(obtenerIndicadoresProduccion).mockResolvedValueOnce([{ sucursal_id: 's1', producto_id: 'p1', fecha: '2026-10-13', cantidad: 783, registros: 1 }]).mockRejectedValue(new Error('fallo'))
  render(<QueryClientProvider client={client}>{seccion === 'historial' ? <HistorialProduccion sucursalId="s1" productos={[]} /> : <IndicadoresProduccion sucursalId="s1" productos={[]} />}</QueryClientProvider>)
  await screen.findAllByText('783')
  await act(async () => { await client.invalidateQueries({ queryKey: ['produccion', '', 's1', seccion] }) })
  await screen.findByRole('alert')
  expect(client.getQueriesData({ queryKey: ['produccion', '', 's1', seccion] })[0][1]).toBeDefined()
  expect(screen.queryAllByText('783')).toHaveLength(0)
  expect(screen.queryByText(/No hay registros|No hay producción/)).not.toBeInTheDocument()
})

it('UX-09 · los períodos usan días de Santiago aunque el navegador esté en UTC', async () => {
  vi.stubEnv('TZ', 'UTC')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T01:30:00Z'))
  vi.mocked(obtenerIndicadoresProduccion).mockResolvedValue([])
  try {
    renderWithProviders(<IndicadoresProduccion sucursalId="s1" productos={[]} />)
    await screen.findByText('No hay producción en el período.')
    expect(obtenerIndicadoresProduccion).toHaveBeenLastCalledWith('s1', '2026-10-12', '2026-10-12')
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '7dias' } })
    await waitFor(() => expect(obtenerIndicadoresProduccion).toHaveBeenLastCalledWith('s1', '2026-10-06', '2026-10-12'))
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '30dias' } })
    await waitFor(() => expect(obtenerIndicadoresProduccion).toHaveBeenLastCalledWith('s1', '2026-09-13', '2026-10-12'))
  } finally { vi.useRealTimers(); vi.unstubAllEnvs() }
})


it.each(['historial', 'indicadores'] as const)('FX R2-01 · %s mantiene datos y nodo mientras refetch está pendiente', async (seccion) => {
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
  const { render, act } = await import('@testing-library/react')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  vi.mocked(obtenerHistorialProduccion).mockResolvedValueOnce([{ id: 'r1', sucursal_id: 's1', producto_id: 'p1', cantidad: 783, observaciones: 'Turno anterior', anulado: false, creado_por: 'u1', creado_en: '2026-10-13T02:15:59Z' }]).mockReturnValueOnce(new Promise(() => {}))
  vi.mocked(obtenerIndicadoresProduccion).mockResolvedValueOnce([{ sucursal_id: 's1', producto_id: 'p1', fecha: '2026-10-13', cantidad: 783, registros: 1 }]).mockReturnValueOnce(new Promise(() => {}))
  render(<QueryClientProvider client={client}>{seccion === 'historial' ? <HistorialProduccion sucursalId="s1" productos={[]} /> : <IndicadoresProduccion sucursalId="s1" productos={[]} />}</QueryClientProvider>)
  const nodos = await screen.findAllByText('783')
  act(() => { void client.invalidateQueries({ queryKey: ['produccion', '', 's1', seccion] }) })
  await screen.findByText('Actualizando...')
  expect(screen.getAllByText('783')).toEqual(nodos)
  expect(screen.queryByText('Cargando historial...')).not.toBeInTheDocument()
  expect(screen.queryByText('Calculando indicadores...')).not.toBeInTheDocument()
})
