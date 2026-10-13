import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
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


describe('FE-05 / FE-06 · lectura de stock', () => {
  it('muestra error de stock y permite recuperar la lectura con Actualizar', async () => {
    vi.mocked(api.obtenerStockBodega).mockRejectedValueOnce(new Error('Fallo de consulta')).mockResolvedValueOnce(stockProductos)
    renderWithProviders(<Stock />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar el stock')
    expect(screen.queryByText(/Sin registros/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByText('30')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('muestra error del catálogo y permite reintentarlo', async () => {
    vi.mocked(catalog.obtenerProductos).mockRejectedValueOnce(new Error('Fallo de consulta')).mockResolvedValueOnce([producto])
    renderWithProviders(<Stock />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar los catálogos')
    expect(screen.queryByText(/Sin registros/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByText(/Sin registros de stock de productos/)).toBeInTheDocument()
  })

  it.each(['éxito', 'error'])('ignora una respuesta anterior de %s al cambiar de sucursal', async (resultado) => {
    let resolver!: (data: StockBodega[]) => void
    let rechazar!: (cause: Error) => void
    const anterior = new Promise<StockBodega[]>((res, rej) => { resolver = res; rechazar = rej })
    vi.mocked(catalog.obtenerSucursales).mockResolvedValue([sucursal, { ...sucursal, id: 'suc-2', nombre: 'Sur' }])
    vi.mocked(api.obtenerStockBodega).mockImplementation((id) => id === 'suc-1' ? anterior : Promise.resolve([{ ...stockProductos[0], sucursal_id: 'suc-2', cantidad: 55 }]))
    renderWithProviders(<Stock />, { perfil: makePerfil({ rol: 'administrador' }) })
    fireEvent.change(await screen.findByLabelText('Sucursal'), { target: { value: 'suc-2' } })
    expect(await screen.findByText('55')).toBeInTheDocument()
    await act(async () => {
      if (resultado === 'éxito') resolver(stockProductos)
      else rechazar(new Error('Fallo anterior'))
    })
    expect(screen.getByText('55')).toBeInTheDocument()
    expect(screen.queryByText('30')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})


it('FE-06 · descarta la respuesta pendiente al quitar la sucursal y libera Actualizar', async () => {
  let resolver!: (data: StockBodega[]) => void
  vi.mocked(api.obtenerStockBodega).mockReturnValue(new Promise((res) => { resolver = res }))
  renderWithProviders(<Stock />, { perfil: makePerfil({ rol: 'administrador' }) })
  fireEvent.change(await screen.findByLabelText('Sucursal'), { target: { value: '' } })
  await act(async () => { resolver(stockProductos) })
  expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled()
  expect(screen.queryByText('30')).not.toBeInTheDocument()
})
