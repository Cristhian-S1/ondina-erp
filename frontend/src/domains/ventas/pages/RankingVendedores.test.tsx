import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
import RankingVendedores from './RankingVendedores'
import { obtenerRankingVendedores } from '../api'
import type { RankingVendedor } from '../api'

vi.mock('../api', () => ({ obtenerRankingVendedores: vi.fn() }))

function fila(n: number, extra: Partial<RankingVendedor> = {}): RankingVendedor {
  return {
    vendedor_id: `u-${n}`, sucursal_id: 's-1', vendedor: `Vendedor ${n}`,
    mes: '2026-10-01', cantidad_ventas: 10 - n, total_vendido: 10000 * (10 - n), ...extra,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // 31-oct 22:00 Chile = 01-nov 01:00 UTC: el mes de Santiago sigue siendo octubre
  vi.setSystemTime(new Date('2026-11-01T01:00:00Z'))
  vi.mocked(obtenerRankingVendedores).mockReset()
})
afterEach(() => vi.useRealTimers())

describe('RankingVendedores', () => {
  it('consulta el mes de Santiago a fin de mes (22:00 en Chile)', async () => {
    vi.mocked(obtenerRankingVendedores).mockResolvedValue([])
    renderWithProviders(<RankingVendedores />)
    await waitFor(() => expect(obtenerRankingVendedores).toHaveBeenCalledWith('2026-10'))
    expect(screen.getByRole('heading', { level: 1, name: 'Ranking de vendedores' })).toBeInTheDocument()
    expect(await screen.findByText(/No hay ventas registradas/)).toBeInTheDocument()
  })

  it('muestra cargando con role="status"', () => {
    vi.mocked(obtenerRankingVendedores).mockReturnValue(new Promise(() => {}))
    renderWithProviders(<RankingVendedores />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando ranking...')
  })

  it('muestra error con role="alert" y reintenta', async () => {
    vi.mocked(obtenerRankingVendedores).mockRejectedValueOnce(new Error('SQL privado')).mockResolvedValue([fila(1)])
    renderWithProviders(<RankingVendedores />)
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No fue posible cargar el ranking de vendedores.')
    expect(alerta).not.toHaveTextContent('SQL')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Vendedor 1')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('cambiar el mes consulta el período elegido', async () => {
    vi.mocked(obtenerRankingVendedores).mockResolvedValue([])
    renderWithProviders(<RankingVendedores />)
    await screen.findByText(/No hay ventas/)
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '3' } })
    await waitFor(() => expect(obtenerRankingVendedores).toHaveBeenCalledWith('2026-03'))
  })

  it('no permite elegir meses futuros', async () => {
    vi.mocked(obtenerRankingVendedores).mockResolvedValue([])
    renderWithProviders(<RankingVendedores />)
    await screen.findByText(/No hay ventas/)
    expect(screen.getByRole('option', { name: 'Noviembre' })).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Octubre' })).toBeEnabled()
  })

  it('R3-04: permite períodos históricos anteriores a cuatro años', async () => {
    vi.mocked(obtenerRankingVendedores).mockResolvedValue([])
    renderWithProviders(<RankingVendedores />)
    await screen.findByText(/No hay ventas/)
    expect(screen.getByRole('option', { name: '2022' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2022' } })
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '12' } })
    await waitFor(() => expect(obtenerRankingVendedores).toHaveBeenCalledWith('2022-12'))
    expect(screen.getByRole('option', { name: 'Diciembre' })).toBeEnabled()
  })

  it('R3-04: al volver al año actual ajusta diciembre al mes actual', async () => {
    vi.mocked(obtenerRankingVendedores).mockResolvedValue([])
    renderWithProviders(<RankingVendedores />)
    await screen.findByText(/No hay ventas/)
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2022' } })
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } })
    await waitFor(() => expect(obtenerRankingVendedores).toHaveBeenCalledWith('2026-10'))
  })

  it('destaca a la usuaria actual y conserva nombres largos truncados', async () => {
    const largo = 'Nombre extremadamente largo '.repeat(6)
    vi.mocked(obtenerRankingVendedores).mockResolvedValue([fila(1), fila(2, { vendedor: largo }), fila(3), fila(4), fila(5, { vendedor_id: 'user-1' })])
    renderWithProviders(<RankingVendedores />, { perfil: makePerfil({ id: 'user-1' }) })
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items[4]).toHaveAttribute('aria-current', 'true')
    expect(items[0]).not.toHaveAttribute('aria-current')
    expect(screen.getByText(largo.trim())).toHaveClass('truncate')
  })
})
