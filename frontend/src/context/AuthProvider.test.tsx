import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './auth-context'
import { makePerfil } from '@/test/render'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(), signOut: vi.fn(), signInWithPassword: vi.fn(),
  onAuthStateChange: vi.fn(), single: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {
  auth, from: () => ({ select: () => ({ eq: () => ({ single: auth.single }) }) }),
} }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const session = (id: string) => ({ user: { id } }) as Session
let change: (event: string, session: Session | null) => void
function Consumer() {
  const { perfil, loading, signOut } = useAuth()
  return <><p>{loading ? 'loading' : perfil?.id ?? 'anonymous'}</p>
    <button onClick={() => void signOut().catch(() => {})}>Logout</button></>
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><AuthProvider><Consumer /></AuthProvider></QueryClientProvider>)
  return client
}
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  auth.getSession.mockResolvedValue({ data: { session: session('user-1') }, error: null })
  auth.single.mockResolvedValue({ data: makePerfil(), error: null })
  auth.signOut.mockResolvedValue({ error: null })
  auth.onAuthStateChange.mockImplementation((callback) => {
    change = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})

describe('AuthProvider session isolation', () => {
  it('waits for the profile query before ending loading', async () => {
    const profile = deferred<{ data: ReturnType<typeof makePerfil>; error: null }>()
    auth.single.mockReturnValue(profile.promise)
    setup()
    await waitFor(() => expect(auth.single).toHaveBeenCalled())
    expect(screen.getByText('loading')).toBeInTheDocument()
    await act(async () => profile.resolve({ data: makePerfil(), error: null }))
    expect(screen.getByText('user-1')).toBeInTheDocument()
  })
  it('blocks inactive profiles with a Spanish message', async () => {
    auth.single.mockResolvedValue({ data: makePerfil({ activo: false }), error: null })
    setup()
    await screen.findByText('anonymous')
    expect(screen.getByRole('alert')).toHaveTextContent(/inactiv/i)
  })
  it('distinguishes a missing profile from a query failure', async () => {
    auth.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    setup()
    await screen.findByText('anonymous')
    expect(screen.getByRole('alert')).toHaveTextContent(/no tiene un perfil/i)
  })
  it('retains the current profile and draft when logout fails', async () => {
    auth.signOut.mockResolvedValue({ error: new Error('offline') })
    const client = setup()
    await screen.findByText('user-1')
    client.setQueryData(['private'], 'cached')
    sessionStorage.setItem('ondina:draft-registrar-venta:user-1', 'draft')
    fireEvent.click(screen.getByText('Logout'))
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled())
    await screen.findByRole('alert')
    expect(screen.getByText('user-1')).toBeInTheDocument()
    expect(client.getQueryData(['private'])).toBe('cached')
    expect(sessionStorage.getItem('ondina:draft-registrar-venta:user-1')).toBe('draft')
  })
  it('ignores late profile responses and clears cached data on identity change', async () => {
    const old = deferred<{ data: ReturnType<typeof makePerfil>; error: null }>()
    auth.single.mockReturnValueOnce(old.promise)
    const client = setup()
    await waitFor(() => expect(auth.single).toHaveBeenCalledTimes(1))
    client.setQueryData(['private'], 'old identity')
    auth.single.mockResolvedValue({ data: makePerfil({ id: 'user-2' }), error: null })
    await act(async () => change('SIGNED_IN', session('user-2')))
    expect(await screen.findByText('user-2')).toBeInTheDocument()
    expect(client.getQueryData(['private'])).toBeUndefined()
    await act(async () => old.resolve({ data: makePerfil(), error: null }))
    expect(screen.getByText('user-2')).toBeInTheDocument()
  })
  it('clears the cache and draft on successful logout', async () => {
    const client = setup()
    await screen.findByText('user-1')
    client.setQueryData(['private'], 'cached')
    sessionStorage.setItem('ondina:draft-registrar-venta:user-1', 'draft')
    fireEvent.click(screen.getByText('Logout'))
    await screen.findByText('anonymous')
    expect(client.getQueryData(['private'])).toBeUndefined()
    expect(sessionStorage.getItem('ondina:draft-registrar-venta:user-1')).toBeNull()
  })
  it('ignores getSession when a newer auth event has already arrived', async () => {
    const initial = deferred<{ data: { session: Session }; error: null }>()
    auth.getSession.mockReturnValue(initial.promise)
    setup()
    auth.single.mockResolvedValue({ data: makePerfil({ id: 'user-2' }), error: null })
    await act(async () => change('SIGNED_IN', session('user-2')))
    await screen.findByText('user-2')
    await act(async () => initial.resolve({ data: { session: session('user-1') }, error: null }))
    expect(screen.getByText('user-2')).toBeInTheDocument()
  })
})
