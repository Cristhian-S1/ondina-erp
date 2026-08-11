import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import Carga from './Carga'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/domains/ventas/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/ventas/api')>()
  return {
    ...actual,
    obtenerCargaVendedor: vi.fn(),
  }
})

import * as api from '@/domains/ventas/api'

afterEach(() => {
  vi.mocked(api.obtenerCargaVendedor).mockReset()
})

describe('HU-03 · Carga', () => {
  it('muestra el estado vacío cuando no hay carga asignada', async () => {
    vi.mocked(api.obtenerCargaVendedor).mockResolvedValue([])
    renderWithProviders(<Carga />)
    await waitFor(() => {
      expect(screen.getByText(/Aún no se te ha asignado carga hoy/i)).toBeInTheDocument()
    })
  })

  it('renderiza tarjetas de productos cuando hay carga', async () => {
    vi.mocked(api.obtenerCargaVendedor).mockResolvedValue([
      {
        producto_id: 'p1', vendedor_id: 'user-1', cantidad: 24, modificado_en: '2026-01-01T00:00:00Z',
        producto: { id: 'p1', nombre: 'Bidón 20L', tipo: 'agua', precio_base: 3000 },
      },
    ])
    renderWithProviders(<Carga />)
    await waitFor(() => {
      expect(screen.getByText('Bidón 20L')).toBeInTheDocument()
      expect(screen.getByText('24')).toBeInTheDocument()
    })
  })
})