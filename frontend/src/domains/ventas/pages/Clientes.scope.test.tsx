import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makePerfil, renderWithProviders } from '@/test/render'
import Clientes from './Clientes'
import * as api from '../api'

vi.mock('@/lib/catalog', () => ({ obtenerSucursales: vi.fn().mockResolvedValue([{ id: 's1', nombre: 'Norte' }, { id: 's2', nombre: 'Sur' }]) }))
vi.mock('../api', () => ({ obtenerClientesRuta: vi.fn(), obtenerVendedoresSucursal: vi.fn(), crearCliente: vi.fn() }))
const vendedor = { id: 'v1', nombres: 'Ana', apellidos: 'López' }
const cliente = { id: 'c1', nombre: 'Almacén Sur', direccion: 'Calle 1', telefono: null, numero_local: null, tipo: 'minorista', activo: true, creado_en: '2026-01-01' }
const admin = makePerfil({ rol: 'administrador', sucursal_id: null })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerClientesRuta).mockResolvedValue([])
  vi.mocked(api.obtenerVendedoresSucursal).mockImplementation(async id => id === 's1' ? [vendedor] : [{ id: 'v2', nombres: 'Pedro', apellidos: 'Sur' }])
  vi.mocked(api.crearCliente).mockResolvedValue({ error: null })
})

async function selectScope() {
  await screen.findByRole('option', { name: 'Norte' })
  fireEvent.change(screen.getByRole('combobox', { name: 'Sucursal' }), { target: { value: 's1' } })
  await screen.findByRole('option', { name: 'Ana López' })
  fireEvent.change(screen.getByRole('combobox', { name: 'Vendedor responsable' }), { target: { value: 'v1' } })
}

describe('Administrator customer scope', () => {
  it('keeps the selected seller in the dialog and restores focus after Escape', async () => {
    renderWithProviders(<Clientes />, { perfil: admin })
    await selectScope()
    await screen.findByText('No tienes clientes en tu ruta.')
    const opener = screen.getByRole('button', { name: 'Nuevo cliente' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Nuevo cliente' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(within(dialog).getByRole('combobox', { name: 'Vendedor responsable' })).toHaveValue('v1')
    expect(within(dialog).queryByRole('combobox', { name: 'Sucursal' })).not.toBeInTheDocument()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(screen.getByRole('combobox', { name: 'Sucursal' })).toHaveValue('s1')
    expect(screen.getByRole('combobox', { name: 'Vendedor responsable' })).toHaveValue('v1')
  })

  it('requires sucursal and vendedor before querying, even with an assigned branch', async () => {
    renderWithProviders(<Clientes />, { perfil: makePerfil({ rol: 'administrador' }) })
    expect(screen.getByText(/Selecciona una sucursal y un vendedor para consultar/)).toBeInTheDocument()
    expect(screen.queryByText('No tienes clientes en tu ruta.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeDisabled()
    await screen.findByRole('option', { name: 'Norte' })
    expect(screen.getByRole('combobox', { name: 'Sucursal' })).toHaveValue('')
    expect(api.obtenerClientesRuta).not.toHaveBeenCalled()
    expect(api.obtenerVendedoresSucursal).not.toHaveBeenCalled()
    await selectScope()
    await screen.findByText('No tienes clientes en tu ruta.')
    expect(api.obtenerClientesRuta).toHaveBeenCalledWith(expect.objectContaining({ rol: 'administrador' }), 's1', 'v1')
  })

  it('creates for the selected seller and immediately refreshes that portfolio', async () => {
    renderWithProviders(<Clientes />, { perfil: admin })
    await selectScope()
    await screen.findByText('No tienes clientes en tu ruta.')
    vi.mocked(api.crearCliente).mockImplementation(async () => {
      vi.mocked(api.obtenerClientesRuta).mockResolvedValue([cliente])
      return { error: null }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    fireEvent.change(screen.getByPlaceholderText('Nombre o razón comercial'), { target: { value: cliente.nombre } })
    fireEvent.change(screen.getByPlaceholderText('Calle, número, comuna'), { target: { value: cliente.direccion } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    await waitFor(() => expect(api.crearCliente).toHaveBeenCalledWith(expect.objectContaining({ sucursal_id: 's1', vendedor_id: 'v1', creado_por: admin.id })))
    expect((await screen.findAllByText(cliente.nombre)).length).toBeGreaterThan(0)
    expect(api.obtenerClientesRuta).toHaveBeenLastCalledWith(admin, 's1', 'v1')
    expect(screen.getByText('Cliente registrado.')).toBeInTheDocument()
  })

  it('clears seller selection and ignores the old response after a branch change', async () => {
    let resolve!: (value: typeof cliente[]) => void
    vi.mocked(api.obtenerClientesRuta).mockImplementation((_perfil, sucursal) => sucursal === 's1' ? new Promise(r => { resolve = r }) : Promise.resolve([]))
    renderWithProviders(<Clientes />, { perfil: admin })
    await selectScope()
    fireEvent.change(screen.getByRole('combobox', { name: 'Sucursal' }), { target: { value: 's2' } })
    expect(screen.getByRole('combobox', { name: 'Vendedor responsable' })).toHaveValue('')
    await screen.findByRole('option', { name: 'Pedro Sur' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Vendedor responsable' }), { target: { value: 'v2' } })
    await screen.findByText('No tienes clientes en tu ruta.')
    await act(async () => { resolve([cliente]) })
    expect(screen.queryByText(cliente.nombre)).not.toBeInTheDocument()
    expect(api.obtenerClientesRuta).toHaveBeenLastCalledWith(admin, 's2', 'v2')
  })

  it('distinguishes a seller query error and allows retry', async () => {
    vi.mocked(api.obtenerVendedoresSucursal).mockRejectedValue(new Error('Network'))
    renderWithProviders(<Clientes />, { perfil: admin })
    await screen.findByRole('option', { name: 'Norte' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Sucursal' }), { target: { value: 's1' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar los vendedores')
    expect(screen.queryByText('No hay vendedores activos en esta sucursal.')).not.toBeInTheDocument()
    vi.mocked(api.obtenerVendedoresSucursal).mockResolvedValue([vendedor])
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar vendedores' }))
    await screen.findByRole('option', { name: 'Ana López' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('distinguishes an empty seller list', async () => {
    vi.mocked(api.obtenerVendedoresSucursal).mockResolvedValue([])
    renderWithProviders(<Clientes />, { perfil: admin })
    await screen.findByRole('option', { name: 'Norte' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Sucursal' }), { target: { value: 's1' } })
    expect(await screen.findByText('No hay vendedores activos en esta sucursal.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps vendedores on their own portfolio without selectors', async () => {
    const perfil = makePerfil({ id: 'vendedor-1', sucursal_id: 's1' })
    renderWithProviders(<Clientes />, { perfil })
    await screen.findByText('No tienes clientes en tu ruta.')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(api.obtenerClientesRuta).toHaveBeenCalledWith(perfil, 's1', 'vendedor-1')
  })
})
