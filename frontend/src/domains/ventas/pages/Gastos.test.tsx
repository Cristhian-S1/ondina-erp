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
