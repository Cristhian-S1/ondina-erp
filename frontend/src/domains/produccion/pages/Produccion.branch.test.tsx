import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { makePerfil, renderWithProviders } from '@/test/render'
import Produccion from './Produccion'

vi.mock('@/lib/supabase', () => ({ supabase: { channel: vi.fn() } }))
vi.mock('@/lib/catalog', () => ({ obtenerProductos: vi.fn(), obtenerTiposEmpaque: vi.fn() }))
vi.mock('../api', () => ({ obtenerEnvasesDisponibles: vi.fn(), obtenerMermas: vi.fn(), obtenerProducciones: vi.fn(), registrarMerma: vi.fn(), registrarProduccion: vi.fn() }))

describe('Producción operational branch', () => {
  it('shows an explicit message instead of loading forever without a branch', async () => {
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
    expect(await screen.findByRole('alert')).toHaveTextContent(/asignar o seleccionar una sucursal operativa/i)
    expect(screen.queryByText('Cargando información...')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar producción' })).not.toBeInTheDocument()
  })
})
