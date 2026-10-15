import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test/render'
import Produccion from './Produccion'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()

  return {
    ...actual,
    useLocation: () => ({
      pathname: '/produccion/registrar',
    }),
  }
})

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}))

vi.mock('../../../lib/catalog', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../lib/catalog')>()

  return {
    ...actual,
    obtenerProductos: vi.fn(),
    obtenerTiposEmpaque: vi.fn(),
  }
})

vi.mock('../api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../api')>()

  return {
    ...actual,
    obtenerProducciones: vi.fn(),
  obtenerPaginaProducciones: vi.fn(async (scope: Parameters<typeof api.obtenerProducciones>[0]) => { const filas = await api.obtenerProducciones(scope); return { filas, total: filas.length } }),
    obtenerMermas: vi.fn(),
  obtenerPaginaMermas: vi.fn(async (scope: Parameters<typeof api.obtenerMermas>[0]) => { const filas = await api.obtenerMermas(scope); return { filas, total: filas.length } }),
    obtenerIncidencias: vi.fn(),
  obtenerPaginaIncidencias: vi.fn(async (scope: Parameters<typeof api.obtenerIncidencias>[0]) => { const filas = await api.obtenerIncidencias(scope); return { filas, total: filas.length } }),
    obtenerEnvasesDisponibles: vi.fn(),
    registrarProduccion: vi.fn(),
    registrarIncidencia: vi.fn(),
  }
})

import * as catalog from '../../../lib/catalog'
import * as api from '../api'

beforeEach(() => {
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([])
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([])

  vi.mocked(api.obtenerMermas).mockResolvedValue([])
  vi.mocked(api.obtenerProducciones).mockResolvedValue([])
  vi.mocked(api.obtenerIncidencias).mockResolvedValue([])
  vi.mocked(api.obtenerEnvasesDisponibles).mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Producción', () => {
  it('muestra el formulario para registrar producción', async () => {
    renderWithProviders(<Produccion />)

    await waitFor(() => {
      expect(
        screen.getByText('Nueva producción'),
      ).toBeTruthy()
    })

    expect(
      screen.getByRole('button', {
        name: 'Registrar producción',
      }),
    ).toBeTruthy()
  })

  it('muestra el estado vacío cuando no hay producciones registradas', async () => {
    renderWithProviders(<Produccion />)

    await waitFor(() => {
      expect(
        screen.getByText('No hay producciones registradas.'),
      ).toBeTruthy()
    })
  })
})

it('FE-05 · muestra error del catálogo sin presentarlo como producción vacía', async () => {
  vi.mocked(catalog.obtenerProductos).mockRejectedValue(new Error('Fallo de consulta'))
  renderWithProviders(<Produccion />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar los datos de producción')
  expect(screen.queryByText('No hay producciones registradas.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Registrar producción' })).toBeDisabled()
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([])
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar lista' }))
  expect(await screen.findByText('No hay producciones registradas.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('FE-05 · conserva cantidad y observaciones si falla Actualizar', async () => {
  renderWithProviders(<Produccion />)
  fireEvent.change(await screen.findByLabelText('Cantidad'), { target: { value: '12' } })
  fireEvent.change(screen.getByLabelText('Observaciones (opcional)'), { target: { value: 'Turno de mañana' } })
  vi.mocked(catalog.obtenerProductos).mockRejectedValue(new Error('Fallo de consulta'))
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar lista' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Cantidad')).toHaveValue('12')
  expect(screen.getByLabelText('Observaciones (opcional)')).toHaveValue('Turno de mañana')
})

it('F3 · el formulario no crece con la lista: columnas independientes y lista con alto propio', async () => {
  renderWithProviders(<Produccion />)
  const formulario = (await screen.findByText('Nueva producción')).closest('form')!
  expect(formulario.className).toMatch(/self-start/)
  expect(formulario.parentElement!.className).toMatch(/items-start/)
  const lista = await screen.findByTestId('lista-produccion-reciente')
  expect(lista.className).toMatch(/xl:max-h-/)
  expect(formulario.contains(lista)).toBe(false)
})

describe('F3b · cantidad con InputNumerico', () => {
  const producto = { id: 'p1', nombre: 'Bidón POL', tipo: 'agua', tipo_empaque_id: 'e1', precio_base: 1, activo: true, creado_en: '' } as never

  it('rechaza texto y formatea miles en la cantidad de producción', async () => {
    renderWithProviders(<Produccion />)
    const campo = await screen.findByLabelText('Cantidad')
    fireEvent.change(campo, { target: { value: 'abc' } })
    expect(campo).toHaveValue('')
    fireEvent.change(campo, { target: { value: '1234' } })
    expect(campo).toHaveValue('1.234')
    expect(campo).toHaveAttribute('placeholder', '0')
  })

  it('muestra en tiempo real el error si la cantidad supera los envases vacíos disponibles', async () => {
    vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto])
    vi.mocked(api.obtenerEnvasesDisponibles).mockResolvedValue([{ tipo_empaque_id: 'e1', nombre: 'Bidón', cantidad: 5, modificado_en: '2026-10-14T12:00:00Z' }])
    renderWithProviders(<Produccion />)
    await screen.findAllByRole('option', { name: 'Bidón POL' })
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'p1' } })
    const campo = screen.getByLabelText('Cantidad')
    fireEvent.change(campo, { target: { value: '9' } })
    expect(await screen.findByText('Solo hay 5 envases vacíos disponibles para este producto.')).toBeInTheDocument()
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(campo, { target: { value: '5' } })
    expect(screen.queryByText(/envases vacíos disponibles para este producto/)).not.toBeInTheDocument()
  })

  it('bloquea el envío si la cantidad supera los envases disponibles', async () => {
    vi.mocked(catalog.obtenerProductos).mockResolvedValue([producto])
    vi.mocked(api.obtenerEnvasesDisponibles).mockResolvedValue([{ tipo_empaque_id: 'e1', nombre: 'Bidón', cantidad: 5, modificado_en: '2026-10-14T12:00:00Z' }])
    renderWithProviders(<Produccion />)
    await screen.findAllByRole('option', { name: 'Bidón POL' })
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar producción' }))
    expect(api.registrarProduccion).not.toHaveBeenCalled()
  })
})
