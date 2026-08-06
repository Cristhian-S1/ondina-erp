import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import Ventas from './Ventas'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/domains/ventas/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/ventas/api')>()
  return {
    ...actual,
    obtenerCargaVendedor: vi.fn(),
    obtenerBidonesVacios: vi.fn(),
  }
})

import * as api from '@/domains/ventas/api'

afterEach(() => {
  vi.mocked(api.obtenerCargaVendedor).mockReset()
  vi.mocked(api.obtenerBidonesVacios).mockReset()
})

describe('HU-05 · Ventas (resumen) — envases recibidos hoy', () => {
  it('muestra el mensaje vacío cuando no hay envases registrados', async () => {
    vi.mocked(api.obtenerCargaVendedor).mockResolvedValue([])
    vi.mocked(api.obtenerBidonesVacios).mockResolvedValue([])
    renderWithProviders(<Ventas />)
    await waitFor(() => {
      expect(
        screen.getByText(/No has registrado envases recibidos hoy/i),
      ).toBeInTheDocument()
    })
  })
})