import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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