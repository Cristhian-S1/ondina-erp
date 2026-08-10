import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../context/auth-context'
import type { Perfil } from '../types'

const perfilBase: Perfil = {
  id: 'user-1',
  sucursal_id: 'suc-1',
  nombres: 'Ana',
  apellidos: 'López',
  rut: '12345678-9',
  telefono: null,
  rol: 'vendedor',
  activo: true,
  creado_en: '2026-01-01T00:00:00Z',
}

export function makePerfil(override: Partial<Perfil> = {}): Perfil {
  return { ...perfilBase, ...override }
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  })
}

interface RenderOptionsExt extends RenderOptions {
  perfil?: Perfil | null
  authValue?: Partial<AuthContextValue>
}

export function renderWithProviders(
  ui: ReactNode,
  { perfil = makePerfil(), authValue, ...rest }: RenderOptionsExt = {},
) {
  const queryClient = makeQueryClient()
  const value: AuthContextValue = {
    perfil,
    loading: false,
    signIn: authValue?.signIn ?? (async () => {}),
    signOut: authValue?.signOut ?? (async () => {}),
    ...authValue,
  }
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return render(ui, { wrapper: Wrapper, ...rest })
}