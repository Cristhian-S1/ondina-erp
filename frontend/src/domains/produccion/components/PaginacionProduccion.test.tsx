import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import HistorialProduccion from './HistorialProduccion'
import * as api from '../api'
vi.mock('../api')
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerPaginaHistorial).mockResolvedValue({ filas: [{ id: 'p1', producto_id: 'x', cantidad: 20, observaciones: 'Fila visible' } as never], total: 301 })
})
it('pages history on the server, keeps rows while pending, and resets when filters change', async () => {
  renderWithProviders(<HistorialProduccion perfilId="" sucursalId="s1" productos={[]} />)
  await screen.findByText('Fila visible')
  expect(screen.getByRole('navigation', { name: 'Paginación del historial de producción' })).toHaveTextContent('301 registros')
  let resolver!: (value: Awaited<ReturnType<typeof api.obtenerPaginaHistorial>>) => void
  vi.mocked(api.obtenerPaginaHistorial).mockReturnValueOnce(new Promise(resolve => { resolver = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  await waitFor(() => expect(api.obtenerPaginaHistorial).toHaveBeenLastCalledWith(expect.objectContaining({ sucursalId: 's1' }), 2))
  expect(screen.getByText('Fila visible')).toBeInTheDocument()
  resolver({ filas: [], total: 301 })
  await screen.findByText('No hay registros para los filtros seleccionados.')
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } })
  await waitFor(() => expect(api.obtenerPaginaHistorial).toHaveBeenLastCalledWith(expect.objectContaining({ desde: '2026-10-01' }), 1))
})
