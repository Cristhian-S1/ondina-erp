import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
import RegistrarCliente from './RegistrarCliente'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/domains/ventas/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/ventas/api')>()
  return {
    ...actual,
    obtenerVendedoresSucursal: vi.fn().mockResolvedValue([]),
    crearCliente: vi.fn(),
  }
})

import * as api from '@/domains/ventas/api'

const PERFIL = makePerfil({ id: 'vendedor-1' })

afterEach(() => {
  vi.mocked(api.crearCliente).mockReset()
  vi.mocked(api.obtenerVendedoresSucursal).mockReset().mockResolvedValue([])
})

function setup() {
  vi.mocked(api.crearCliente).mockResolvedValue({ error: null })
}

async function renderModal() {
  setup()
  renderWithProviders(<RegistrarCliente open={true} onClose={() => {}} />, { perfil: PERFIL })
  await waitFor(() => {
    expect(screen.getByText('Nuevo cliente')).toBeInTheDocument()
  })
}

function setNativeValue(el: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  nativeSetter?.call(el, value)
  fireEvent.change(el)
}

describe('HU-02 · RegistrarCliente — validación de formulario', () => {
  it('muestra error si el nombre está vacío', async () => {
    await renderModal()

    const direccionInput = screen.getByPlaceholderText('Calle, número, comuna') as HTMLInputElement
    setNativeValue(direccionInput, 'Calle 1')

    fireEvent.click(screen.getByRole('button', { name: /Guardar cliente/i }))

    await waitFor(() => {
      expect(screen.getByText(/Ingresa el nombre/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('muestra error si la dirección está vacía', async () => {
    await renderModal()

    const nombreInput = screen.getByPlaceholderText('Nombre o razón comercial') as HTMLInputElement
    setNativeValue(nombreInput, 'Doña María')

    fireEvent.click(screen.getByRole('button', { name: /Guardar cliente/i }))

    await waitFor(() => {
      expect(screen.getByText(/Ingresa la dirección/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('muestra Toast verde al registrar exitosamente', async () => {
    await renderModal()

    const nombreInput = screen.getByPlaceholderText('Nombre o razón comercial') as HTMLInputElement
    const direccionInput = screen.getByPlaceholderText('Calle, número, comuna') as HTMLInputElement

    setNativeValue(nombreInput, 'Doña María')
    setNativeValue(direccionInput, 'Calle 1')

    fireEvent.click(screen.getByRole('button', { name: /Guardar cliente/i }))

    await waitFor(() => {
      expect(api.crearCliente).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByText('Cliente registrado.')).toBeInTheDocument()
    })
  })
})


it('FE-05 · muestra error de vendedores sin borrar los datos del cliente', async () => {
  let rechazar!: (cause: Error) => void
  vi.mocked(api.obtenerVendedoresSucursal).mockReturnValue(new Promise((_res, rej) => { rechazar = rej }))
  renderWithProviders(<RegistrarCliente open={true} onClose={() => {}} sucursalId="suc-1" />, { perfil: makePerfil({ rol: 'administrador' }) })
  fireEvent.change(screen.getByPlaceholderText('Nombre o razón comercial'), { target: { value: 'Almacén Sur' } })
  const { act } = await import('@testing-library/react')
  await act(async () => { rechazar(new Error('Fallo de consulta')) })
  expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar los vendedores')
  expect(screen.getByPlaceholderText('Nombre o razón comercial')).toHaveValue('Almacén Sur')
  expect(screen.getByRole('button', { name: 'Guardar cliente' })).toBeDisabled()
})
