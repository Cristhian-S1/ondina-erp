import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
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

function RegistrationExample() {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)}>Registrar cliente</button>
    <RegistrarCliente open={open} onClose={() => setOpen(false)} />
  </>
}

describe('RegistrarCliente · accessible dialog', () => {
  it.each(['Escape', 'Cerrar', 'Cancelar'])('moves focus inside and returns it to the opener after %s', (action) => {
    setup()
    renderWithProviders(<RegistrationExample />, { perfil: PERFIL })
    const opener = screen.getByRole('button', { name: 'Registrar cliente' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Nuevo cliente' })
    expect(dialog).toHaveAttribute('open')
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Almacén Sur' } })
    if (action === 'Escape') {
      // Browsers translate Escape into the native cancel event.
      fireEvent(dialog, new Event('cancel', { cancelable: true }))
    } else {
      fireEvent.click(within(dialog).getByRole('button', { name: action }))
    }

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(api.crearCliente).not.toHaveBeenCalled()
    fireEvent.click(opener)
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Nombre' })).toHaveValue('')
  })
})

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

it('A1-12 · errores describen controles con nombre estable y RHF enfoca el primero', async () => {
  await renderModal()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }))
  await screen.findByText('Ingresa el nombre')
  for (const nombre of ['Nombre', 'Dirección']) {
    const campo = screen.getByRole('textbox', { name: nombre, exact: true })
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    const descripcion = document.getElementById(campo.getAttribute('aria-describedby')!)!
    expect(descripcion).toBeInTheDocument()
    expect((campo as HTMLInputElement).labels?.[0]).not.toContainElement(descripcion)
    expect(campo).toHaveClass('border-red-400')
  }
  expect(screen.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveFocus()
})

it('UX-21 · teléfono prepara teclado y autocompletado, nombre capitaliza palabras', async () => {
  await renderModal()
  const telefono = screen.getByRole('textbox', { name: 'Teléfono' })
  expect(telefono).toHaveAttribute('type', 'tel')
  expect(telefono).toHaveAttribute('inputmode', 'tel')
  expect(telefono).toHaveAttribute('autocomplete', 'tel')
  expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveAttribute('autocapitalize', 'words')
})


it('FX2 R4-06 · éxito bloquea Guardar hasta cerrar y no duplica clientes', async () => {
  await renderModal()
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cliente único' } })
  fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Calle 123' } })
  const guardar = screen.getByRole('button', { name: 'Guardar cliente' })
  fireEvent.click(guardar)
  await screen.findByText('Cliente registrado.')
  expect(guardar).toBeDisabled()
  fireEvent.click(guardar)
  expect(api.crearCliente).toHaveBeenCalledTimes(1)
})


it('FX2 R4-06 · doble clic antes de resolver la creación envía una sola petición', async () => {
  let resolver!: (value: { error: string | null }) => void
  vi.mocked(api.crearCliente).mockReturnValueOnce(new Promise(r => { resolver = r }))
  renderWithProviders(<RegistrarCliente open={true} onClose={() => {}} />, { perfil: PERFIL })
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cliente único' } })
  fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Calle 123' } })
  const guardar = screen.getByRole('button', { name: 'Guardar cliente' })
  fireEvent.click(guardar)
  fireEvent.click(guardar)
  await waitFor(() => expect(api.crearCliente).toHaveBeenCalledTimes(1))
  resolver({ error: null })
  await screen.findByText('Cliente registrado.')
  expect(guardar).toBeDisabled()
})
