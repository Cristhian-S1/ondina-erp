import { act, fireEvent, screen } from '@testing-library/react'
import { focusManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { obtenerCantidadVentasJornada, obtenerMiComision } from '../api'
import MiComision from './MiComision'

vi.mock('../api', () => ({ obtenerCantidadVentasJornada: vi.fn(), obtenerMiComision: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(obtenerMiComision).mockResolvedValue([])
  vi.mocked(obtenerCantidadVentasJornada).mockResolvedValue(1)
})
afterEach(() => focusManager.setFocused(undefined))

describe('MiComision query', () => {
  it('FE-07 · refreshes both reads when the app regains focus', async () => {
    vi.mocked(obtenerCantidadVentasJornada).mockResolvedValueOnce(1).mockResolvedValue(2)
    renderWithProviders(<MiComision />)
    expect(await screen.findByText('1')).toBeInTheDocument()
    await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true) })
    expect(await screen.findByText('2')).toBeInTheDocument()
    expect(obtenerMiComision).toHaveBeenCalledTimes(2)
  })
  it('shows safe errors and recovers without reloading the page', async () => {
    vi.mocked(obtenerMiComision).mockRejectedValueOnce(new Error('private SQL detail')).mockResolvedValue([])
    renderWithProviders(<MiComision />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar tu comisión.')
    expect(screen.getByRole('alert')).not.toHaveTextContent('SQL')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Ventas consideradas')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
