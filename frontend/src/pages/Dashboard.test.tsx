import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePerfil, renderWithProviders } from '@/test/render'
import { obtenerSucursalDashboard } from '@/lib/dashboard'
import Dashboard from './Dashboard'

vi.mock('@/lib/dashboard', () => ({ obtenerSucursalDashboard: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
describe('Dashboard branch query', () => {
  it('shows loading, then a safe error and retries successfully', async () => {
    vi.mocked(obtenerSucursalDashboard).mockRejectedValueOnce(new Error('private SQL'))
      .mockResolvedValueOnce({ id: 'suc-1', nombre: 'Matriz' } as Awaited<ReturnType<typeof obtenerSucursalDashboard>>)
    renderWithProviders(<Dashboard />)
    expect(screen.getByText('Cargando sucursal...')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar la sucursal')
    expect(screen.queryByText('Cargando sucursal...')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect((await screen.findAllByText('Matriz')).length).toBe(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('does not fetch without a branch', () => {
    renderWithProviders(<Dashboard />, { perfil: makePerfil({ sucursal_id: null }) })
    expect(obtenerSucursalDashboard).not.toHaveBeenCalled()
    expect(screen.getAllByText('Todas las sucursales')).toHaveLength(2)
  })
})
