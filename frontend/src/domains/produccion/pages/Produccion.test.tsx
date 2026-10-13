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
    obtenerMermas: vi.fn(),
    obtenerIncidencias: vi.fn(),
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
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
  expect(await screen.findByText('No hay producciones registradas.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('FE-05 · conserva cantidad y observaciones si falla Actualizar', async () => {
  renderWithProviders(<Produccion />)
  fireEvent.change(await screen.findByLabelText('Cantidad'), { target: { value: '12' } })
  fireEvent.change(screen.getByLabelText('Observaciones (opcional)'), { target: { value: 'Turno de mañana' } })
  vi.mocked(catalog.obtenerProductos).mockRejectedValue(new Error('Fallo de consulta'))
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Cantidad')).toHaveValue('12')
  expect(screen.getByLabelText('Observaciones (opcional)')).toHaveValue('Turno de mañana')
})
