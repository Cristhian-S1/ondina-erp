import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
import Gastos from './Gastos'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/domains/ventas/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/ventas/api')>()
  return {
    ...actual,
    obtenerGastosHoy: vi.fn(),
    crearGasto: vi.fn(),
  }
})

import * as api from '@/domains/ventas/api'

const PERFIL = makePerfil({ id: 'vendedor-1' })

afterEach(() => {
  vi.mocked(api.obtenerGastosHoy).mockReset()
  vi.mocked(api.crearGasto).mockReset()
})

function setup() {
  vi.mocked(api.obtenerGastosHoy).mockResolvedValue([])
  vi.mocked(api.crearGasto).mockResolvedValue({ error: null })
}

async function renderGastos() {
  setup()
  renderWithProviders(<Gastos />, { perfil: PERFIL })
  await waitFor(() => {
    expect(screen.getByText('Gastos extras')).toBeInTheDocument()
  })
}

function setNativeValue(el: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  nativeSetter?.call(el, value)
  fireEvent.change(el)
}

describe('HU-07 · Gastos — validación de formulario', () => {
  it('muestra error si el monto está vacío', async () => {
    await renderGastos()

    const motivoInput = screen.getByPlaceholderText('Descripción breve') as HTMLInputElement
    setNativeValue(motivoInput, 'Bencina')
    fireEvent.click(screen.getByRole('button', { name: /Registrar gasto/i }))

    await waitFor(() => {
      expect(screen.getByText(/El monto debe ser mayor a 0/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('muestra error si el motivo está vacío', async () => {
    await renderGastos()

    const montoInput = screen.getByLabelText(/Monto \(CLP\)/i) as HTMLInputElement
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo', exact: true }), { target: { value: 'combustible' } })
    setNativeValue(montoInput, '5000')
    fireEvent.click(screen.getByRole('button', { name: /Registrar gasto/i }))

    await waitFor(() => {
      expect(screen.getByText(/Ingresa el motivo/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('muestra Toast verde al registrar exitosamente', async () => {
    await renderGastos()

    const montoInput = screen.getByLabelText(/Monto \(CLP\)/i) as HTMLInputElement
    const motivoInput = screen.getByPlaceholderText('Descripción breve') as HTMLInputElement

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo', exact: true }), { target: { value: 'combustible' } })
    setNativeValue(montoInput, '5000')
    setNativeValue(motivoInput, 'Bencina')

    fireEvent.click(screen.getByRole('button', { name: /Registrar gasto/i }))

    await waitFor(() => {
      expect(api.crearGasto).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByText('Gasto registrado.')).toBeInTheDocument()
    })
  })
})


it('FE-05 · conserva los datos ingresados si falla la lectura del historial', async () => {
  let rechazar!: (cause: Error) => void
  vi.mocked(api.obtenerGastosHoy).mockReturnValue(new Promise((_res, rej) => { rechazar = rej }))
  renderWithProviders(<Gastos />, { perfil: PERFIL })
  fireEvent.change(screen.getByPlaceholderText('Descripción breve'), { target: { value: 'Bencina de la ruta' } })
  const { act } = await import('@testing-library/react')
  await act(async () => { rechazar(new Error('Fallo de consulta')) })
  expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar los gastos de hoy')
  expect(screen.getByPlaceholderText('Descripción breve')).toHaveValue('Bencina de la ruta')
  expect(screen.queryByText('No has registrado gastos hoy.')).not.toBeInTheDocument()
  expect(screen.getByText('Total: —')).toBeInTheDocument()
})

it('UX-17/A1-12 · exige elegir tipo y enlaza todos los errores con nombres estables', async () => {
  await renderGastos()
  expect(screen.getByRole('combobox', { name: 'Tipo', exact: true })).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }))
  await screen.findByText('Selecciona el tipo de gasto')
  for (const nombre of ['Tipo', 'Monto (CLP)', 'Motivo']) {
    const campo = screen.getByLabelText(nombre, { exact: true })
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(campo.getAttribute('aria-describedby')!)).toBeInTheDocument()
    expect(campo).toHaveClass('border-red-400')
  }
  expect(screen.getByLabelText('Tipo', { exact: true })).toHaveFocus()
  expect(api.crearGasto).not.toHaveBeenCalled()
})

it('UX-17 · historial y total muestran moneda chilena con símbolo y miles', async () => {
  setup()
  vi.mocked(api.obtenerGastosHoy).mockResolvedValue([{ id: 'g1', monto: 5000, motivo: 'Bencina', tipo: 'combustible', anulado: false, creado_en: '2026-10-13T02:15:59Z', creado_por: 'vendedor-1', vendedor_id: 'vendedor-1', sucursal_id: 's1' }])
  renderWithProviders(<Gastos />, { perfil: PERFIL })
  expect(await screen.findByText('Total: $ 5.000')).toBeInTheDocument()
  expect(screen.getByText('$ 5.000', { exact: true })).toBeInTheDocument()
})

it('UX-17 · monto editable indica pesos y conserva miles al ingresar', async () => {
  await renderGastos()
  const monto = screen.getByLabelText('Monto (CLP)')
  expect(monto.parentElement).toHaveTextContent('$')
  fireEvent.change(monto, { target: { value: '12500' } })
  expect(monto).toHaveValue('12.500')
})

it('A1-13 · reintenta el historial sin reenviar gastos ni borrar el formulario', async () => {
  setup()
  vi.mocked(api.obtenerGastosHoy).mockRejectedValueOnce(new Error('fallo')).mockResolvedValue([])
  renderWithProviders(<Gastos />, { perfil: PERFIL })
  fireEvent.change(screen.getByPlaceholderText('Descripción breve'), { target: { value: 'Bencina pendiente' } })
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByText('No has registrado gastos hoy.')
  expect(screen.getByPlaceholderText('Descripción breve')).toHaveValue('Bencina pendiente')
  expect(api.crearGasto).not.toHaveBeenCalled()
})
