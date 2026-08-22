import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import Despachos from './Despachos'

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
    obtenerVendedores: vi.fn(),
    obtenerDespachos: vi.fn(),
    obtenerDetallesDespacho: vi.fn(),
    obtenerEnvasesDespacho: vi.fn(),
    obtenerDevolucionesProducto: vi.fn(),
    obtenerDevolucionesEnvase: vi.fn(),
    obtenerStockBodega: vi.fn(),
    obtenerStockEnvases: vi.fn(),
    obtenerCargaVendedores: vi.fn(),
    crearDespacho: vi.fn(),
  }
})

import * as catalog from '@/lib/catalog'
import * as api from '@/domains/bodega/api'
import type { Perfil, Producto, Sucursal, TipoEmpaque } from '@/types'
import type { Despacho, DespachoDetalle, StockBodega, StockEnvases } from '../types'

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

const vendedor: Perfil = {
  id: 'user-1',
  sucursal_id: 'suc-1',
  nombres: 'Ana',
  apellidos: 'López',
  rut: null,
  telefono: null,
  rol: 'vendedor',
  activo: true,
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

const despachoHoy: Despacho = {
  id: 'd-1',
  sucursal_id: 'suc-1',
  vendedor_id: 'user-1',
  despachador_id: 'user-2',
  anulado: false,
  creado_por: 'user-2',
  creado_en: new Date().toISOString(),
  modificado_por: null,
  modificado_en: null,
}

const hielo: Producto = {
  id: 'p-hielo',
  nombre: 'Hielo en Bolsa 1kg',
  tipo: 'hielo',
  tipo_empaque_id: null,
  precio_base: 1200,
  activo: true,
  creado_en: '2026-01-01T00:00:00Z',
}

const bandeja: TipoEmpaque = {
  id: 'te-1',
  nombre: 'Bandeja',
  categoria: 'uso_interno',
  activo: true,
}

const stockHielo: StockBodega = {
  sucursal_id: 'suc-1',
  producto_id: 'p-hielo',
  cantidad: 100,
  modificado_en: '2026-01-01T00:00:00Z',
}

const stockBandeja: StockEnvases = {
  sucursal_id: 'suc-1',
  tipo_empaque_id: 'te-1',
  cantidad: 40,
  modificado_en: '2026-01-01T00:00:00Z',
}

const detalle: DespachoDetalle = {
  id: 'dd-1',
  despacho_id: 'd-1',
  producto_id: 'p-1',
  cantidad: 5,
  es_ajuste: false,
  creado_en: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.mocked(catalog.obtenerSucursales).mockResolvedValue([sucursal])
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto])
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([])
  vi.mocked(api.obtenerVendedores).mockResolvedValue([vendedor])
  vi.mocked(api.obtenerDespachos).mockResolvedValue([])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([])
  vi.mocked(api.obtenerEnvasesDespacho).mockResolvedValue([])
  vi.mocked(api.obtenerDevolucionesProducto).mockResolvedValue([])
  vi.mocked(api.obtenerDevolucionesEnvase).mockResolvedValue([])
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([])
  vi.mocked(api.obtenerCargaVendedores).mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('HU-13 · Despachos', () => {
  it('muestra el estado vacío cuando no hay despachos para la sucursal', async () => {
    renderWithProviders(<Despachos />)
    await waitFor(() => {
      expect(screen.getByText(/Aún no hay despachos para esta sucursal/i)).toBeInTheDocument()
    })
  })

  it('renderiza los despachos del día con el total de unidades del vendedor', async () => {
    vi.mocked(api.obtenerDespachos).mockResolvedValue([despachoHoy])
    vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
    renderWithProviders(<Despachos />)
    await waitFor(() => {
      expect(screen.getAllByText('Ana López').length).toBeGreaterThan(0)
    })
    expect(screen.getByText('5 unid.')).toBeInTheDocument()
  })
})

describe('HU-13 · Nuevo despacho', () => {
  async function abrirModal() {
    renderWithProviders(<Despachos />)
    await waitFor(() => {
      expect(screen.getByText(/Aún no hay despachos para esta sucursal/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo despacho' }))
  }

  it('no permite elegir el mismo producto en dos filas', async () => {
    await abrirModal()
    const selectsIniciales = screen.getAllByLabelText(/Producto/)
    fireEvent.change(selectsIniciales[0], { target: { value: producto.id } })

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar producto' }))

    const selects = screen.getAllByLabelText(/Producto/)
    expect(selects).toHaveLength(2)
    expect(within(selects[1]).getByRole('option', { name: /Bidón POL/ })).toBeDisabled()
    expect(within(selects[0]).getByRole('option', { name: /Bidón POL/ })).not.toBeDisabled()
  })

  it('autocompleta las bandejas según el hielo del despacho y permite editarlas', async () => {
    vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
    vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([bandeja])
    vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
    vi.mocked(api.obtenerStockEnvases).mockResolvedValue([stockBandeja])

    await abrirModal()

    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: hielo.id } })
    const inputCantidad = screen.getByLabelText('Cantidad')
    fireEvent.change(inputCantidad, { target: { value: '15' } })

    expect(screen.getByLabelText('Bandejas')).toHaveValue(2)

    fireEvent.change(screen.getByLabelText('Bandejas'), { target: { value: '3' } })
    expect(screen.getByLabelText('Bandejas')).toHaveValue(3)
    expect(screen.getByText('Sugerido: 2')).toBeInTheDocument()

    fireEvent.change(inputCantidad, { target: { value: '40' } })
    expect(screen.getByLabelText('Bandejas')).toHaveValue(4)
    expect(screen.queryByText('Sugerido: 2')).not.toBeInTheDocument()
  })

  it('envía la bandeja como envase al registrar el despacho', async () => {
    vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
    vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([bandeja])
    vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
    vi.mocked(api.obtenerStockEnvases).mockResolvedValue([stockBandeja])
    vi.mocked(api.crearDespacho).mockResolvedValue({ error: null })

    await abrirModal()
    fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: vendedor.id } })
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: hielo.id } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))

    await waitFor(() => {
      expect(api.crearDespacho).toHaveBeenCalledWith(
        expect.objectContaining({
          lineas: [{ producto_id: hielo.id, cantidad: 20 }],
          envases: [{ tipo_empaque_id: bandeja.id, cantidad: 2 }],
        }),
      )
    })
  })

  it('deja las bandejas vacías cuando el despacho no lleva hielo', async () => {
    vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([bandeja])

    await abrirModal()

    expect(screen.getByLabelText('Bandejas')).toHaveValue(null)
  })
})
