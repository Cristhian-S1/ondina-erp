import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import Clientes from './Clientes'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/domains/ventas/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/ventas/api')>()
  return {
    ...actual,
    obtenerClientesRuta: vi.fn(),
    obtenerVendedoresSucursal: vi.fn().mockResolvedValue([]),
    crearCliente: vi.fn().mockResolvedValue({ error: null }),
  }
})

import * as api from '@/domains/ventas/api'

afterEach(() => {
  vi.mocked(api.obtenerClientesRuta).mockReset()
})

function setup(data: Awaited<ReturnType<typeof api.obtenerClientesRuta>>) {
  vi.mocked(api.obtenerClientesRuta).mockResolvedValue(data)
}

describe('HU-04 · Clientes', () => {
  it('muestra el estado vacío cuando la cartera no tiene clientes', async () => {
    setup([])
    renderWithProviders(<Clientes />)
    await waitFor(() => {
      expect(screen.getByText(/No tienes clientes en tu ruta/i)).toBeInTheDocument()
    })
  })

  it('renderiza los nombres de los clientes existentes', async () => {
    setup([
      {
        id: 'c1', nombre: 'Doña María', telefono: null, direccion: 'Calle 1',
        numero_local: null, tipo: 'minorista', activo: true, creado_en: '2026-01-01T00:00:00Z',
      },
      {
        id: 'c2', nombre: 'Don José', telefono: '555', direccion: 'Calle 2',
        numero_local: 'A', tipo: 'mayorista', activo: true, creado_en: '2026-01-02T00:00:00Z',
      },
    ])
    renderWithProviders(<Clientes />)
    await waitFor(() => {
      expect(screen.getAllByText('Doña María').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Don José').length).toBeGreaterThan(0)
    })
  })
})