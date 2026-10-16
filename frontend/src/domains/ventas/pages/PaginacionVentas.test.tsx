import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import Clientes from './Clientes'
import Gastos from './Gastos'
import * as api from '../api'
// Unit tests never reach Supabase; without this, importing the real client throws when VITE_* env vars are absent (CI).
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('../api')
vi.mock('../../../lib/catalog', () => ({ obtenerSucursales: vi.fn().mockResolvedValue([]) }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerPaginaClientes).mockResolvedValue({ filas: [{ id: 'c1', nombre: 'Cliente visible', direccion: 'Calle 1' } as never], total: 301 })
  vi.mocked(api.obtenerPaginaGastos).mockResolvedValue({ filas: [{ id: 'g1', monto: 10, motivo: 'Gasto visible' } as never], total: 302 })
  vi.mocked(api.obtenerTotalGastosHoy).mockResolvedValue(9999)
  vi.mocked(api.jornadaGastos).mockReturnValue('2026-10-14')
})
it('paginates the cartera and exposes the exact total', async () => {
  renderWithProviders(<Clientes />)
  await screen.findAllByText('Cliente visible')
  expect(screen.getByRole('navigation', { name: 'Paginación de clientes' })).toHaveTextContent('301 registros')
  fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  await waitFor(() => expect(api.obtenerPaginaClientes).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), expect.anything(), 2))
})
it('paginates expenses without changing the complete daily total', async () => {
  renderWithProviders(<Gastos />)
  await screen.findByText('Gasto visible')
  expect(screen.getByText('Total: $ 9.999')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  await waitFor(() => expect(api.obtenerPaginaGastos).toHaveBeenLastCalledWith(expect.anything(), '2026-10-14', 2))
  expect(screen.getByText('Total: $ 9.999')).toBeInTheDocument()
})

it('shows empty expenses without pagination buttons and a separately valid zero total', async () => {
  vi.mocked(api.obtenerPaginaGastos).mockResolvedValue({ filas: [], total: 0 })
  vi.mocked(api.obtenerTotalGastosHoy).mockResolvedValue(0)
  renderWithProviders(<Gastos />)
  await screen.findByText('No has registrado gastos hoy.')
  expect(screen.getByText('Total: $ 0')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Página anterior' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Página siguiente' })).not.toBeInTheDocument()
})
