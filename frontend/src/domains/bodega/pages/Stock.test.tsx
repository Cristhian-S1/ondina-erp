import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import Stock from './Stock'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>()
  return {
    ...actual,
    obtenerProductos: vi.fn(),
    obtenerSucursales: vi.fn(),
    obtenerTiposEmpaque: vi.fn(),
  }
})
vi.mock('@/domains/bodega/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/bodega/api')>()
  return {
    ...actual,
    obtenerStockBodega: vi.fn(),
    obtenerStockEnvases: vi.fn(),
  }
})

import * as catalog from '@/lib/catalog'
import * as api from '@/domains/bodega/api'
import type { Producto, Sucursal, TipoEmpaque } from '@/types'
import type { StockBodega, StockEnvases } from '../types'

const sucursal: Sucursal = {
  id: 'suc-1',
  nombre: 'Matriz',
  direccion: null,
  comuna: null,
  region: null,
  telefono: null,
  activa: true,
  creado_en: '2026-01-01T00:00:00Z',
}

const producto: Producto = {
  id: 'p-1',
  nombre: 'Bidón POL',
  tipo: 'agua',
  tipo_empaque_id: null,
  precio_base: 1000,
  activo: true,
  creado_en: '2026-01-01T00:00:00Z',
}

const empaque: TipoEmpaque = { id: 'te-1', nombre: 'Bandeja', categoria: 'uso_interno', activo: true }

const stockProductos: StockBodega[] = [
  { sucursal_id: 'suc-1', producto_id: 'p-1', cantidad: 30, modificado_en: '2026-01-01T00:00:00Z' },
]

const stockEnvases: StockEnvases[] = [
  { sucursal_id: 'suc-1', tipo_empaque_id: 'te-1', cantidad: 12, modificado_en: '2026-01-01T00:00:00Z' },
]

beforeEach(() => {
  vi.mocked(catalog.obtenerSucursales).mockResolvedValue([sucursal])
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto])
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([empaque])
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('HU-13 · Stock', () => {
  it('muestra el estado vacío cuando no hay stock de productos', async () => {
    renderWithProviders(<Stock />)
    await waitFor(() => {
      expect(screen.getByText(/Sin registros de stock de productos/i)).toBeInTheDocument()
    })
  })

  it('renderiza los productos en bodega con su cantidad', async () => {
    vi.mocked(api.obtenerStockBodega).mockResolvedValue(stockProductos)
    renderWithProviders(<Stock />)
    await waitFor(() => {
      expect(screen.getByText('Bidón POL')).toBeInTheDocument()
      expect(screen.getByText('30')).toBeInTheDocument()
    })
  })

  it('cambia a la pestaña de envases y muestra su stock', async () => {
    vi.mocked(api.obtenerStockBodega).mockResolvedValue(stockProductos)
    vi.mocked(api.obtenerStockEnvases).mockResolvedValue(stockEnvases)
    renderWithProviders(<Stock />)
    await waitFor(() => {
      expect(screen.getByText('Bidón POL')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Envases' }))
    await waitFor(() => {
      expect(screen.getByText('Bandeja')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument()
    })
  })
})
