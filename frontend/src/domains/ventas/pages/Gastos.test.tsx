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
  it('no llama crearGasto si el monto está vacío', async () => {
    await renderGastos()

    const motivoInput = screen.getByPlaceholderText('Descripción breve') as HTMLInputElement
    setNativeValue(motivoInput, 'Bencina')
    fireEvent.click(screen.getByRole('button', { name: /Registrar gasto/i }))

    await waitFor(() => {
      expect(api.crearGasto).not.toHaveBeenCalled()
    })
  })

  it('no llama crearGasto si el motivo está vacío', async () => {
    await renderGastos()

    const inputs = screen.getAllByRole('spinbutton')
    const montoInput = inputs[0] as HTMLInputElement
    setNativeValue(montoInput, '5000')
    fireEvent.click(screen.getByRole('button', { name: /Registrar gasto/i }))

    await waitFor(() => {
      expect(api.crearGasto).not.toHaveBeenCalled()
    })
  })

  it('muestra Toast verde al registrar exitosamente', async () => {
    await renderGastos()

    const inputs = screen.getAllByRole('spinbutton')
    const montoInput = inputs[0] as HTMLInputElement
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
