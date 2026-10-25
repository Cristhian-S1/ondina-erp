import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
import CuadreDiario from './CuadreDiario'
import { fechaSantiago, inicioPeriodo } from '@/lib/jornada'

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
    obtenerCuadreDiario: vi.fn(),
  }
})

import * as catalog from '@/lib/catalog'
import * as api from '@/domains/bodega/api'
import type { FilaCuadre } from '../types'

const hoy = fechaSantiago(new Date())
const bodega = makePerfil({ id: 'bodega-1', rol: 'bodega', sucursal_id: 'suc-1' })

const sinComparacion: FilaCuadre = {
  sucursal_id: 'suc-1', vendedor_id: 'v-1', fecha: '2026-10-24', producto_id: 'p-1',
  despachado: 10, vendido: 4, devuelto: 2, mermas: 1, esperado_en_carga: 3,
  saldo_inicial: null, carga_actual: null, diferencia_carga: null, comparacion_disponible: false,
}
const conComparacion: FilaCuadre = {
  ...sinComparacion, fecha: hoy, vendedor_id: 'v-2', producto_id: 'p-2', despachado: 1200, esperado_en_carga: -5,
  saldo_inicial: 7, carga_actual: 10, diferencia_carga: 0, comparacion_disponible: true,
}

beforeEach(() => {
  vi.mocked(catalog.obtenerSucursales).mockResolvedValue([{ id: 'suc-1', nombre: 'Matriz' } as never])
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([
    { id: 'p-1', nombre: 'Bidón POL', activo: true }, { id: 'p-2', nombre: 'Hielo 5 kg', activo: true },
  ] as never)
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([])
  vi.mocked(api.obtenerVendedores).mockResolvedValue([{ id: 'v-1', nombres: 'Vera', apellidos: 'Vendedora' }])
  vi.mocked(api.obtenerVendedoresHistorial).mockResolvedValue([
    { id: 'v-1', nombres: 'Vera', apellidos: 'Vendedora', activo: true },
    { id: 'v-2', nombres: 'Iván', apellidos: 'Retirado', activo: false },
  ])
  vi.mocked(api.obtenerCargaVendedores).mockResolvedValue([])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([])
  vi.mocked(api.obtenerCuadreDiario).mockResolvedValue([sinComparacion, conComparacion])
})
afterEach(() => vi.clearAllMocks())

async function abrir() {
  renderWithProviders(<CuadreDiario />, { perfil: bodega })
  await screen.findByRole('heading', { name: 'Cuadre diario' })
}

describe('HU-29 · Cuadre diario', () => {
  it('consulta por defecto solo hoy y sin filtro de vendedor', async () => {
    await abrir()
    await screen.findByRole('table')
    expect(api.obtenerCuadreDiario).toHaveBeenCalledWith('suc-1', hoy, hoy, null)
    expect(screen.getByLabelText('Desde')).toHaveValue(hoy)
    expect(screen.getByLabelText('Hasta')).toHaveValue(hoy)
  })

  it('muestra despachado, vendido, devuelto, mermas y el saldo de movimientos del día', async () => {
    await abrir()
    const tabla = await screen.findByRole('table', { name: 'Cuadre diario por vendedor y producto' })
    expect(within(tabla).getByRole('columnheader', { name: 'Saldo de movimientos del día' })).toBeInTheDocument()
    const [, primera, segunda] = within(tabla).getAllByRole('row')
    expect(within(primera).getByText('24-10-2026')).toBeInTheDocument()
    expect(within(primera).getByText('Vera Vendedora')).toBeInTheDocument()
    expect(within(primera).getByText('Bidón POL')).toBeInTheDocument()
    for (const valor of ['10', '4', '2', '1', '3']) expect(within(primera).getAllByText(valor).length).toBeGreaterThan(0)
    expect(within(segunda).getByText('Iván Retirado (inactivo)')).toBeInTheDocument()
    expect(within(segunda).getByText('1.200')).toBeInTheDocument()
    // Un saldo diario negativo es válido y no se recorta.
    expect(within(segunda).getByText('-5')).toBeInTheDocument()
  })

  it('muestra «Comparación no disponible» cuando la base no la ofrece y los valores cuando sí', async () => {
    await abrir()
    const tabla = await screen.findByRole('table')
    const [, primera, segunda] = within(tabla).getAllByRole('row')
    expect(within(primera).getByText('Comparación no disponible')).toBeInTheDocument()
    expect(within(primera).queryByText(/Carga actual/)).not.toBeInTheDocument()
    expect(within(segunda).queryByText('Comparación no disponible')).not.toBeInTheDocument()
    expect(within(segunda).getByText(/Saldo inicial/)).toHaveTextContent('Saldo inicial: 7')
    expect(within(segunda).getByText(/Carga actual \(hoy\)/)).toHaveTextContent('Carga actual (hoy): 10')
    expect(within(segunda).getByText(/Diferencia/)).toHaveTextContent('Diferencia: 0')
  })

  it('ofrece también a los vendedores inactivos y filtra por vendedor', async () => {
    await abrir()
    const selector = screen.getByLabelText('Vendedor')
    expect(within(selector).getByRole('option', { name: 'Iván Retirado (inactivo)' })).toBeInTheDocument()
    fireEvent.change(selector, { target: { value: 'v-2' } })
    await waitFor(() => expect(api.obtenerCuadreDiario).toHaveBeenLastCalledWith('suc-1', hoy, hoy, 'v-2'))
  })

  it('muestra un estado vacío con el rango consultado', async () => {
    vi.mocked(api.obtenerCuadreDiario).mockResolvedValue([])
    await abrir()
    expect(await screen.findByText(/No hay movimientos entre/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('no confunde un fallo con un vacío y permite reintentar', async () => {
    vi.mocked(api.obtenerCuadreDiario).mockRejectedValueOnce(new Error('No tienes permisos para consultar este cuadre.'))
    await abrir()
    expect(await screen.findByText('No tienes permisos para consultar este cuadre.')).toBeInTheDocument()
    expect(screen.queryByText(/No hay movimientos/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('valida el rango sin consultar: más de 31 días, futuro y orden invertido', async () => {
    await abrir()
    await screen.findByRole('table')
    vi.mocked(api.obtenerCuadreDiario).mockClear()

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: inicioPeriodo(hoy, 31) } })
    expect(await screen.findByText('El rango no puede superar 31 días.')).toBeInTheDocument()
    expect(screen.getByText('Corrige el rango de fechas para consultar el cuadre.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: inicioPeriodo(hoy, 30) } })
    await waitFor(() => expect(api.obtenerCuadreDiario).toHaveBeenLastCalledWith('suc-1', inicioPeriodo(hoy, 30), hoy, null))
    expect(screen.queryByText('El rango no puede superar 31 días.')).not.toBeInTheDocument()

    vi.mocked(api.obtenerCuadreDiario).mockClear()
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: inicioPeriodo(hoy, -1) } })
    expect(await screen.findByText('No se pueden consultar fechas futuras.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: inicioPeriodo(hoy, 40) } })
    expect(await screen.findByText('La fecha final no puede ser anterior a la inicial.')).toBeInTheDocument()
    expect(api.obtenerCuadreDiario).not.toHaveBeenCalled()
  })
})
