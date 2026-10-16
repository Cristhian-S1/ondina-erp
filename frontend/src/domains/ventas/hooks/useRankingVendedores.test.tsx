import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { mesActualSantiago, useRankingVendedores } from './useRankingVendedores'
import { obtenerRankingVendedores } from '../api'
import { AuthContext } from '@/context/auth-context'
import { makePerfil } from '@/test/render'

vi.mock('../api', () => ({ obtenerRankingVendedores: vi.fn() }))

describe('mesActualSantiago', () => {
  afterEach(() => vi.useRealTimers())

  it('usa el mes de Santiago, no el de UTC, a fin de mes a las 22:00 en Chile', () => {
    // 31-oct-2026 22:00 en Chile (UTC-3 en verano austral desde sept) = 01-nov 01:00 UTC
    expect(mesActualSantiago(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10')
  })

  it('usa el mes de Santiago en el cambio de mes real', () => {
    expect(mesActualSantiago(new Date('2026-11-01T03:30:00Z'))).toBe('2026-11')
  })

  it('con fecha simulada devuelve el mes de Santiago por defecto', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01T01:00:00Z'))
    expect(mesActualSantiago()).toBe('2026-10')
  })
})

describe('useRankingVendedores', () => {
  beforeEach(() => vi.mocked(obtenerRankingVendedores).mockReset())

  function wrapper(client: QueryClient, rol: 'vendedor' | 'administrador' = 'vendedor') {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ perfil: makePerfil({ rol }) } as never}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    )
  }

  it('lee con clave por mes y ámbito y permite reintentar', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(obtenerRankingVendedores).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([])
    const { result } = renderHook(() => useRankingVendedores('2026-10'), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    await result.current.refetch()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(obtenerRankingVendedores).toHaveBeenCalledWith('2026-10')
    expect(client.getQueryCache().getAll()[0].queryKey).toEqual(['ventas', 'ranking', '2026-10', 'user-1', 'suc-1', 'vendedor'])
  })
})
