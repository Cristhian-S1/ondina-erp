import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import Carga from './Carga'
import Ventas from './Ventas'

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

describe('FE-05 / FE-12 · carga disponible', () => {
  it.each([Carga, Ventas])('muestra carga agotada si todas las filas tienen cantidad cero (%s)', async (Pagina) => {
    vi.mocked(api.obtenerCargaVendedor).mockResolvedValue([
      { producto_id: 'p1', vendedor_id: 'user-1', cantidad: 0, modificado_en: '2026-01-01T00:00:00Z', producto: null },
    ])
    renderWithProviders(<Pagina />)
    expect(await screen.findByText(/Carga agotada/)).toBeInTheDocument()
    expect(screen.queryByText(/Aún no se te ha asignado/)).not.toBeInTheDocument()
  })

  it.each([Carga, Ventas])('muestra error en vez de carga vacía cuando falla la lectura (%s)', async (Pagina) => {
    vi.mocked(api.obtenerCargaVendedor).mockRejectedValue(new Error('Fallo de consulta'))
    renderWithProviders(<Pagina />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar tu carga')
    expect(screen.queryByText(/Aún no se te ha asignado|Carga agotada/)).not.toBeInTheDocument()
  })

  it('permite reintentar con Actualizar y recuperar la carga', async () => {
    vi.mocked(api.obtenerCargaVendedor).mockRejectedValueOnce(new Error('Fallo de consulta')).mockResolvedValueOnce([])
    renderWithProviders(<Carga />)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByText(/Aún no se te ha asignado/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
