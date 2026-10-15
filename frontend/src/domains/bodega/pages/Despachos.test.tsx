import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
import Despachos from './Despachos'
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
    obtenerVendedores: vi.fn(),
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
