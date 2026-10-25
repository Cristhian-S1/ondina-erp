import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
import Despachos from './Despachos'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
    obtenerVendedores: vi.fn(),
    obtenerVendedoresHistorial: vi.fn(),
    obtenerDespachos: vi.fn(),
    obtenerPaginaDespachos: vi.fn(),
    obtenerDespacho: vi.fn(),
    obtenerDetallesDespacho: vi.fn(),
    obtenerEnvasesDespacho: vi.fn(),
    obtenerDevolucionesProducto: vi.fn(),
    obtenerDevolucionesEnvase: vi.fn(),
    obtenerStockBodega: vi.fn(),
    obtenerStockEnvases: vi.fn(),
    obtenerCargaVendedores: vi.fn(),
    crearDespacho: vi.fn(),
    ajustarDespacho: vi.fn(),
  }
})

import * as catalog from '@/lib/catalog'
import * as api from '@/domains/bodega/api'
import type { Perfil, Producto, Sucursal, TipoEmpaque } from '@/types'
import type { Despacho, DespachoDetalle, StockBodega, StockEnvases } from '../types'

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

const hielo: Producto = {
  id: 'p-hielo',
  nombre: 'Hielo en Bolsa 1kg',
  tipo: 'hielo',
  tipo_empaque_id: null,
  precio_base: 1200,
  activo: true,
  creado_en: '2026-01-01T00:00:00Z',
}

const bandeja: TipoEmpaque = {
  id: 'te-1',
  nombre: 'Bandeja',
  categoria: 'uso_interno',
  activo: true,
}

const stockHielo: StockBodega = {
  sucursal_id: 'suc-1',
  producto_id: 'p-hielo',
  cantidad: 100,
  modificado_en: '2026-01-01T00:00:00Z',
}

const stockBandeja: StockEnvases = {
  sucursal_id: 'suc-1',
  tipo_empaque_id: 'te-1',
  cantidad: 40,
  modificado_en: '2026-01-01T00:00:00Z',
}

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
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([])
  vi.mocked(api.obtenerVendedores).mockResolvedValue([vendedor])
  // Por defecto el historial contiene a los vendedores activos; las pruebas de inactivos lo reemplazan.
  vi.mocked(api.obtenerVendedoresHistorial).mockImplementation(async id =>
    (await api.obtenerVendedores(id)).map(v => ({ ...v, activo: true })))
  vi.mocked(api.obtenerDespachos).mockResolvedValue([])
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([])
  vi.mocked(api.obtenerEnvasesDespacho).mockResolvedValue([])
  vi.mocked(api.obtenerDevolucionesProducto).mockResolvedValue([])
  vi.mocked(api.obtenerDevolucionesEnvase).mockResolvedValue([])
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([])
  vi.mocked(api.obtenerCargaVendedores).mockResolvedValue([])
})

afterEach(() => {
  focusManager.setFocused(undefined)
  vi.useRealTimers()
  vi.clearAllMocks()
})

it('C3-05 · muestra un avatar neutro y el ID del vendedor ausente del catálogo', async () => {
  vi.mocked(api.obtenerVendedores).mockResolvedValue([])
  vi.mocked(api.obtenerDespachos).mockResolvedValue([{ ...makeDespachoHoy(), vendedor_id: 'inactive-123456' }])
  renderWithProviders(<Despachos />)
  const fila = await screen.findByRole('button', { name: /Vendedor no disponible/ })
  expect(fila).toHaveTextContent('inactive')
  expect(within(fila).queryByText('VN')).not.toBeInTheDocument()
  expect(within(fila).getByText('?')).toHaveAttribute('aria-hidden', 'true')
})

describe('HU-13 · Despachos', () => {
  it('muestra el estado vacío cuando no hay despachos para la sucursal', async () => {
    renderWithProviders(<Despachos />)
    await waitFor(() => {
      expect(screen.getByText(/No hay despachos para el día y vendedor seleccionados/i)).toBeInTheDocument()
    })
  })

  it('renderiza los despachos del día con el total de unidades del vendedor', async () => {
    vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
    vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
    renderWithProviders(<Despachos />)
    await waitFor(() => {
      expect(screen.getAllByText('Ana López').length).toBeGreaterThan(0)
    })
    expect(screen.getByText('5 unid.')).toBeInTheDocument()
  })
})

it('R1-14 · nombra al vendedor inactivo en el historial y el filtro, pero no en Nuevo despacho', async () => {
  const inactivo = { id: 'user-off', nombres: 'Bruno', apellidos: 'Soto' }
  vi.mocked(api.obtenerVendedoresHistorial).mockResolvedValue([{ ...inactivo, activo: false }, { ...vendedor, activo: true }])
  vi.mocked(api.obtenerDespachos).mockResolvedValue([{ ...makeDespachoHoy(), vendedor_id: 'user-off' }])
  renderWithProviders(<Despachos />)
  const fila = await screen.findByRole('button', { name: /Bruno Soto \(inactivo\)/ })
  expect(fila).not.toHaveTextContent('Vendedor no disponible')
  expect(within(screen.getByRole('combobox', { name: 'Filtrar por vendedor' })).getByRole('option', { name: 'Bruno Soto (inactivo)' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo despacho' }))
  const selector = screen.getByLabelText('Vendedor')
  expect(within(selector).getByRole('option', { name: 'Ana López' })).toBeInTheDocument()
  expect(within(selector).queryByRole('option', { name: /Bruno/ })).not.toBeInTheDocument()
})

describe('HU-13 · Nuevo despacho', () => {
  async function abrirModal() {
    renderWithProviders(<Despachos />)
    await waitFor(() => {
      expect(screen.getByText(/No hay despachos para el día y vendedor seleccionados/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo despacho' }))
  }

  it('no permite elegir el mismo producto en dos filas', async () => {
    vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto, hielo])
    await abrirModal()
    const selectsIniciales = screen.getAllByLabelText(/Producto/)
    fireEvent.change(selectsIniciales[0], { target: { value: producto.id } })

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar producto' }))

    const selects = screen.getAllByLabelText(/Producto/)
    expect(selects).toHaveLength(2)
    expect(within(selects[1]).getByRole('option', { name: /Bidón POL/ })).toBeDisabled()
    expect(within(selects[0]).getByRole('option', { name: /Bidón POL/ })).not.toBeDisabled()
  })

  it('autocompleta las bandejas según el hielo del despacho y permite editarlas', async () => {
    vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
    vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([bandeja])
    vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
    vi.mocked(api.obtenerStockEnvases).mockResolvedValue([stockBandeja])

    await abrirModal()

    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: hielo.id } })
    const inputCantidad = screen.getByLabelText('Cantidad')
    fireEvent.change(inputCantidad, { target: { value: '15' } })

    expect(screen.getByLabelText('Bandejas')).toHaveValue('2')

    fireEvent.change(screen.getByLabelText('Bandejas'), { target: { value: '3' } })
    expect(screen.getByLabelText('Bandejas')).toHaveValue('3')
    expect(screen.getByText('Sugerido: 2')).toBeInTheDocument()

    fireEvent.change(inputCantidad, { target: { value: '40' } })
    expect(screen.getByLabelText('Bandejas')).toHaveValue('4')
    expect(screen.queryByText('Sugerido: 2')).not.toBeInTheDocument()
  })

  it('envía la bandeja como envase al registrar el despacho', async () => {
    vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
    vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([bandeja])
    vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
    vi.mocked(api.obtenerStockEnvases).mockResolvedValue([stockBandeja])
    vi.mocked(api.crearDespacho).mockResolvedValue({ error: null })

    await abrirModal()
    fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: vendedor.id } })
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: hielo.id } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))

    await waitFor(() => {
      expect(api.crearDespacho).toHaveBeenCalledWith(
        expect.objectContaining({
          lineas: [{ producto_id: hielo.id, cantidad: 20 }],
          envases: [{ tipo_empaque_id: bandeja.id, cantidad: 2 }],
        }),
      )
    })
  })

  it('deja las bandejas vacías cuando el despacho no lleva hielo', async () => {
    vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([bandeja])

    await abrirModal()

    expect(screen.getByLabelText('Bandejas')).toHaveValue('')
  })
})


it('FE-05 · muestra errores de lectura y permite reintentar sin un falso estado vacío', async () => {
  vi.mocked(api.obtenerDespachos).mockRejectedValue(new Error('Fallo de consulta'))
  renderWithProviders(<Despachos />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar')
  vi.mocked(api.obtenerDespachos).mockResolvedValue([])
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
})


it('B1 · limpia el borrador de despacho al cambiar de sucursal', async () => {
  vi.mocked(catalog.obtenerSucursales).mockResolvedValue([sucursal, { ...sucursal, id: 'suc-2', nombre: 'Sur' }])
  renderWithProviders(<Despachos />, { perfil: makePerfil({ rol: 'administrador' }) })
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: producto.id } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '7' } })
  fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: 'suc-2' } })
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  expect(screen.getByLabelText('Cantidad')).toHaveValue('')
  expect(screen.getByLabelText('Producto')).toHaveValue('')
  expect(screen.getByLabelText('Vendedor')).toHaveValue('')
})

it('B1 · conserva el nodo y foco de la segunda línea al quitar la primera', async () => {
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto, hielo])
  renderWithProviders(<Despachos />)
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.click(screen.getByRole('button', { name: '+ Agregar producto' }))
  const segundaCantidad = screen.getAllByLabelText('Cantidad')[1]
  fireEvent.change(segundaCantidad, { target: { value: '8' } })
  segundaCantidad.focus()
  fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0])
  expect(screen.getByLabelText('Cantidad')).toBe(segundaCantidad)
  expect(segundaCantidad).toHaveFocus()
  expect(segundaCantidad).toHaveValue('8')
})


it('B3 · keeps dispatch key after failure and renews it after success', async () => {
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
  vi.mocked(api.crearDespacho).mockResolvedValueOnce({ error: 'No fue posible completar la operación. Inténtalo de nuevo.' }).mockResolvedValue({ error: null })
  renderWithProviders(<Despachos />)
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: vendedor.id } })
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: hielo.id } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))
  await screen.findByText('No fue posible completar la operación. Inténtalo de nuevo.')
  fireEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))
  await waitFor(() => expect(api.crearDespacho).toHaveBeenCalledTimes(2))
  const first = vi.mocked(api.crearDespacho).mock.calls[0][0].idempotency_key
  expect(vi.mocked(api.crearDespacho).mock.calls[1][0].idempotency_key).toBe(first)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Registrar despacho' })).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: vendedor.id } })
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: hielo.id } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))
  await waitFor(() => expect(api.crearDespacho).toHaveBeenCalledTimes(3))
  expect(vi.mocked(api.crearDespacho).mock.calls[2][0].idempotency_key).not.toBe(first)
})

describe('Accesibilidad · filtros de Despachos', () => {
  it('nombra el filtro de fecha y de vendedor, y el día activo cumple 44 px', async () => {
    renderWithProviders(<Despachos />, { perfil: makePerfil({ rol: 'administrador' }) })
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
    renderWithProviders(<Despachos />, { perfil: makePerfil({ rol: 'administrador' }) })
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
    renderWithProviders(<Despachos />)
    expect(screen.getByRole('status')).toHaveTextContent(/Cargando/)
    const vacio = await screen.findByText(/No hay despachos para el día y vendedor seleccionados/)
    expect(vacio.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('identifica un despacho cuyo vendedor ya no está disponible', async () => {
    vi.mocked(api.obtenerVendedores).mockResolvedValue([])
    vi.mocked(api.obtenerDespachos).mockResolvedValue([{ ...makeDespachoHoy(), id: 'abc12345-despacho' }])
    renderWithProviders(<Despachos />)
    const fila = await screen.findByRole('button', { name: /Vendedor no disponible/ })
    expect(fila).toHaveTextContent('abc12345')
    expect(fila).toHaveTextContent(/\d{2}:\d{2}/)
    expect(screen.queryByText('Desconocido')).not.toBeInTheDocument()
  })

  it('Hoy cambia al reanudar después de medianoche en Santiago', async () => {
    vi.setSystemTime(new Date('2026-10-14T02:59:59Z'))
    vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
    renderWithProviders(<Despachos />)
    await screen.findByRole('button', { name: /Ana López/ })
    await act(async () => {
      vi.setSystemTime(new Date('2026-10-14T03:00:01Z'))
      fireEvent.focus(window)
    })
    expect(await screen.findByText(/No hay despachos para el día|No hay despachos para el día/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ana López/ })).not.toBeInTheDocument()
  })
})


it('B1 · descarta lectura y borrador de la identidad anterior', async () => {
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
  let resolver!: (data: Despacho[]) => void
  const pendiente = new Promise<Despacho[]>((res) => { resolver = res })
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  const contenido = (id: string) => (
    <AuthContext.Provider value={{ perfil: makePerfil({ id, rol: 'administrador' }), loading: false, signIn: async () => {}, signOut: async () => {} }}>
      <Despachos />
    </AuthContext.Provider>
  )
  const { rerender } = renderWithProviders(contenido('primera'))
  await screen.findByRole('button', { name: /Ana López/ })
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '7' } })
  vi.mocked(api.obtenerDespachos).mockReturnValueOnce(pendiente).mockResolvedValue([])
  vi.setSystemTime(new Date(Date.now() + 31000))
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true) })
  await waitFor(() => expect(api.obtenerDespachos).toHaveBeenCalledTimes(2))
  rerender(contenido('segunda'))
  await screen.findByText(/No hay despachos para el día y vendedor seleccionados/)
  await act(async () => { resolver([makeDespachoHoy()]) })
  expect(screen.queryByRole('button', { name: /Ana López/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo despacho' }))
  expect(screen.getByLabelText('Cantidad')).toHaveValue('')
})


it('B1 · conserva el borrador al reintentar una lectura de la misma sucursal', async () => {
  renderWithProviders(<Despachos />)
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: producto.id } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '7' } })
  vi.mocked(api.obtenerDespachos).mockRejectedValueOnce(new Error('Lectura fallida')).mockResolvedValue([])
  vi.setSystemTime(new Date(Date.now() + 31000))
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true) })
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByLabelText('Cantidad')).toHaveValue('7')
  expect(screen.getByRole('combobox', { name: /Producto/ })).toHaveValue(producto.id)
})


it('FX R1-01/03 · muestra validación y etiquetas visibles dentro del diálogo', async () => {
  renderWithProviders(<Despachos />)
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  const dialogo = screen.getByRole('dialog')
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar despacho' }))
  expect(within(dialogo).getByRole('alert')).toHaveTextContent('Selecciona un vendedor')
  expect(within(dialogo).getByText('Producto')).not.toHaveClass('sr-only')
  expect(within(dialogo).getByText('Cantidad')).not.toHaveClass('sr-only')
})

it('FX R1-02 · conserva lista, modal y borrador durante un refetch fallido', async () => {
  vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
  renderWithProviders(<Despachos />)
  await screen.findByRole('button', { name: /Ana López/ })
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '7' } })
  vi.mocked(api.obtenerDespachos).mockRejectedValueOnce(new Error('Sin red'))
  vi.setSystemTime(new Date(Date.now() + 31000))
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true) })
  await screen.findByText(/No fue posible actualizar/)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText('Cantidad')).toHaveValue('7')
  expect(document.querySelector('li button')).toHaveTextContent('Ana López')
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
})

it('FX R1-05/06 · bloquea sucursal durante RPC y conserva clave al reintentar', async () => {
  let resolver!: (value: { error: string | null }) => void
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
  vi.mocked(api.crearDespacho).mockReturnValueOnce(new Promise(r => { resolver = r })).mockResolvedValue({ error: null })
  renderWithProviders(<Despachos />, { perfil: makePerfil({ rol: 'administrador' }) })
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: vendedor.id } })
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: hielo.id } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))
  expect(screen.getByLabelText('Sucursal')).toBeDisabled()
  await act(async () => resolver({ error: 'No fue posible completar la operación. Inténtalo de nuevo.' }))
  expect(screen.getByLabelText('Sucursal')).not.toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))
  await waitFor(() => expect(api.crearDespacho).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.crearDespacho).mock.calls[1][0].idempotency_key).toBe(vi.mocked(api.crearDespacho).mock.calls[0][0].idempotency_key)
})

it('FX R1-07 · bodega asignada funciona sin catálogo de sucursales', async () => {
  vi.mocked(catalog.obtenerSucursales).mockRejectedValue(new Error('Sin catálogo'))
  renderWithProviders(<Despachos />, { perfil: makePerfil({ rol: 'bodega' }) })
  expect(await screen.findByRole('button', { name: 'Nuevo despacho' })).toBeInTheDocument()
  expect(catalog.obtenerSucursales).not.toHaveBeenCalled()
})


it('FX R1-02 · fallo del catálogo de sucursales no desmonta un ámbito ya cargado', async () => {
  renderWithProviders(<Despachos />, { perfil: makePerfil({ rol: 'administrador' }) })
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
  vi.mocked(catalog.obtenerSucursales).mockRejectedValueOnce(new Error('Catálogo sin red'))
  vi.setSystemTime(new Date(Date.now() + 31000))
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true) })
  await waitFor(() => expect(catalog.obtenerSucursales).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(document.querySelector('[role="alert"]')).toHaveTextContent('No fue posible actualizar las sucursales'))
  expect(screen.getByLabelText('Cantidad')).toHaveValue('4')
})

it('FX R1-04 · volver a enfocar dentro de treinta segundos reutiliza los datos', async () => {
  renderWithProviders(<Despachos />)
  await screen.findByRole('button', { name: 'Nuevo despacho' })
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true) })
  expect(api.obtenerDespachos).toHaveBeenCalledTimes(1)
})


it('FX2 R4-07 · error enfoca y describe el vendedor; éxito anuncia el despacho', async () => {
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
  vi.mocked(api.crearDespacho).mockResolvedValue({ error: null })
  renderWithProviders(<Despachos />)
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  expect(screen.getByLabelText('Vendedor')).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))
  const campo = screen.getByLabelText('Vendedor')
  await waitFor(() => expect(campo).toHaveFocus())
  expect(campo).toHaveAttribute('aria-invalid','true')
  expect(document.getElementById(campo.getAttribute('aria-describedby')!)).toHaveAttribute('role','alert')
  fireEvent.change(campo, { target: { value: vendedor.id } })
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: hielo.id } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))
  expect(await screen.findByText('Despacho registrado.')).toBeVisible()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

async function abrirDespachoF2() {
  renderWithProviders(<Despachos />)
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  return screen.getByRole('dialog', { name: 'Nuevo despacho' })
}

it('F2 · alinea arriba los controles y deja la disponibilidad fuera de la etiqueta', async () => {
  const dialogo = await abrirDespachoF2()
  const productoInput = within(dialogo).getByLabelText('Producto')
  fireEvent.change(productoInput, { target: { value: producto.id } })
  const cantidad = within(dialogo).getByLabelText('Cantidad')
  const fila = cantidad.closest('.grid')!
  expect(fila).toHaveClass('items-start')
  expect(fila).not.toHaveClass('items-end')
  expect(fila).toContainElement(cantidad)
  expect(within(dialogo).getByText(/En bodega/).closest('label')).toBeNull()
  expect(productoInput).toHaveAccessibleName('Producto')
})

it.each([7, 10])('F2 · limita líneas a %i productos activos y enlaza el motivo', async (total) => {
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([
    ...Array.from({ length: total }, (_, i) => ({ ...producto, id: `activo-${i}`, nombre: `Producto ${i}` })),
    { ...producto, id: 'inactivo', nombre: 'Inactivo', activo: false },
  ])
  const dialogo = await abrirDespachoF2()
  const agregar = within(dialogo).getByRole('button', { name: '+ Agregar producto' })
  for (let i = 1; i < total; i++) fireEvent.click(agregar)
  expect(within(dialogo).getAllByLabelText('Producto')).toHaveLength(total)
  expect(agregar).toBeDisabled()
  expect(agregar).toHaveAccessibleDescription(`Máximo ${total} productos por despacho: ya alcanzaste el número de productos activos del catálogo.`)
  expect(within(dialogo).queryByRole('option', { name: /Inactivo/ })).not.toBeInTheDocument()
  fireEvent.click(within(dialogo).getAllByRole('button', { name: 'Quitar' })[0])
  expect(agregar).toBeEnabled()
})

it('F2 · cantidad y bandejas rechazan letras y muestran exceso de stock en tiempo real', async () => {
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([bandeja])
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([stockBandeja])
  const dialogo = await abrirDespachoF2()
  fireEvent.change(within(dialogo).getByLabelText('Producto'), { target: { value: hielo.id } })
  const cantidad = within(dialogo).getByLabelText('Cantidad')
  expect(fireEvent.keyDown(cantidad, { key: 'a' })).toBe(false)
  fireEvent.change(cantidad, { target: { value: '1000' } })
  expect(cantidad).toHaveValue('1.000')
  expect(cantidad).toHaveAttribute('aria-invalid', 'true')
  expect(cantidad).toHaveAccessibleDescription(/Excede el stock en bodega.*100/)
  fireEvent.change(cantidad, { target: { value: '100' } })
  expect(cantidad).toHaveAttribute('aria-invalid', 'false')
  fireEvent.click(within(dialogo).getAllByRole('button', { name: 'Aumentar', exact: true })[0])
  expect(cantidad).toHaveValue('101')
  expect(cantidad).toHaveAttribute('aria-invalid', 'true')
  const bandejasInput = within(dialogo).getByLabelText('Bandejas')
  expect(fireEvent.keyDown(bandejasInput, { key: 'e' })).toBe(false)
  fireEvent.paste(bandejasInput, { clipboardData: { getData: () => '1.2a3' } })
  expect(bandejasInput).toHaveAttribute('aria-invalid', 'true')
  expect(bandejasInput).toHaveAccessibleDescription(/Excede el stock de bandejas.*40/)
  fireEvent.change(bandejasInput, { target: { value: '40' } })
  expect(bandejasInput).toHaveAttribute('aria-invalid', 'false')
  expect(api.crearDespacho).not.toHaveBeenCalled()
})

it('M2 · cada producto del despacho es una tarjeta con encabezado, controles y Quitar de 44 px', async () => {
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto, hielo])
  const dialogo = await abrirDespachoF2()
  fireEvent.click(within(dialogo).getByRole('button', { name: '+ Agregar producto' }))
  const tarjetas = within(dialogo).getAllByTestId('linea-despacho')
  expect(tarjetas).toHaveLength(2)
  expect(within(dialogo).getByText('2 líneas')).toBeInTheDocument()
  fireEvent.change(within(tarjetas[0]).getByLabelText('Producto'), { target: { value: producto.id } })
  expect(within(tarjetas[0]).getByText('Línea 1')).toBeInTheDocument()
  expect(within(tarjetas[0]).getAllByText('Bidón POL').length).toBeGreaterThan(0)
  expect(within(tarjetas[1]).getByText('Línea 2')).toBeInTheDocument()
  expect(within(tarjetas[1]).getByText('Sin producto seleccionado')).toBeInTheDocument()
  for (const tarjeta of tarjetas) {
    expect(tarjeta).toHaveClass('border', 'rounded-xl')
    expect(within(tarjeta).getByLabelText('Producto')).toBeInTheDocument()
    expect(within(tarjeta).getByLabelText('Cantidad')).toBeInTheDocument()
    expect(within(tarjeta).getByRole('button', { name: 'Quitar' })).toHaveClass('min-h-11')
  }
  // Un único árbol: sin controles duplicados para otra vista.
  expect(within(dialogo).getAllByLabelText('Cantidad')).toHaveLength(2)
})

function comprobarCampoK1(campo: HTMLElement, mensaje: RegExp) {
  const label = document.querySelector(`label[for="${campo.id}"]`)
  expect(label).toBeInTheDocument()
  expect(label).toBeVisible()
  expect(campo).toHaveAttribute('aria-invalid', 'true')
  const mensajes = campo.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)!)
  const error = mensajes.find(elemento => mensaje.test(elemento.textContent ?? ''))!
  expect(error).toBeVisible()
  expect(label?.parentElement).toContainElement(error)
}

it('K1 R2-13 · vendedor usa label htmlFor y error persistente bajo su control', async () => {
  const dialogo = await abrirDespachoF2()
  const campo = within(dialogo).getByLabelText('Vendedor')
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar despacho' }))
  comprobarCampoK1(campo, /Selecciona un vendedor/)
  expect(campo).toHaveFocus()
  fireEvent.change(campo, { target: { value: vendedor.id } })
  expect(campo).toHaveAttribute('aria-invalid', 'false')
  expect(campo).not.toHaveAttribute('aria-describedby')
})

it('K1 R2-13 · producto y cantidad asocian su error local y conservan IDs al corregir', async () => {
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
  const dialogo = await abrirDespachoF2()
  fireEvent.change(within(dialogo).getByLabelText('Vendedor'), { target: { value: vendedor.id } })
  const productoCampo = within(dialogo).getByLabelText('Producto')
  const cantidad = within(dialogo).getByLabelText('Cantidad')
  const ids = [productoCampo.id, cantidad.id]
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar despacho' }))
  comprobarCampoK1(productoCampo, /Selecciona un producto/)
  expect(productoCampo).toHaveFocus()
  fireEvent.change(productoCampo, { target: { value: hielo.id } })
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar despacho' }))
  comprobarCampoK1(cantidad, /Ingresa una cantidad/)
  expect(cantidad).toHaveFocus()
  fireEvent.change(cantidad, { target: { value: '101' } })
  comprobarCampoK1(cantidad, /Excede el stock en bodega/)
  fireEvent.change(cantidad, { target: { value: '1' } })
  expect(cantidad).toHaveAttribute('aria-invalid', 'false')
  expect(productoCampo).toHaveAttribute('aria-invalid', 'false')
  expect([productoCampo.id, cantidad.id]).toEqual(ids)
})

it('K1 R2-13 · bandejas enlaza label, estado inválido y mensaje bajo el campo', async () => {
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([bandeja])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([stockBandeja])
  const dialogo = await abrirDespachoF2()
  const campo = within(dialogo).getByLabelText('Bandejas')
  fireEvent.change(campo, { target: { value: '41' } })
  comprobarCampoK1(campo, /Excede el stock de bandejas/)
  fireEvent.change(campo, { target: { value: '40' } })
  expect(campo).toHaveAttribute('aria-invalid', 'false')
  expect(campo).not.toHaveAttribute('aria-describedby')
})

it('K1 R2-13 · conserva un error visible cuando se envía después de quitar todas las líneas', async () => {
  const dialogo = await abrirDespachoF2()
  fireEvent.change(within(dialogo).getByLabelText('Vendedor'), { target: { value: vendedor.id } })
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Quitar' }))
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar despacho' }))
  expect(within(dialogo).getByRole('alert')).toHaveTextContent('Selecciona un vendedor y agrega al menos un producto.')
  expect(api.crearDespacho).not.toHaveBeenCalled()
})


it.each([
  ['vendedor', 'Vendedor', 'Selecciona un vendedor.'],
  ['producto', 'Producto', 'Selecciona un producto.'],
  ['cantidad', 'Cantidad', 'Ingresa una cantidad mayor que cero.'],
])('F1 V1-01 · el error de %s describe sólo el campo pendiente', async (paso, etiqueta, mensaje) => {
  const dialogo = await abrirDespachoF2()
  if (paso !== 'vendedor') fireEvent.change(within(dialogo).getByLabelText('Vendedor'), { target: { value: vendedor.id } })
  if (paso === 'cantidad') fireEvent.change(within(dialogo).getByLabelText('Producto'), { target: { value: producto.id } })
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar despacho' }))
  const campo = within(dialogo).getByLabelText(etiqueta)
  const error = document.getElementById(campo.getAttribute('aria-describedby')!)
  expect(error).toHaveTextContent(mensaje)
  expect(error).toHaveAttribute('role', 'alert')
  expect(campo).toHaveFocus()
  expect(api.crearDespacho).not.toHaveBeenCalled()
})

it.each(['carga', 'error'])('F1 V1-03 · conserva todo el borrador al atravesar %s sin datos de consulta', async fase => {
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([hielo])
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([bandeja])
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([stockBandeja])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  renderWithProviders(<QueryClientProvider client={client}><Despachos /></QueryClientProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo despacho' }))
  fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: vendedor.id } })
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: hielo.id } })
  const cantidad = screen.getByLabelText('Cantidad')
  fireEvent.change(cantidad, { target: { value: '7' } })
  fireEvent.change(screen.getByLabelText('Bandejas'), { target: { value: '3' } })

  let resolver!: (productos: Producto[]) => void
  let rechazar!: (error: Error) => void
  vi.mocked(catalog.obtenerProductos).mockImplementationOnce(() => new Promise((resolve, reject) => { resolver = resolve; rechazar = reject }))
  await act(async () => { void client.resetQueries({ queryKey: ['bodega'] }) })
  expect(await screen.findByRole('status')).toHaveTextContent('Cargando')
  expect(screen.queryByRole('dialog', { name: 'Nuevo despacho' })).not.toBeInTheDocument()
  if (fase === 'error') {
    await act(async () => rechazar(new Error('Catálogo temporalmente sin datos')))
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar los despachos')
    expect(screen.queryByRole('dialog', { name: 'Nuevo despacho' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  } else {
    await act(async () => resolver([hielo]))
  }
  const dialogo = await screen.findByRole('dialog', { name: 'Nuevo despacho' })
  expect(within(dialogo).getByLabelText('Cantidad')).toHaveValue('7')
  expect(within(dialogo).getByLabelText('Cantidad')).toBe(cantidad)
  expect(within(dialogo).getByLabelText('Vendedor')).toHaveValue(vendedor.id)
  expect(within(dialogo).getByLabelText('Producto')).toHaveValue(hielo.id)
  expect(within(dialogo).getByLabelText('Bandejas')).toHaveValue('3')
  expect(api.crearDespacho).not.toHaveBeenCalled()
})

it('R1-14 · la página carga con las etiquetas previas si la RPC histórica no está disponible', async () => {
  vi.mocked(api.obtenerVendedoresHistorial).mockRejectedValue(new Error('PGRST202'))
  vi.mocked(api.obtenerDespachos).mockResolvedValue([
    makeDespachoHoy(), { ...makeDespachoHoy(), id: 'd-2', vendedor_id: 'user-off-123456' }])
  renderWithProviders(<Despachos />)
  expect(await screen.findByRole('button', { name: /Vendedor no disponible/ })).toHaveTextContent('Vendedor no disponible · ref. user-off')
  expect(screen.getAllByText('Ana López').length).toBeGreaterThan(0)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})


describe('HU-26 · Agregar productos dentro de la ventana', () => {
  const resultado = () => ({ despachoId: 'd-1', lineasAgregadas: ['dd-2'], ventanaExpiraEn: new Date(Date.now() + 15 * 60_000).toISOString() })

  async function abrirAjuste() {
    vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto, hielo])
    vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
    vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([detalle])
    vi.mocked(api.obtenerStockBodega).mockResolvedValue([stockHielo])
    renderWithProviders(<Despachos />)
    fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar productos' }))
    return screen.findByRole('dialog', { name: 'Agregar productos al despacho' })
  }
  // «Nuevo despacho» comparte etiquetas y sigue montado; las consultas se acotan al diálogo del ajuste.
  const dialogo = () => within(screen.getByRole('dialog', { name: 'Agregar productos al despacho' }))
  function llenar(productoId: string, cantidad: string) {
    fireEvent.change(dialogo().getByLabelText('Producto'), { target: { value: productoId } })
    fireEvent.change(dialogo().getByLabelText('Cantidad'), { target: { value: cantidad } })
  }

  it('oculta la acción en un despacho fuera de la ventana o anulado', async () => {
    vi.mocked(api.obtenerDespachos).mockResolvedValue([
      { ...makeDespachoHoy(), id: 'd-viejo', creado_en: new Date(Date.now() - 16 * 60_000).toISOString() },
      { ...makeDespachoHoy(), id: 'd-anulado', anulado: true },
    ])
    renderWithProviders(<Despachos />)
    const [viejo, anulado] = await screen.findAllByRole('button', { name: /Ana López/ })
    fireEvent.click(viejo)
    expect(screen.queryByRole('button', { name: 'Agregar productos' })).not.toBeInTheDocument()
    expect(screen.getByText('La ventana de ajuste de este despacho está cerrada.')).toBeInTheDocument()
    fireEvent.click(anulado)
    expect(screen.getByRole('button', { name: /Ana López/, expanded: true })).toBe(anulado)
    expect(screen.queryByRole('button', { name: 'Agregar productos' })).not.toBeInTheDocument()
    expect(screen.queryByText('La ventana de ajuste de este despacho está cerrada.')).not.toBeInTheDocument()
  })

  it('envía solo las líneas nuevas con la clave del intento y refresca despachos y stock', async () => {
    vi.mocked(api.ajustarDespacho).mockImplementation(async () => ({ error: null, resultado: resultado() }))
    await abrirAjuste()
    expect(screen.getByText(/Quedan 15 min 00 s de la ventana de ajuste \(aprox\.\)/)).toBeInTheDocument()
    llenar(hielo.id, '4')
    const paginas = vi.mocked(api.obtenerPaginaDespachos).mock.calls.length
    const stocks = vi.mocked(api.obtenerStockBodega).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al despacho' }))

    await waitFor(() => expect(api.ajustarDespacho).toHaveBeenCalledTimes(1))
    expect(api.ajustarDespacho).toHaveBeenCalledWith('d-1', [{ producto_id: hielo.id, cantidad: 4 }], expect.stringMatching(/^[0-9a-f-]{36}$/))
    expect(await screen.findByText('Productos agregados al despacho.')).toBeInTheDocument()
    await waitFor(() => {
      expect(vi.mocked(api.obtenerPaginaDespachos).mock.calls.length).toBeGreaterThan(paginas)
      expect(vi.mocked(api.obtenerStockBodega).mock.calls.length).toBeGreaterThan(stocks)
    })
    expect(screen.queryByRole('dialog', { name: 'Agregar productos al despacho' })).not.toBeInTheDocument()
    // La expiración informada por la RPC reemplaza la estimación de la pista.
    expect(screen.getByText('Quedan 15 min 00 s para agregar productos.')).toBeInTheDocument()
  })

  it('reutiliza la clave al reintentar el mismo contenido y la renueva si cambia o tiene éxito', async () => {
    vi.mocked(api.ajustarDespacho)
      .mockResolvedValueOnce({ error: 'No fue posible completar la operación. Inténtalo de nuevo.', resultado: null })
      .mockResolvedValueOnce({ error: 'No fue posible completar la operación. Inténtalo de nuevo.', resultado: null })
      .mockImplementation(async () => ({ error: null, resultado: resultado() }))
    await abrirAjuste()
    llenar(hielo.id, '4')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al despacho' }))
    await screen.findByText('No fue posible completar la operación. Inténtalo de nuevo.')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al despacho' }))
    await waitFor(() => expect(api.ajustarDespacho).toHaveBeenCalledTimes(2))
    const [, , primera] = vi.mocked(api.ajustarDespacho).mock.calls[0]
    expect(vi.mocked(api.ajustarDespacho).mock.calls[1][2]).toBe(primera)

    fireEvent.change(dialogo().getByLabelText('Cantidad'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al despacho' }))
    await waitFor(() => expect(api.ajustarDespacho).toHaveBeenCalledTimes(3))
    expect(vi.mocked(api.ajustarDespacho).mock.calls[2][1]).toEqual([{ producto_id: hielo.id, cantidad: 5 }])
    expect(vi.mocked(api.ajustarDespacho).mock.calls[2][2]).not.toBe(primera)
  })

  it('valida en el cliente: sin llamar a la RPC, con el mensaje bajo el campo', async () => {
    await abrirAjuste()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al despacho' }))
    expect(await dialogo().findByText('Selecciona un producto.')).toBeInTheDocument()
    fireEvent.change(dialogo().getByLabelText('Producto'), { target: { value: hielo.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al despacho' }))
    expect(await dialogo().findByText('Ingresa una cantidad mayor que cero.')).toBeInTheDocument()
    expect(api.ajustarDespacho).not.toHaveBeenCalled()
  })

  it('no ofrece repetir un producto en otra línea', async () => {
    await abrirAjuste()
    llenar(hielo.id, '1')
    fireEvent.click(dialogo().getByRole('button', { name: '+ Agregar producto' }))
    const [, segunda] = dialogo().getAllByLabelText('Producto')
    expect(within(segunda).getByRole('option', { name: /Hielo en Bolsa/ })).toBeDisabled()
  })

  it.each([
    'No tienes permisos para modificar este despacho.',
    'No se pudo identificar el intento. Cierra el formulario e inténtalo de nuevo.',
    'El despacho no existe.',
    'El despacho está anulado.',
    'Este reintento pertenece a otra operación. Cierra el formulario e inténtalo de nuevo.',
    'Agrega al menos un producto al despacho.',
    'Revisa los productos y cantidades del ajuste.',
    'El producto no existe o está desactivado.',
    'No repitas productos en el ajuste.',
    'La ventana de ajuste del despacho expiró. Ya no se pueden agregar productos.',
    'No hay stock suficiente en bodega para completar el ajuste.',
  ])('muestra el rechazo de la base: %s', async (mensaje) => {
    vi.mocked(api.ajustarDespacho).mockResolvedValue({ error: mensaje, resultado: null })
    await abrirAjuste()
    llenar(hielo.id, '4')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al despacho' }))
    expect(await dialogo().findByRole('alert')).toHaveTextContent(mensaje)
    expect(screen.getByRole('dialog', { name: 'Agregar productos al despacho' })).toBeInTheDocument()
    expect(dialogo().getByLabelText('Cantidad')).toHaveValue('4')
  })

  it('marca como Ajuste las líneas agregadas, separadas de las originales', async () => {
    vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto, hielo])
    vi.mocked(api.obtenerDespachos).mockResolvedValue([makeDespachoHoy()])
    vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([
      detalle, { ...detalle, id: 'dd-2', producto_id: 'p-hielo', cantidad: 4, es_ajuste: true, creado_en: '2026-10-13T12:05:00Z' },
    ])
    renderWithProviders(<Despachos />)
    fireEvent.click(await screen.findByRole('button', { name: /Ana López/ }))
    const lineas = within(await screen.findByText('Productos despachados').then(t => t.parentElement!)).getAllByRole('listitem')
    expect(lineas).toHaveLength(3)
    expect(lineas[0]).not.toHaveTextContent('Ajuste')
    expect(lineas[1]).toHaveTextContent('Hielo en Bolsa 1kg')
    expect(lineas[1]).toHaveTextContent(/Ajuste · 13-10-2026/)
  })
})
