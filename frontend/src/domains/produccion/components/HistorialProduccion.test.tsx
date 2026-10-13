import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HistorialProduccion from './HistorialProduccion'
import { obtenerHistorialProduccion } from '../api'

vi.mock('../api', () => ({ obtenerHistorialProduccion: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

describe('REV-4 · HistorialProduccion', () => {
  it.each([
    new Error('Could not find public.private_rpc in the schema cache'),
    new TypeError('Failed to fetch: private endpoint'),
    { code: 'P0001', message: 'private constraint failed' },
  ])('oculta un rechazo técnico en la alerta', async (causa) => {
    vi.mocked(obtenerHistorialProduccion).mockRejectedValue(causa)
    render(<HistorialProduccion sucursalId="s-1" productos={[]} versionDatos={0} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible completar la operación. Inténtalo de nuevo.')
    expect(screen.queryByText(/private|schema cache|Failed to fetch/)).not.toBeInTheDocument()
  })

  it('conserva el mensaje público traducido por el servicio', async () => {
    vi.mocked(obtenerHistorialProduccion).mockRejectedValue(new Error('No hay envases vacíos suficientes.'))
    render(<HistorialProduccion sucursalId="s-1" productos={[]} versionDatos={0} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay envases vacíos suficientes.')
  })
})
