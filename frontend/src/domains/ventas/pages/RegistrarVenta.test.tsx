import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
import RegistrarVenta from './RegistrarVenta'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/domains/ventas/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/ventas/api')>()
  return {
    ...actual,
    obtenerClientesRuta: vi.fn(),
    obtenerProductosVenta: vi.fn(),
    obtenerCargaVendedor: vi.fn(),
    registrarVenta: vi.fn(),
  }
})

import * as api from '@/domains/ventas/api'

const PERFIL = makePerfil({ id: 'vendedor-1' })

const PRODUCTOS = [
  { id: 'p1', nombre: 'Bidón POL', tipo: 'agua', tipo_empaque_id: 't1', precio_base: 1000, activo: true, creado_en: '2026-01-01T00:00:00Z', tipo_empaque: { id: 't1', nombre: 'Bidón 20L', categoria: 'retornable' } },
  { id: 'p2', nombre: 'Bidón PET', tipo: 'agua', tipo_empaque_id: 't1', precio_base: 1000, activo: true, creado_en: '2026-01-01T00:00:00Z', tipo_empaque: { id: 't1', nombre: 'Bidón 20L', categoria: 'retornable' } },
  { id: 'p3', nombre: 'Hielo CUBO', tipo: 'hielo', tipo_empaque_id: 't2', precio_base: 400, activo: true, creado_en: '2026-01-01T00:00:00Z', tipo_empaque: { id: 't2', nombre: 'Bolsa 2kg', categoria: 'desechable' } },
]

const CARGA = [
  { producto_id: 'p1', vendedor_id: 'vendedor-1', cantidad: 1000, modificado_en: '2026-01-01T00:00:00Z', producto: { id: 'p1', nombre: 'Bidón POL', tipo: 'agua', precio_base: 1000 } },
  { producto_id: 'p2', vendedor_id: 'vendedor-1', cantidad: 1000, modificado_en: '2026-01-01T00:00:00Z', producto: { id: 'p2', nombre: 'Bidón PET', tipo: 'agua', precio_base: 1000 } },
  { producto_id: 'p3', vendedor_id: 'vendedor-1', cantidad: 1000, modificado_en: '2026-01-01T00:00:00Z', producto: { id: 'p3', nombre: 'Hielo CUBO', tipo: 'hielo', precio_base: 400 } },
]

const CLIENTES = [
  { id: 'c1', nombre: 'Doña María', telefono: null, direccion: 'Calle 1', numero_local: null, tipo: 'minorista', activo: true, creado_en: '2026-01-01T00:00:00Z' },
]

afterEach(() => {
  vi.mocked(api.obtenerClientesRuta).mockReset()
  vi.mocked(api.obtenerProductosVenta).mockReset()
  vi.mocked(api.obtenerCargaVendedor).mockReset()
  vi.mocked(api.registrarVenta).mockReset()
  sessionStorage.clear()
})

function setup() {
  vi.mocked(api.obtenerClientesRuta).mockResolvedValue(CLIENTES)
  vi.mocked(api.obtenerProductosVenta).mockResolvedValue(PRODUCTOS)
  vi.mocked(api.obtenerCargaVendedor).mockResolvedValue(CARGA)
  vi.mocked(api.registrarVenta).mockResolvedValue({ id: 'venta-123', error: null })
}

async function renderForm() {
  setup()
  renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
  await waitFor(() => {
    expect(screen.getByText('Registrar venta')).toBeInTheDocument()
  })
  await waitFor(() => {
    const options = screen.getAllByRole('option')
    expect(options.some((o) => o.textContent?.includes('Bidón POL'))).toBe(true)
  })
}

function setNativeValue(el: HTMLSelectElement | HTMLInputElement, value: string) {
  const proto = el instanceof HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  nativeSetter?.call(el, value)
  fireEvent.change(el)
}

describe('HU-01 · RegistrarVenta — productos duplicados', () => {
  it('deshabilita productos ya seleccionados en otras filas', async () => {
    await renderForm()

    const selects = screen.getAllByRole('combobox')
    // selects[0] = cliente, selects[1..3] = productos, selects[4] = metodoPago
    const row0Select = selects[1] as HTMLSelectElement
    const row1Select = selects[2] as HTMLSelectElement

    // Row 0 should have Bidón POL selected by default
    const row0Options = within(row0Select).getAllByRole('option') as HTMLOptionElement[]
    const polOptionRow0 = row0Options.find((o) => o.textContent?.includes('Bidón POL'))
    expect(polOptionRow0).toBeTruthy()
    expect(polOptionRow0!.selected).toBe(true)

    // Row 1 should have Bidón POL disabled (already selected in row 0)
    const row1Options = within(row1Select).getAllByRole('option') as HTMLOptionElement[]
    const polInRow1 = row1Options.find((o) => o.textContent?.includes('Bidón POL'))
    expect(polInRow1).toBeTruthy()
    expect(polInRow1!.disabled).toBe(true)
  })

  it('actualiza disponible al cambiar producto dinámicamente', async () => {
    await renderForm()

    const selects = screen.getAllByRole('combobox')
    const row0Select = selects[1] as HTMLSelectElement

    setNativeValue(row0Select, 'p2')

    await waitFor(() => {
      expect(screen.getAllByText('1000').length).toBeGreaterThan(0)
    })
  })
})

describe('HU-01 · RegistrarVenta — cantidad 0', () => {
  it('no envía detalles con cantidad 0 al backend', async () => {
    await renderForm()

    const selects = screen.getAllByRole('combobox')
    const clienteSelect = selects[0] as HTMLSelectElement
    setNativeValue(clienteSelect, 'c1')

    // The first 3 spinbuttons are cantidades for the 3 product rows
    const cantidadInputs = screen.getAllByRole('spinbutton')
    const row0Cantidad = cantidadInputs[0] as HTMLInputElement
    setNativeValue(row0Cantidad, '5')

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Confirmar venta/i }) as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })

    fireEvent.click(screen.getByRole('button', { name: /Confirmar venta/i }))

    await waitFor(() => {
      expect(api.registrarVenta).toHaveBeenCalledTimes(1)
    }, { timeout: 8000 })

    const callArgs = vi.mocked(api.registrarVenta).mock.calls[0][0]
    const detallesEnviados = callArgs.p_detalles
    expect(detallesEnviados.every((d) => d.cantidad > 0)).toBe(true)
    expect(detallesEnviados.filter((d) => d.cantidad === 0).length).toBe(0)
  })
})

describe('HU-01 · RegistrarVenta — máximo 6 productos', () => {
  it('deshabilita el botón Agregar producto al llegar a 6 filas', async () => {
    await renderForm()

    // Empezamos con 3 filas (POL/PET/CUBO). Agregamos 3 más para llegar a 6.
    const agregarBtn = screen.getByRole('button', { name: /Agregar producto/i })
    expect((agregarBtn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(agregarBtn)
    fireEvent.click(agregarBtn)
    fireEvent.click(agregarBtn)

    await waitFor(() => {
      expect((agregarBtn as HTMLButtonElement).disabled).toBe(true)
    })

    // Debe mostrar el mensaje de límite
    expect(screen.getByText(/Máximo 6 productos por venta/i)).toBeInTheDocument()
  })
})

describe('HU-01 · RegistrarVenta — Toast sin productos válidos', () => {
  it('muestra Toast de error al submit sin productos con cantidad > 0', async () => {
    await renderForm()

    const selects = screen.getAllByRole('combobox')
    const clienteSelect = selects[0] as HTMLSelectElement
    setNativeValue(clienteSelect, 'c1')

    // No ingresar cantidades (todas quedan en 0)
    fireEvent.click(screen.getByRole('button', { name: /Confirmar venta/i }))

    await waitFor(() => {
      expect(screen.getByText(/al menos un producto con cantidad mayor a 0/i)).toBeInTheDocument()
    })
  })
})
