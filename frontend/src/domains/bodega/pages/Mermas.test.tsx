import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
import Mermas from './Mermas'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>()
  return { ...actual, obtenerProductos: vi.fn(), obtenerSucursales: vi.fn(), obtenerTiposEmpaque: vi.fn() }
})
vi.mock('@/domains/bodega/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/bodega/api')>()
  return {
    ...actual,
    obtenerVendedores: vi.fn(),
    obtenerVendedoresHistorial: vi.fn(),
    obtenerCargaVendedores: vi.fn(),
    obtenerStockEnvases: vi.fn(),
    obtenerPaginaDespachos: vi.fn(),
    obtenerDetallesDespacho: vi.fn(),
    obtenerPaginaMermas: vi.fn(),
    registrarMermaBodega: vi.fn(),
    anularMermaBodega: vi.fn(),
  }
})

import * as catalog from '@/lib/catalog'
import * as api from '@/domains/bodega/api'
import type { Merma } from '../types'

const ahora = new Date().toISOString()
const productos = [
  { id: 'p-1', nombre: 'Bidón POL', tipo: 'agua', tipo_empaque_id: null, precio_base: 1000, activo: true, creado_en: ahora },
  { id: 'p-2', nombre: 'Hielo 5 kg', tipo: 'hielo', tipo_empaque_id: null, precio_base: 500, activo: true, creado_en: ahora },
  { id: 'p-viejo', nombre: 'Producto retirado', tipo: 'agua', tipo_empaque_id: null, precio_base: 500, activo: false, creado_en: ahora },
] as const
const envase = { id: 'te-1', nombre: 'Bandeja', categoria: 'uso_interno', activo: true } as const

const mermaBodega: Merma = {
  id: 'm-1', sucursal_id: 'suc-1', despacho_id: null, producto_id: 'p-1', tipo_empaque_id: null, cantidad: 3,
  motivo: 'Se rompió al apilar', anulado: false, creado_por: 'bodega-1', creado_en: ahora,
}
const mermaDespachoAnulada: Merma = {
  ...mermaBodega, id: 'm-2', despacho_id: 'd-1234567890', cantidad: 1200, motivo: 'Derrame', anulado: true, creado_por: 'otro-usuario',
}
const mermaEnvase: Merma = { ...mermaBodega, id: 'm-3', producto_id: null, tipo_empaque_id: 'te-1', cantidad: 2, motivo: 'Aplastada' }

const despacho = {
  id: 'd-1', sucursal_id: 'suc-1', vendedor_id: 'v-1', despachador_id: 'bodega-1', anulado: false,
  creado_por: 'bodega-1', creado_en: ahora, modificado_por: null, modificado_en: null,
}

const bodega = makePerfil({ id: 'bodega-1', rol: 'bodega', sucursal_id: 'suc-1', nombres: 'Bea', apellidos: 'Bodega' })
const admin = makePerfil({ id: 'admin-1', rol: 'administrador', sucursal_id: 'suc-1', nombres: 'Ada', apellidos: 'Admin' })

function pagina(filas: Merma[]) { return { filas, total: filas.length } }

beforeEach(() => {
  vi.mocked(catalog.obtenerSucursales).mockResolvedValue([{ id: 'suc-1', nombre: 'Matriz' } as never])
  vi.mocked(catalog.obtenerProductos).mockResolvedValue(productos as never)
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([envase] as never)
  vi.mocked(api.obtenerVendedores).mockResolvedValue([{ id: 'v-1', nombres: 'Vera', apellidos: 'Vendedora' }])
  vi.mocked(api.obtenerVendedoresHistorial).mockResolvedValue([{ id: 'v-1', nombres: 'Vera', apellidos: 'Vendedora', activo: true }])
  vi.mocked(api.obtenerCargaVendedores).mockResolvedValue([])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([])
  vi.mocked(api.obtenerPaginaDespachos).mockResolvedValue({ filas: [despacho], total: 1 })
  vi.mocked(api.obtenerDetallesDespacho).mockResolvedValue([
    { id: 'dd-1', despacho_id: 'd-1', producto_id: 'p-2', cantidad: 5, es_ajuste: false, creado_en: ahora },
    { id: 'dd-2', despacho_id: 'd-1', producto_id: 'p-2', cantidad: 2, es_ajuste: true, creado_en: ahora },
  ])
  vi.mocked(api.obtenerPaginaMermas).mockResolvedValue(pagina([mermaBodega, mermaDespachoAnulada, mermaEnvase]))
  vi.mocked(api.registrarMermaBodega).mockResolvedValue({ error: null, mermaId: 'm-nueva' })
  vi.mocked(api.anularMermaBodega).mockResolvedValue({ error: null })
})
afterEach(() => vi.clearAllMocks())

async function abrir(perfil = bodega) {
  renderWithProviders(<Mermas />, { perfil })
  await screen.findByRole('table', { name: 'Mermas de la sucursal' })
  return screen.getByRole('form', { name: 'Registrar merma' })
}
const elegir = (etiqueta: string, valor: string, ambito: HTMLElement) =>
  fireEvent.change(within(ambito).getByLabelText(etiqueta), { target: { value: valor } })
const escribir = (form: HTMLElement, cantidad: string, motivo: string) => {
  fireEvent.change(within(form).getByLabelText('Cantidad'), { target: { value: cantidad } })
  fireEvent.change(within(form).getByLabelText('Motivo'), { target: { value: motivo } })
}

describe('HU-29 · Mermas · lista', () => {
  it('muestra fecha, origen, ítem, cantidad, motivo, actor y estado', async () => {
    await abrir()
    const filas = within(screen.getByRole('table', { name: 'Mermas de la sucursal' })).getAllByRole('row')
    const [, primera, segunda, tercera] = filas
    expect(within(primera).getByText('Bodega')).toBeInTheDocument()
    expect(within(primera).getByText('Bidón POL')).toBeInTheDocument()
    expect(within(primera).getByText('Se rompió al apilar')).toBeInTheDocument()
    expect(within(primera).getByText('Bea Bodega (tú)')).toBeInTheDocument()
    expect(within(primera).getByText('Activa')).toBeInTheDocument()
    expect(within(segunda).getByText('Despacho #d-123456')).toBeInTheDocument()
    expect(within(segunda).getByText('1.200')).toBeInTheDocument()
    expect(within(segunda).getByText('Usuario ref. otro-usu')).toBeInTheDocument()
    expect(within(segunda).getByText('Anulada')).toBeInTheDocument()
    expect(within(tercera).getByText('Bandeja (envase vacío)')).toBeInTheDocument()
  })

  it('consulta las mermas de la sucursal con los filtros elegidos', async () => {
    await abrir()
    expect(api.obtenerPaginaMermas).toHaveBeenCalledWith('suc-1', { origen: undefined, anuladas: undefined, pagina: 1, tamanoPagina: 20 })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'anuladas' } })
    await waitFor(() => expect(api.obtenerPaginaMermas).toHaveBeenLastCalledWith('suc-1', expect.objectContaining({ anuladas: true })))
  })

  it('muestra el estado vacío y el error de lectura con reintento', async () => {
    vi.mocked(api.obtenerPaginaMermas).mockResolvedValue(pagina([]))
    renderWithProviders(<Mermas />, { perfil: bodega })
    expect(await screen.findByText('Aún no hay mermas registradas para esta sucursal.')).toBeInTheDocument()
  })

  it('no confunde un error de lectura con una lista vacía', async () => {
    vi.mocked(api.obtenerPaginaMermas).mockRejectedValue(new Error('x'))
    renderWithProviders(<Mermas />, { perfil: bodega })
    expect(await screen.findByText('No fue posible cargar las mermas. Inténtalo de nuevo.')).toBeInTheDocument()
    expect(screen.queryByText(/Aún no hay mermas/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('HU-29 · Mermas · anulación solo administrador', () => {
  it('bodega no ve la acción Anular', async () => {
    await abrir(bodega)
    expect(screen.queryByRole('button', { name: /Anular/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Acción' })).not.toBeInTheDocument()
  })

  it('administración ve Anular solo en las mermas activas', async () => {
    await abrir(admin)
    expect(screen.getAllByRole('button', { name: /^Anular merma de/ })).toHaveLength(2)
  })

  it('exige un motivo propio antes de anular y luego recarga las mermas', async () => {
    await abrir(admin)
    fireEvent.click(screen.getAllByRole('button', { name: /^Anular merma de Bidón POL/ })[0])
    const dialogo = await screen.findByRole('dialog', { name: 'Anular merma' })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Anular merma' }))
    expect(await within(dialogo).findByText('Indica el motivo de la anulación.')).toBeInTheDocument()
    expect(api.anularMermaBodega).not.toHaveBeenCalled()

    fireEvent.change(within(dialogo).getByLabelText('Motivo de la anulación'), { target: { value: '  Error de conteo ' } })
    const llamadasAntes = vi.mocked(api.obtenerPaginaMermas).mock.calls.length
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Anular merma' }))
    await waitFor(() => expect(api.anularMermaBodega).toHaveBeenCalledWith('m-1', 'Error de conteo'))
    expect(await screen.findByText('Merma anulada.')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(api.obtenerPaginaMermas).mock.calls.length).toBeGreaterThan(llamadasAntes))
  })

  it('muestra el error de la anulación y conserva el diálogo y el motivo', async () => {
    vi.mocked(api.anularMermaBodega).mockResolvedValue({ error: 'No tienes permisos para anular esta merma.' })
    await abrir(admin)
    fireEvent.click(screen.getAllByRole('button', { name: /^Anular merma de Bidón POL/ })[0])
    const dialogo = await screen.findByRole('dialog', { name: 'Anular merma' })
    fireEvent.change(within(dialogo).getByLabelText('Motivo de la anulación'), { target: { value: 'Duplicada' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Anular merma' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No tienes permisos para anular esta merma.')
    expect(within(dialogo).getByLabelText('Motivo de la anulación')).toHaveValue('Duplicada')
  })
})

describe('HU-29 · Mermas · registro', () => {
  it('registra una merma de producto de bodega con una clave de reintento y limpia el formulario', async () => {
    const form = await abrir()
    elegir('Producto', 'p-1', form)
    escribir(form, '3', '  Se rompió  ')
    const llamadasAntes = vi.mocked(api.obtenerPaginaMermas).mock.calls.length
    fireEvent.click(within(form).getByRole('button', { name: 'Registrar merma' }))
    await waitFor(() => expect(api.registrarMermaBodega).toHaveBeenCalledTimes(1))
    const [merma, clave] = vi.mocked(api.registrarMermaBodega).mock.calls[0]
    expect(merma).toEqual({ sucursal_id: 'suc-1', origen: 'bodega', despacho_id: null, producto_id: 'p-1', tipo_empaque_id: null, cantidad: 3, motivo: 'Se rompió' })
    expect(clave).toMatch(/^[0-9a-f-]{36}$/)
    expect(await within(form).findByText('Merma registrada.')).toBeInTheDocument()
    expect(within(form).getByLabelText('Motivo')).toHaveValue('')
    await waitFor(() => expect(vi.mocked(api.obtenerPaginaMermas).mock.calls.length).toBeGreaterThan(llamadasAntes))
  })

  it('ofrece solo productos activos y permite registrar un envase vacío', async () => {
    const form = await abrir()
    expect(within(form).queryByRole('option', { name: 'Producto retirado' })).not.toBeInTheDocument()
    elegir('Qué se perdió', 'envase', form)
    expect(within(form).queryByLabelText('Producto')).not.toBeInTheDocument()
    elegir('Tipo de envase', 'te-1', form)
    escribir(form, '2', 'Aplastada')
    fireEvent.click(within(form).getByRole('button', { name: 'Registrar merma' }))
    await waitFor(() => expect(api.registrarMermaBodega).toHaveBeenCalledTimes(1))
    expect(vi.mocked(api.registrarMermaBodega).mock.calls[0][0]).toMatchObject({ origen: 'bodega', producto_id: null, tipo_empaque_id: 'te-1', cantidad: 2 })
  })

  it('con origen despacho ofrece los despachos del día y solo los productos de ese despacho', async () => {
    const form = await abrir()
    elegir('Origen', 'despacho', form)
    expect(within(form).queryByLabelText('Tipo de envase')).not.toBeInTheDocument()
    expect(within(form).queryByLabelText('Qué se perdió')).not.toBeInTheDocument()
    expect(within(form).getByText(/devolución en estado malo/)).toBeInTheDocument()
    expect(within(form).getByLabelText('Producto')).toBeDisabled()
    elegir('Despacho', 'd-1', form)
    expect(within(form).getByRole('option', { name: /Vera Vendedora · \d\d:\d\d · #d-1/ })).toBeInTheDocument()
    const opciones = within(form).getAllByRole('option').map(o => o.textContent)
    expect(opciones).toContain('Hielo 5 kg')
    expect(opciones).not.toContain('Bidón POL')
    elegir('Producto', 'p-2', form)
    escribir(form, '2', 'Derrame')
    fireEvent.click(within(form).getByRole('button', { name: 'Registrar merma' }))
    await waitFor(() => expect(api.registrarMermaBodega).toHaveBeenCalledTimes(1))
    expect(vi.mocked(api.registrarMermaBodega).mock.calls[0][0]).toEqual({
      sucursal_id: 'suc-1', origen: 'despacho', despacho_id: 'd-1', producto_id: 'p-2', tipo_empaque_id: null, cantidad: 2, motivo: 'Derrame',
    })
  })

  it('valida en el formulario sin llamar a la base: motivo, cantidad e ítem obligatorios', async () => {
    const form = await abrir()
    fireEvent.click(within(form).getByRole('button', { name: 'Registrar merma' }))
    expect(await within(form).findByText('Selecciona un producto o un tipo de envase.')).toBeInTheDocument()
    expect(within(form).getByText('Ingresa una cantidad mayor que cero.')).toBeInTheDocument()
    expect(within(form).getByText('Indica el motivo de la merma.')).toBeInTheDocument()
    expect(api.registrarMermaBodega).not.toHaveBeenCalled()
  })

  it('reutiliza la misma clave al reintentar el mismo contenido y genera otra tras un éxito', async () => {
    vi.mocked(api.registrarMermaBodega)
      .mockResolvedValueOnce({ error: 'No fue posible completar la operación. Inténtalo de nuevo.', mermaId: null })
    const form = await abrir()
    elegir('Producto', 'p-1', form)
    escribir(form, '3', 'Se rompió')
    const enviar = within(form).getByRole('button', { name: 'Registrar merma' })
    fireEvent.click(enviar)
    expect(await within(form).findByRole('alert')).toHaveTextContent('No fue posible completar la operación.')
    // El formulario conserva sus valores para el reintento.
    expect(within(form).getByLabelText('Motivo')).toHaveValue('Se rompió')
    fireEvent.click(enviar)
    await waitFor(() => expect(api.registrarMermaBodega).toHaveBeenCalledTimes(2))
    const [[, clave1], [, clave2]] = vi.mocked(api.registrarMermaBodega).mock.calls
    expect(clave2).toBe(clave1)

    await within(form).findByText('Merma registrada.')
    elegir('Producto', 'p-1', form)
    escribir(form, '3', 'Se rompió')
    fireEvent.click(enviar)
    await waitFor(() => expect(api.registrarMermaBodega).toHaveBeenCalledTimes(3))
    expect(vi.mocked(api.registrarMermaBodega).mock.calls[2][1]).not.toBe(clave1)
  })

  it('cambia la clave cuando cambia el contenido del reintento', async () => {
    vi.mocked(api.registrarMermaBodega).mockResolvedValueOnce({ error: 'fallo', mermaId: null })
    const form = await abrir()
    elegir('Producto', 'p-1', form)
    escribir(form, '3', 'Se rompió')
    fireEvent.click(within(form).getByRole('button', { name: 'Registrar merma' }))
    await within(form).findByRole('alert')
    escribir(form, '4', 'Se rompió')
    fireEvent.click(within(form).getByRole('button', { name: 'Registrar merma' }))
    await waitFor(() => expect(api.registrarMermaBodega).toHaveBeenCalledTimes(2))
    const [[, clave1], [, clave2]] = vi.mocked(api.registrarMermaBodega).mock.calls
    expect(clave2).not.toBe(clave1)
  })

  it('deshabilita el envío paralelo mientras la solicitud está en curso', async () => {
    let resolver: (v: { error: null; mermaId: string }) => void = () => {}
    vi.mocked(api.registrarMermaBodega).mockReturnValue(new Promise(r => { resolver = r }))
    const form = await abrir()
    elegir('Producto', 'p-1', form)
    escribir(form, '3', 'Se rompió')
    const enviar = within(form).getByRole('button', { name: 'Registrar merma' })
    fireEvent.click(enviar)
    fireEvent.submit(form)
    fireEvent.click(enviar)
    expect(await within(form).findByRole('button', { name: 'Registrando...' })).toBeDisabled()
    expect(api.registrarMermaBodega).toHaveBeenCalledTimes(1)
    resolver({ error: null, mermaId: 'm-nueva' })
    expect(await within(form).findByText('Merma registrada.')).toBeInTheDocument()
    expect(api.registrarMermaBodega).toHaveBeenCalledTimes(1)
  })
})
