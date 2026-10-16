import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders as render } from '../../../test/render'
import ProduccionReciente from './ProduccionReciente'
import { obtenerHistorialProduccion } from '../api'

vi.mock('../api', () => ({ TAMANO_PRODUCCION: 10, obtenerPaginaHistorial: vi.fn(async (filtros: Parameters<typeof obtenerHistorialProduccion>[0]) => { const filas = await obtenerHistorialProduccion(filtros); return { filas, total: filas.length } }), obtenerHistorialProduccion: vi.fn() }))
const productos = [{ id: 'p1', nombre: 'Hielo 5kg', activo: true }, { id: 'p2', nombre: 'Agua 20L', activo: true }] as never
const recientes = [{ id: 'r1', producto_id: 'p1', cantidad: 10, creado_en: '2026-10-13T15:00:00Z', observaciones: null }] as never
beforeEach(() => vi.clearAllMocks())

describe('F3 · ProduccionReciente', () => {
  it('sin filtros muestra la lista reciente sin consultar el historial', () => {
    render(<ProduccionReciente perfilId="u" sucursalId="s" productos={productos} recientes={recientes} />)
    expect(screen.getByText('Hielo 5kg', { selector: 'td' })).toBeInTheDocument()
    expect(obtenerHistorialProduccion).not.toHaveBeenCalled()
  })

  it('filtra por producto y fechas con la consulta de historial', async () => {
    vi.mocked(obtenerHistorialProduccion).mockResolvedValue([])
    render(<ProduccionReciente perfilId="u" sucursalId="s" productos={productos} recientes={recientes} />)
    fireEvent.change(screen.getByLabelText('Filtrar por producto'), { target: { value: 'p2' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } })
    await waitFor(() => expect(obtenerHistorialProduccion).toHaveBeenLastCalledWith(expect.objectContaining({ sucursalId: 's', productoId: 'p2', desde: '2026-10-01' })))
    expect(await screen.findByText('No hay producciones para los filtros seleccionados.')).toBeInTheDocument()
  })

  it('limpiar filtros vuelve a la lista reciente', async () => {
    vi.mocked(obtenerHistorialProduccion).mockResolvedValue([])
    render(<ProduccionReciente perfilId="u" sucursalId="s" productos={productos} recientes={recientes} />)
    fireEvent.change(screen.getByLabelText('Filtrar por producto'), { target: { value: 'p2' } })
    await screen.findByText(/No hay producciones para los filtros/)
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(await screen.findByText('Hielo 5kg', { selector: 'td' })).toBeInTheDocument()
  })

  it('el contenedor de la lista tiene alto propio con desplazamiento en escritorio', () => {
    render(<ProduccionReciente perfilId="u" sucursalId="s" productos={productos} recientes={recientes} />)
    expect(screen.getByTestId('lista-produccion-reciente').className).toMatch(/xl:max-h-/)
    expect(screen.getByTestId('lista-produccion-reciente').className).toMatch(/xl:overflow-y-auto/)
  })
})

describe('M1 · tarjetas por registro', () => {
  it('muestra una tarjeta por registro con fecha destacada y producto como título', () => {
    const dos = [...(recientes as unknown as object[]), { id: 'r2', producto_id: 'p2', cantidad: 1500, creado_en: '2026-10-13T16:00:00Z', observaciones: null }] as never
    render(<ProduccionReciente perfilId="u" sucursalId="s" productos={productos} recientes={dos} />)
    const tarjetas = screen.getAllByTestId('tarjeta-registro')
    expect(tarjetas).toHaveLength(2)
    expect(tarjetas[1]).toHaveTextContent('Agua 20L')
    expect(tarjetas[1]).toHaveTextContent('1.500')
  })
})
