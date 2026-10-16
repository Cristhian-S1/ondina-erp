import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { renderWithProviders as render } from '../../../test/render'
import IndicadoresProduccion from './IndicadoresProduccion'
import { obtenerIndicadoresProduccion } from '../api'

vi.mock('../api', () => ({ obtenerIndicadoresProduccion: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

describe('REV-4 · IndicadoresProduccion', () => {
  it.each([
    new Error('Could not find public.private_rpc in the schema cache'),
    new TypeError('Failed to fetch: private endpoint'),
    { code: 'P0001', message: 'private constraint failed' },
  ])('oculta un rechazo técnico en la alerta', async (causa) => {
    vi.mocked(obtenerIndicadoresProduccion).mockRejectedValue(causa)
    render(<IndicadoresProduccion perfilId="" sucursalId="s-1" productos={[]} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible completar la operación. Inténtalo de nuevo.')
    expect(screen.queryByText(/private|schema cache|Failed to fetch/)).not.toBeInTheDocument()
  })

  it('conserva el mensaje público traducido por el servicio', async () => {
    vi.mocked(obtenerIndicadoresProduccion).mockRejectedValue(new Error('No hay envases vacíos suficientes.'))
    render(<IndicadoresProduccion perfilId="" sucursalId="s-1" productos={[]} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay envases vacíos suficientes.')
  })
})


it('R2-09 · cambia clave y lectura al cruzar medianoche de Santiago', async () => {
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
  const { render: renderPlain } = await import('@testing-library/react')
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-15T02:59:59Z'))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.mocked(obtenerIndicadoresProduccion).mockResolvedValue([])
  try {
    renderPlain(<QueryClientProvider client={client}><IndicadoresProduccion perfilId="u1" sucursalId="s1" productos={[]} /></QueryClientProvider>)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(obtenerIndicadoresProduccion).toHaveBeenLastCalledWith('s1', '2026-10-14', '2026-10-14')
    expect(client.getQueryState(['produccion', 'u1', 's1', 'indicadores', 'hoy', '2026-10-14'])).toBeDefined()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(obtenerIndicadoresProduccion).toHaveBeenLastCalledWith('s1', '2026-10-15', '2026-10-15')
    expect(client.getQueryState(['produccion', 'u1', 's1', 'indicadores', 'hoy', '2026-10-15'])).toBeDefined()
  } finally { client.clear(); vi.useRealTimers() }
})
