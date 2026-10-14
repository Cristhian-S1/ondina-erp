import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { makePerfil, renderWithProviders } from '@/test/render'
import Devoluciones from './Devoluciones'
import { focusManager } from '@tanstack/react-query'
import { AuthContext } from '@/context/auth-context'

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
    registrarDevolucion: vi.fn(),
    corregirDevolucion: vi.fn(),
    obtenerVendedores: vi.fn(),
    obtenerDespachos: vi.fn(),
    obtenerDetallesDespacho: vi.fn(),
    obtenerEnvasesDespacho: vi.fn(),
    obtenerDevolucionesProducto: vi.fn(),
    obtenerDevolucionesEnvase: vi.fn(),
    obtenerStockEnvases: vi.fn(),
    obtenerCargaVendedores: vi.fn(),
  }
})

import * as catalog from '@/lib/catalog'
import * as api from '@/domains/bodega/api'
import type { Perfil, Producto, Sucursal, TipoEmpaque } from '@/types'
import type { Despacho, DespachoDetalle } from '../types'

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

const empaque: TipoEmpaque = { id: 'te-1', nombre: 'Bandeja', categoria: 'uso_interno', activo: true }

// Fixture "de hoy": se construye con el reloj fijo activado en beforeEach (TEST-02)
const makeDespachoHoy = (): Despacho => ({
  id: 'd-1',
  sucursal_id: 'suc-1',
  vendedor_id: 'user-1',
  despachador_id: 'user-2',
  anulado: false,
  creado_por: 'user-2',
  creado_en: new Date().toISOString(),
  modificado_por: null,
  modificado_en: null,
})

const detalle: DespachoDetalle = {
  id: 'dd-1',
  despacho_id: 'd-1',
  producto_id: 'p-1',
  cantidad: 5,
  es_ajuste: false,
  creado_en: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  // Reloj fijo: el filtro "Hoy" y los fixtures no deben depender de la medianoche local (TEST-02)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T12:00:00'))

  vi.mocked(catalog.obtenerSucursales).mockResolvedValue([sucursal])
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto])
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([empaque])
  vi.mocked(api.obtenerVendedores).mockResolvedValue([vendedor])
  vi.mocked(api.obtenerDespachos).mockResolvedValue([])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([])
  vi.mocked(api.obtenerEnvasesDespacho).mockResolvedValue([])
  vi.mocked(api.obtenerDevolucionesProducto).mockResolvedValue([])
  vi.mocked(api.obtenerDevolucionesEnvase).mockResolvedValue([])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([])
  vi.mocked(api.obtenerCargaVendedores).mockResolvedValue([])
})

afterEach(() => {
  focusManager.setFocused(undefined)
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('HU-13 · Devoluciones', () => {
  it('muestra el estado vacío cuando no hay despachos para la sucursal', async () => {
    renderWithProviders(<Devoluciones />)
    await waitFor(() => {
      expect(screen.getByText(/Aún no hay despachos para esta sucursal/i)).toBeInTheDocument()
    })
  })

  it('lista los despachos del día con el estado pendiente', async () => {
    vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
    vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
    renderWithProviders(<Devoluciones />)
    await waitFor(() => {
      expect(screen.getAllByText('Ana López').length).toBeGreaterThan(0)
    })
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('al seleccionar un despacho muestra la tabla de productos a devolver', async () => {
    vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
    vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
    renderWithProviders(<Devoluciones />)
    await waitFor(() => {
      expect(screen.getAllByText('Ana López').length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getByRole('button', { name: /Ana López/i }))
    await waitFor(() => {
      expect(screen.getByText(/Devolución de Ana López/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Bidón POL')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Cantidad a devolver de Bidón POL' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: `Cantidad de envases buenos de ${empaque.nombre}` })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: `Cantidad de envases malos de ${empaque.nombre}` })).toBeInTheDocument()
  })
})


it('FE-05 · muestra errores de lectura y permite reintentar sin un falso estado vacío', async () => {
  vi.mocked(api.obtenerDespachos).mockRejectedValue(new Error('Fallo de consulta'))
  renderWithProviders(<Devoluciones />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar')
  vi.mocked(api.obtenerDespachos).mockResolvedValue([])
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
})

it('B3 · sends products and containers together and keeps the key after failure', async () => {
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  vi.mocked(api.registrarDevolucion).mockResolvedValueOnce({ error: 'No fue posible completar la operación. Inténtalo de nuevo.' }).mockResolvedValue({ error: null })
  renderWithProviders(<Devoluciones />)
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/i }))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad a devolver de Bidón POL' }), { target: { value: '2' } })
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad de envases buenos de Bandeja' }), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }))
  await screen.findByText('No fue posible completar la operación. Inténtalo de nuevo.')
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }))
  await waitFor(() => expect(api.registrarDevolucion).toHaveBeenCalledTimes(2))
  const [first, second] = vi.mocked(api.registrarDevolucion).mock.calls.map(([args]) => args)
  expect(first.lineas_producto).toEqual([{ producto_id: 'p-1', cantidad: 2 }])
  expect(first.lineas_envase).toEqual([{ tipo_empaque_id: 'te-1', cantidad: 1, estado: 'bueno' }])
  expect(second.idempotency_key).toBe(first.idempotency_key)
  await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Cantidad a devolver de Bidón POL' })).toHaveValue(null))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad a devolver de Bidón POL' }), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }))
  await waitFor(() => expect(api.registrarDevolucion).toHaveBeenCalledTimes(3))
  expect(vi.mocked(api.registrarDevolucion).mock.calls[2][0].idempotency_key).not.toBe(first.idempotency_key)
})

it('RB-11 · la corrección reenvía la misma clave tras un fallo sin usar el flujo de devolución', async () => {
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  vi.mocked(api.obtenerDevolucionesProducto).mockResolvedValue([
    { id: 'dev-1', despacho_id: 'd-1', producto_id: 'p-1', cantidad: 2, anulado: false, creado_por: 'user-1', creado_en: '2026-01-01T12:00:00Z' },
  ])
  vi.mocked(api.corregirDevolucion)
    .mockResolvedValueOnce({ error: 'No fue posible completar la operación. Inténtalo de nuevo.' })
    .mockResolvedValue({ error: null })
  renderWithProviders(<Devoluciones />, { perfil: makePerfil({ rol: 'administrador' }) })
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/i }))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad a devolver de Bidón POL' }), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
  await screen.findByText('No fue posible completar la operación. Inténtalo de nuevo.')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
  await waitFor(() => expect(api.corregirDevolucion).toHaveBeenCalledTimes(2))
  const [first, second] = vi.mocked(api.corregirDevolucion).mock.calls.map(([args]) => args)
  expect(first.idempotency_key).toEqual(expect.any(String))
  expect(second.idempotency_key).toBe(first.idempotency_key)
  expect(api.registrarDevolucion).not.toHaveBeenCalled()
})

describe('Accesibilidad · filtros de Devoluciones', () => {
  it('nombra el filtro de fecha y de vendedor, y el día activo cumple 44 px', async () => {
    renderWithProviders(<Devoluciones />, { perfil: makePerfil({ rol: 'administrador' }) })
    expect(await screen.findByLabelText('Fecha')).toHaveAttribute('type', 'date')
    expect(screen.getByRole('combobox', { name: 'Filtrar por vendedor' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveClass('min-h-11')
  })
})


describe('B1 · aislamiento de sucursal y estados', () => {
  it.each(['éxito', 'error'])('A→B→A descarta la respuesta B tardía de %s', async (resultado) => {
    let resolver!: (data: Despacho[]) => void
    let rechazar!: (error: Error) => void
    const pendienteB = new Promise<Despacho[]>((res, rej) => { resolver = res; rechazar = rej })
    vi.mocked(catalog.obtenerSucursales).mockResolvedValue([sucursal, { ...sucursal, id: 'suc-2', nombre: 'Sur' }])
    vi.mocked(api.obtenerDespachos).mockImplementation((id) => id === 'suc-2' ? pendienteB : Promise.resolve([makeDespachoHoy()]))
    vi.mocked(api.obtenerVendedores).mockImplementation((id) => Promise.resolve([{ ...vendedor, nombres: id === 'suc-2' ? 'Bruno' : 'Ana' }]))
    renderWithProviders(<Devoluciones />, { perfil: makePerfil({ rol: 'administrador' }) })
    await screen.findByRole('button', { name: /Ana López/ })
    fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: 'suc-2' } })
    expect(screen.queryByRole('button', { name: /Ana López/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Cargando/)
    fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: 'suc-1' } })
    await screen.findByRole('button', { name: /Ana López/ })
    await act(async () => {
      if (resultado === 'éxito') resolver([{ ...makeDespachoHoy(), id: 'despacho-b', sucursal_id: 'suc-2' }])
      else rechazar(new Error('Fallo B tardío'))
    })
    expect(screen.getByLabelText('Sucursal')).toHaveValue('suc-1')
    expect(screen.getByRole('button', { name: /Ana López/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bruno/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('anuncia carga y vacío sin presentarlos como un error', async () => {
    renderWithProviders(<Devoluciones />)
    expect(screen.getByRole('status')).toHaveTextContent(/Cargando/)
    const vacio = await screen.findByText(/Aún no hay despachos para esta sucursal/)
    expect(vacio.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('identifica un despacho cuyo vendedor ya no está disponible', async () => {
    vi.mocked(api.obtenerVendedores).mockResolvedValue([])
    vi.mocked(api.obtenerDespachos).mockResolvedValue([{ ...makeDespachoHoy(), id: 'abc12345-despacho' }])
    renderWithProviders(<Devoluciones />)
    const fila = await screen.findByRole('button', { name: /Vendedor no disponible/ })
    expect(fila).toHaveTextContent('abc12345')
    expect(fila).toHaveTextContent(/\d{2}:\d{2}/)
    expect(screen.queryByText('Desconocido')).not.toBeInTheDocument()
  })

  it('Hoy cambia al reanudar después de medianoche en Santiago', async () => {
    vi.setSystemTime(new Date('2026-10-14T02:59:59Z'))
    vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
    renderWithProviders(<Devoluciones />)
    await screen.findByRole('button', { name: /Ana López/ })
    await act(async () => {
      vi.setSystemTime(new Date('2026-10-14T03:00:01Z'))
      fireEvent.focus(window)
    })
    expect(await screen.findByText(/No hay despachos para el día/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ana López/ })).not.toBeInTheDocument()
  })
})

it('B1 · permite recorrer las tablas del detalle en regiones con nombre', async () => {
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  renderWithProviders(<Devoluciones />)
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
  for (const nombre of ['Productos del despacho', 'Envases del despacho']) {
    const region = screen.getByRole('region', { name: nombre })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveClass('overflow-x-auto')
  }
})


it('B1 · descarta lectura y borrador de la identidad anterior', async () => {
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  let resolver!: (data: Despacho[]) => void
  const pendiente = new Promise<Despacho[]>((res) => { resolver = res })
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  const contenido = (id: string) => (
    <AuthContext.Provider value={{ perfil: makePerfil({ id, rol: 'administrador' }), loading: false, signIn: async () => {}, signOut: async () => {} }}>
      <Devoluciones />
    </AuthContext.Provider>
  )
  const { rerender } = renderWithProviders(contenido('primera'))
  await screen.findByRole('button', { name: /Ana López/ })
  fireEvent.click(screen.getByRole('button', { name: /Ana López/ }))
  fireEvent.change(screen.getByRole('spinbutton', { name: /Cantidad a devolver/ }), { target: { value: '1' } })
  vi.mocked(api.obtenerDespachos).mockReturnValueOnce(pendiente).mockResolvedValue([])
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true) })
  await waitFor(() => expect(api.obtenerDespachos).toHaveBeenCalledTimes(2))
  rerender(contenido('segunda'))
  await screen.findByText(/Aún no hay despachos para esta sucursal/)
  await act(async () => { resolver([makeDespachoHoy()]) })
  expect(screen.queryByRole('button', { name: /Ana López/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('spinbutton', { name: /Cantidad a devolver/ })).not.toBeInTheDocument()
})
