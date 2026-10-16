import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makePerfil, renderWithProviders } from '@/test/render'
import Clientes from './Clientes'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/domains/ventas/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/ventas/api')>()
  return {
    ...actual,
    obtenerPaginaClientes: vi.fn(async (perfil: Parameters<typeof api.obtenerClientesRuta>[0], sucursal?: string, vendedor?: string) => { const filas = await api.obtenerClientesRuta(perfil, sucursal, vendedor); return { filas, total: filas.length } }), obtenerClientesRuta: vi.fn(),
    obtenerVendedoresSucursal: vi.fn().mockResolvedValue([]),
    crearCliente: vi.fn().mockResolvedValue({ error: null }),
  }
})

import * as api from '@/domains/ventas/api'

afterEach(() => {
  vi.mocked(api.obtenerClientesRuta).mockReset()
})

function setup(data: Awaited<ReturnType<typeof api.obtenerClientesRuta>>) {
  vi.mocked(api.obtenerClientesRuta).mockResolvedValue(data)
}

describe('HU-04 · Clientes', () => {
  it.each(['Nuevo cliente', 'Registrar primer cliente'])('moves focus into the dialog from %s and restores it after Escape', async (name) => {
    setup([])
    renderWithProviders(<Clientes />)
    await screen.findByText('No tienes clientes en tu ruta.')
    const opener = screen.getByRole('button', { name })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Nuevo cliente' })
    expect(dialog).toHaveAttribute('open')
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(within(dialog).getByRole('textbox', { name: 'Nombre' })).toBeInTheDocument()
    // Escape is delivered to native dialogs as a cancel event by the browser.
    fireEvent(dialog, new Event('cancel', { cancelable: true }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    fireEvent.click(opener)
    expect(screen.getByRole('dialog', { name: 'Nuevo cliente' })).toHaveAttribute('open')
  })

  it('FB-02 · el primer registro de un vendedor muestra el aviso y cierra el diálogo', async () => {
    setup([])
    renderWithProviders(<Clientes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo cliente' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Almacén Sur' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Dirección' }), { target: { value: 'Calle 1' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cliente' }))

    expect(await screen.findByText('Cliente registrado.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 })
    expect(api.crearCliente).toHaveBeenCalledTimes(1)
  })

  it('muestra el estado vacío cuando la cartera no tiene clientes', async () => {
    setup([])
    renderWithProviders(<Clientes />)
    await waitFor(() => {
      expect(screen.getByText(/No tienes clientes en tu ruta/i)).toBeInTheDocument()
    })
  })

  it('renderiza los nombres de los clientes existentes', async () => {
    setup([
      {
        id: 'c1', nombre: 'Doña María', telefono: null, direccion: 'Calle 1',
        numero_local: null, tipo: 'minorista', activo: true, creado_en: '2026-01-01T00:00:00Z',
      },
      {
        id: 'c2', nombre: 'Don José', telefono: '555', direccion: 'Calle 2',
        numero_local: 'A', tipo: 'mayorista', activo: true, creado_en: '2026-01-02T00:00:00Z',
      },
    ])
    renderWithProviders(<Clientes />)
    await waitFor(() => {
      expect(screen.getAllByText('Doña María').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Don José').length).toBeGreaterThan(0)
    })
  })

  it('UX-15 · vendedor ve "tu ruta"; administrador ve copy de cartera por vendedor con etiquetas visibles', async () => {
    setup([])
    const { unmount } = renderWithProviders(<Clientes />)
    expect(screen.getByText('Cartera de clientes de tu ruta.')).toBeInTheDocument()
    await screen.findByText('No tienes clientes en tu ruta.')
    unmount()
    renderWithProviders(<Clientes />, { perfil: makePerfil({ rol: 'administrador' }) })
    expect(screen.queryByText(/tu ruta/)).not.toBeInTheDocument()
    expect(screen.getByText(/elige sucursal y vendedor/)).toBeInTheDocument()
    expect(screen.getByLabelText('Sucursal')).toBeVisible()
    expect(screen.getByLabelText('Vendedor responsable')).toBeVisible()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('muestra error de cartera con Reintentar y fechas en dd-mm-aaaa', async () => {
    vi.mocked(api.obtenerClientesRuta).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([
      { id: 'c1', nombre: 'Doña María', telefono: null, direccion: 'Calle 1', tipo: 'minorista', numero_local: null, creado_en: '2026-01-14T23:30:00-03:00' } as never,
    ])
    renderWithProviders(<Clientes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findAllByText('14-01-2026')).not.toHaveLength(0)
  })
})
