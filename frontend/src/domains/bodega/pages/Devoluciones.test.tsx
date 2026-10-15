import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
    obtenerPaginaDespachos: vi.fn(),
    obtenerDespacho: vi.fn(),
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
  vi.mocked(api.obtenerPaginaDespachos).mockImplementation(async (sucursalId, opciones) => {
    const filas = (await api.obtenerDespachos(sucursalId)).filter(d =>
      (!opciones.vendedorId || d.vendedor_id === opciones.vendedorId) &&
      (!opciones.desde || d.creado_en >= opciones.desde) && (!opciones.hasta || d.creado_en < opciones.hasta))
    return { filas, total: filas.length }
  })
  vi.mocked(api.obtenerDespacho).mockImplementation(async (_sucursalId, id) => [{ ...makeDespachoHoy(), id }])

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

it('C3-04 · etiqueta lo devuelto y oculta disponibilidad cuando productos ya fueron devueltos', async () => {
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  vi.mocked(api.obtenerDevolucionesProducto).mockResolvedValue([
    { id: 'dev-1', despacho_id: 'd-1', producto_id: 'p-1', cantidad: 1, anulado: false,
      creado_por: 'user-2', creado_en: '2026-10-13T12:00:00Z' },
  ])
  renderWithProviders(<Devoluciones />)
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
  const region = screen.getByRole('region', { name: 'Productos del despacho' })
  expect(within(region).getByText('Ya devueltos')).toBeInTheDocument()
  const fila = within(region).getByTestId('fila-devolucion-producto')
  expect(fila).toHaveTextContent('Despachado 5')
  expect(fila).toHaveTextContent('Devuelto 1')
  expect(fila).not.toHaveTextContent('Disponible')
  expect(within(fila).queryByRole('textbox')).not.toBeInTheDocument()
})

describe('HU-13 · Devoluciones', () => {
  it('muestra el estado vacío cuando no hay despachos para la sucursal', async () => {
    renderWithProviders(<Devoluciones />)
    await waitFor(() => {
      expect(screen.getByText(/No hay despachos para el día y vendedor seleccionados/i)).toBeInTheDocument()
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
    expect(screen.getByRole('textbox', { name: 'Cantidad a devolver de Bidón POL' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: `Cantidad de envases buenos de ${empaque.nombre}` })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: `Cantidad de envases malos de ${empaque.nombre}` })).toBeInTheDocument()
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
  vi.mocked(api.obtenerEnvasesDespacho).mockResolvedValue([{ id: 'de-1', despacho_id: 'd-1', tipo_empaque_id: empaque.id, cantidad: 1, es_ajuste: false, creado_en: '2026-01-01T00:00:00Z' }])
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  vi.mocked(api.registrarDevolucion).mockResolvedValueOnce({ error: 'No fue posible completar la operación. Inténtalo de nuevo.' }).mockResolvedValue({ error: null })
  renderWithProviders(<Devoluciones />)
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/i }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Cantidad a devolver de Bidón POL' }), { target: { value: '2' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Cantidad de envases buenos de Bandeja' }), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }))
  await screen.findByText('No fue posible completar la operación. Inténtalo de nuevo.')
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }))
  await waitFor(() => expect(api.registrarDevolucion).toHaveBeenCalledTimes(2))
  const [first, second] = vi.mocked(api.registrarDevolucion).mock.calls.map(([args]) => args)
  expect(first.lineas_producto).toEqual([{ producto_id: 'p-1', cantidad: 2 }])
  expect(first.lineas_envase).toEqual([{ tipo_empaque_id: 'te-1', cantidad: 1, estado: 'bueno' }])
  expect(second.idempotency_key).toBe(first.idempotency_key)
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Cantidad a devolver de Bidón POL' })).toHaveValue(''))
  fireEvent.change(screen.getByRole('textbox', { name: 'Cantidad a devolver de Bidón POL' }), { target: { value: '2' } })
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
  fireEvent.change(screen.getByRole('textbox', { name: 'Cantidad a devolver de Bidón POL' }), { target: { value: '1' } })
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
    const vacio = await screen.findByText(/No hay despachos para el día y vendedor seleccionados/)
    expect(vacio.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('identifica un despacho cuyo vendedor ya no está disponible', async () => {
    vi.mocked(api.obtenerVendedores).mockResolvedValue([])
    vi.mocked(api.obtenerDespachos).mockResolvedValue([{ ...makeDespachoHoy(), id: 'abc12345-despacho' }])
    renderWithProviders(<Devoluciones />)
    const fila = await screen.findByRole('button', { name: /Vendedor no disponible/ })
    expect(fila).toHaveTextContent('Despacho #abc12345')
    expect(fila).toHaveTextContent('Vendedor no disponible · ref. user-1')
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
    expect(await screen.findByText(/No hay despachos para el día|No hay despachos para el día/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ana López/ })).not.toBeInTheDocument()
  })
})

it('M2 · distingue Productos del despacho y Envases en secciones con encabezado, conteo y filas compactas', async () => {
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  renderWithProviders(<Devoluciones />)
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
  const productos = screen.getByRole('region', { name: 'Productos del despacho' })
  const envases = screen.getByRole('region', { name: 'Envases' })
  expect(productos).toHaveAttribute('data-tono', 'producto')
  expect(envases).toHaveAttribute('data-tono', 'envase')
  expect(productos.className).not.toBe(envases.className)
  expect(within(productos).getByText('1 línea')).toBeInTheDocument()
  expect(within(envases).getByText(/líneas?$/)).toBeInTheDocument()
  const fila = within(productos).getByTestId('fila-devolucion-producto')
  expect(fila).toHaveTextContent('Bidón POL')
  expect(fila).toHaveTextContent(/Disponible\s*\d/)
  expect(within(fila).getByLabelText('Cantidad a devolver de Bidón POL').closest('.w-36')).not.toBeNull()
  expect(within(envases).getAllByTestId('fila-devolucion-envase').length).toBeGreaterThan(0)
  expect(within(envases).getAllByText('Buenos').length).toBeGreaterThan(0)
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
  fireEvent.change(screen.getByRole('textbox', { name: /Cantidad a devolver/ }), { target: { value: '1' } })
  vi.mocked(api.obtenerDespachos).mockReturnValueOnce(pendiente).mockResolvedValue([])
  vi.setSystemTime(new Date(Date.now() + 31000))
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true) })
  await waitFor(() => expect(api.obtenerDespachos).toHaveBeenCalledTimes(2))
  rerender(contenido('segunda'))
  await screen.findByText(/No hay despachos para el día y vendedor seleccionados/)
  await act(async () => { resolver([makeDespachoHoy()]) })
  expect(screen.queryByRole('button', { name: /Ana López/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: /Cantidad a devolver/ })).not.toBeInTheDocument()
})


it('FX R1-02/13 · conserva detalle y borrador tras fallo; tarjeta usa el mismo control', async () => {
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  renderWithProviders(<Devoluciones />)
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
  const campo = screen.getByLabelText('Cantidad a devolver de Bidón POL')
  fireEvent.change(campo, { target: { value: '2' } })
  expect(campo.closest('li')).toHaveAttribute('data-testid', 'fila-devolucion-producto')
  vi.mocked(api.obtenerDespachos).mockRejectedValueOnce(new Error('Sin red'))
  vi.setSystemTime(new Date(Date.now() + 31000))
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true) })
  await screen.findByText(/No fue posible actualizar/)
  expect(screen.getByLabelText('Cantidad a devolver de Bidón POL')).toBe(campo)
  expect(campo).toHaveValue('2')
  expect(screen.getAllByLabelText('Cantidad a devolver de Bidón POL')).toHaveLength(1)
})

it('FX R1-06 · devolución bloquea el ámbito mientras la RPC está en vuelo', async () => {
  let resolver!: (value: { error: string | null }) => void
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  vi.mocked(api.registrarDevolucion).mockReturnValueOnce(new Promise(r => { resolver = r }))
  renderWithProviders(<Devoluciones />, { perfil: makePerfil({ rol: 'administrador' }) })
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
  fireEvent.change(screen.getByLabelText('Cantidad a devolver de Bidón POL'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }))
  expect(screen.getByLabelText('Sucursal')).toBeDisabled()
  await act(async () => resolver({ error: 'No fue posible completar la operación. Inténtalo de nuevo.' }))
  expect(screen.getByRole('alert')).toHaveTextContent('No fue posible completar')
  expect(screen.getByLabelText('Sucursal')).not.toBeDisabled()
})


it('FX2 R4-09 · ayuda neutra describe la cantidad sin error antes de ingresar datos', async () => {
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  renderWithProviders(<Devoluciones />)
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
  const campo = screen.getByLabelText('Cantidad a devolver de Bidón POL')
  expect(campo).toHaveAttribute('aria-describedby', 'ayuda-devolucion-cantidad')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('No puedes devolver más de lo despachado por producto.')).not.toBeInTheDocument()
  fireEvent.change(campo, { target: { value: '6' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No puedes devolver más de 5')
  expect(campo).toHaveAttribute('aria-invalid','true')
})

async function abrirDevolucionF2(admin = false) {
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  renderWithProviders(<Devoluciones />, { perfil: makePerfil({ rol: admin ? 'administrador' : 'bodega' }) })
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/i }))
}

it('F2 · devolución de producto valida el saldo en tiempo real y rechaza letras', async () => {
  await abrirDevolucionF2()
  const cantidad = screen.getByLabelText('Cantidad a devolver de Bidón POL')
  expect(fireEvent.keyDown(cantidad, { key: 'e' })).toBe(false)
  fireEvent.change(cantidad, { target: { value: '6' } })
  expect(cantidad).toHaveAttribute('aria-invalid', 'true')
  expect(cantidad).toHaveAccessibleDescription(/No puedes devolver más de 5/)
  fireEvent.keyDown(cantidad, { key: 'ArrowDown' })
  expect(cantidad).toHaveValue('5')
  expect(cantidad).toHaveAttribute('aria-invalid', 'false')
  expect(api.registrarDevolucion).not.toHaveBeenCalled()
})

it('F2 · advertencia suma buenos y malos, no usa tope de stock y exige confirmar', async () => {
  vi.mocked(api.obtenerEnvasesDespacho).mockResolvedValue([{ id: 'de-1', despacho_id: 'd-1', tipo_empaque_id: empaque.id, cantidad: 2, es_ajuste: false, creado_en: '2026-01-01T00:00:00Z' }])
  vi.mocked(api.registrarDevolucion).mockResolvedValue({ error: null })
  await abrirDevolucionF2()
  const buenos = screen.getByLabelText('Cantidad de envases buenos de Bandeja')
  const malos = screen.getByLabelText('Cantidad de envases malos de Bandeja')
  expect(fireEvent.keyDown(buenos, { key: 'a' })).toBe(false)
  expect(fireEvent.keyDown(malos, { key: '-' })).toBe(false)
  fireEvent.change(buenos, { target: { value: '2' } })
  expect(buenos).not.toHaveAttribute('aria-describedby')
  fireEvent.change(malos, { target: { value: '1' } })
  expect(buenos).toHaveAccessibleDescription(/pueden venir de clientes/i)
  expect(malos).toHaveAccessibleDescription(/pueden venir de clientes/i)
  expect(buenos).toHaveAttribute('aria-invalid', 'false')
  expect(screen.getByRole('button', { name: 'Registrar devolución' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }))
  let dialogo = screen.getByRole('dialog', { name: 'Confirmar devolución de envases' })
  expect(dialogo).toHaveAccessibleDescription(/pueden venir de clientes/i)
  expect(api.registrarDevolucion).not.toHaveBeenCalled()
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Volver a revisar' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(buenos).toHaveValue('2')
  expect(malos).toHaveValue('1')
  fireEvent.change(malos, { target: { value: '1000' } })
  expect(malos).toHaveValue('1.000')
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }))
  dialogo = screen.getByRole('dialog')
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar y registrar' }))
  await waitFor(() => expect(api.registrarDevolucion).toHaveBeenCalledTimes(1))
  expect(vi.mocked(api.registrarDevolucion).mock.calls[0][0].lineas_envase).toEqual([
    { tipo_empaque_id: 'te-1', cantidad: 2, estado: 'bueno' },
    { tipo_empaque_id: 'te-1', cantidad: 1000, estado: 'malo' },
  ])
})

it('F2 · un tipo sin envases despachados avisa y Escape conserva el formulario y foco', async () => {
  await abrirDevolucionF2()
  const buenos = screen.getByLabelText('Cantidad de envases buenos de Bandeja')
  fireEvent.change(buenos, { target: { value: '1' } })
  expect(buenos).toHaveAccessibleDescription(/se despacharon 0/)
  const registrar = screen.getByRole('button', { name: 'Registrar devolución' })
  registrar.focus()
  fireEvent.click(registrar)
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(registrar).toHaveFocus()
  expect(buenos).toHaveValue('1')
  expect(api.registrarDevolucion).not.toHaveBeenCalled()
})

it('F2 · corregir recupera el saldo anterior de productos y confirma envases excedentes', async () => {
  vi.mocked(api.obtenerDevolucionesProducto).mockResolvedValue([{ id: 'dev-1', despacho_id: 'd-1', producto_id: 'p-1', cantidad: 2, anulado: false, creado_por: 'user-1', creado_en: '2026-01-01T00:00:00Z' }])
  vi.mocked(api.corregirDevolucion).mockResolvedValue({ error: null })
  await abrirDevolucionF2(true)
  const cantidad = screen.getByLabelText('Cantidad a devolver de Bidón POL')
  fireEvent.change(cantidad, { target: { value: '5' } })
  expect(cantidad).toHaveAttribute('aria-invalid', 'false')
  fireEvent.change(cantidad, { target: { value: '6' } })
  expect(cantidad).toHaveAccessibleDescription(/No puedes devolver más de 5/)
  fireEvent.change(cantidad, { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Cantidad de envases buenos de Bandeja'), { target: { value: '1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
  expect(api.corregirDevolucion).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar y guardar corrección' }))
  await waitFor(() => expect(api.corregirDevolucion).toHaveBeenCalledTimes(1))
  expect(api.registrarDevolucion).not.toHaveBeenCalled()
})

it('P1 · conserva el despacho y borrador al navegar a otra página', async () => {
  const primero = makeDespachoHoy()
  const segundo = { ...primero, id: 'd-2' }
  vi.mocked(api.obtenerPaginaDespachos).mockImplementation(async (_sucursal, { pagina }) => ({ filas: [pagina === 1 ? primero : segundo], total: 21 }))
  vi.mocked(api.obtenerDetallesDespacho).mockImplementation(async ids => ids.includes(primero.id) ? [detalle] : [])
  renderWithProviders(<Devoluciones />)
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
  fireEvent.change(screen.getByLabelText('Cantidad a devolver de Bidón POL'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  await waitFor(() => expect(screen.getByRole('navigation', { name: 'Paginación de despachos' })).toHaveTextContent('Página 2 de 2'))
  expect(screen.getByLabelText('Cantidad a devolver de Bidón POL')).toHaveValue('2')
  expect(screen.getByText('Devolución de Ana López')).toBeInTheDocument()
  expect(api.obtenerDetallesDespacho).toHaveBeenLastCalledWith(['d-2'])
  await waitFor(() => expect(screen.queryByRole('button', { name: /#d-1/ })).not.toBeInTheDocument())
})

it('FX5 R5-04 · distingue un producto sin devolución de otro ya devuelto', async () => {
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto, { ...producto, id: 'p-2', nombre: 'Hielo CUBO' }])
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle, { ...detalle, id: 'dd-2', producto_id: 'p-2' }])
  vi.mocked(api.obtenerDevolucionesProducto).mockResolvedValue([{ id: 'dev-1', despacho_id: 'd-1', producto_id: 'p-1', cantidad: 2, anulado: false, creado_por: 'user-2', creado_en: '2026-10-13T12:00:00Z' }])
  renderWithProviders(<Devoluciones />)
  fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
  const filas = within(screen.getByRole('region', { name: 'Productos del despacho' })).getAllByTestId('fila-devolucion-producto')
  expect(filas[0]).toHaveTextContent('Devuelto 2')
  expect(filas[1]).toHaveTextContent('Hielo CUBO')
  expect(filas[1]).toHaveTextContent('Sin devolución')
  expect(filas[1]).not.toHaveTextContent('Devuelto 0')
})
