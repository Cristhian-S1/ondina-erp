import { useState } from 'react'
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
function OpenForm() {
  const [value, setValue] = useState('')
  return <input aria-label="Open form" value={value} onChange={(event) => setValue(event.target.value)} />
}
function Consumer() {
  const { perfil, loading, signOut } = useAuth()
  return <><p>{loading ? 'loading' : perfil?.id ?? 'anonymous'}</p>
    {perfil && <output aria-label="Profile permissions">{perfil.rol}:{perfil.sucursal_id}</output>}
    <button onClick={() => void signOut().catch(() => {})}>Logout</button>
    {!loading && perfil && <OpenForm />}</>
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
  it.each(['TOKEN_REFRESHED', 'USER_UPDATED', 'SIGNED_IN'])('keeps the loaded profile and open form mounted on same-user %s', async (event) => {
    const client = setup()
    await screen.findByText('user-1')
    fireEvent.change(screen.getByRole('textbox', { name: 'Open form' }), { target: { value: 'Unsaved sale' } })
    client.setQueryData(['private'], 'cached')
    const pending = deferred<{ data: ReturnType<typeof makePerfil>; error: null }>()
    auth.single.mockReturnValue(pending.promise)
    await act(async () => {
      change(event, session('user-1'))
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(screen.getByText('user-1')).toBeInTheDocument()
    expect(screen.queryByText('loading')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Open form' })).toHaveValue('Unsaved sale')
    expect(client.getQueryData(['private'])).toBe('cached')
    await act(async () => pending.resolve({ data: makePerfil(), error: null }))
    expect(screen.getByRole('textbox', { name: 'Open form' })).toHaveValue('Unsaved sale')
    expect(client.getQueryData(['private'])).toBe('cached')
  })
  it('defers a new identity profile query until after the auth callback returns', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    setup()
    await screen.findByText('anonymous')
    act(() => {
      change('SIGNED_IN', session('user-1'))
      expect(auth.single).not.toHaveBeenCalled()
    })
    expect(await screen.findByText('user-1')).toBeInTheDocument()
    expect(auth.single).toHaveBeenCalledTimes(1)
  })
  it('clears the cache and waits for the new profile when a loaded identity changes', async () => {
    const client = setup()
    await screen.findByText('user-1')
    client.setQueryData(['private'], 'old identity')
    const profile = deferred<{ data: ReturnType<typeof makePerfil>; error: null }>()
    auth.single.mockReturnValueOnce(profile.promise)
    act(() => change('SIGNED_IN', session('user-2')))
    await waitFor(() => expect(auth.single).toHaveBeenCalledTimes(2))
    expect(client.getQueryData(['private'])).toBeUndefined()
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Open form' })).not.toBeInTheDocument()
    await act(async () => profile.resolve({ data: makePerfil({ id: 'user-2' }), error: null }))
    expect(screen.getByText('user-2')).toBeInTheDocument()
  })
  it('invalidates the previous profile before the deferred identity query starts', async () => {
    const old = deferred<{ data: ReturnType<typeof makePerfil>; error: null }>()
    const next = deferred<{ data: ReturnType<typeof makePerfil>; error: null }>()
    auth.single.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    setup()
    await waitFor(() => expect(auth.single).toHaveBeenCalledTimes(1))
    vi.useFakeTimers()
    try {
      act(() => change('SIGNED_IN', session('user-2')))
      await act(async () => old.resolve({ data: makePerfil(), error: null }))
      expect(screen.getByText('loading')).toBeInTheDocument()
      expect(screen.queryByText('user-1')).not.toBeInTheDocument()
      expect(auth.single).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.runOnlyPendingTimersAsync() })
      expect(auth.single).toHaveBeenCalledTimes(2)
      await act(async () => next.resolve({ data: makePerfil({ id: 'user-2' }), error: null }))
      expect(screen.getByText('user-2')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
  it.each(['SIGNED_IN', 'SIGNED_OUT'])('clears a loaded identity synchronously on %s before timers', async (event) => {
    const client = setup()
    await screen.findByText('user-1')
    client.setQueryData(['private'], 'private user-1')
    sessionStorage.setItem('ondina:draft-registrar-venta:user-1', 'draft')
    vi.useFakeTimers()
    try {
      act(() => change(event, event === 'SIGNED_OUT' ? null : session('user-2')))
      expect(screen.queryByText('user-1')).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: 'Open form' })).not.toBeInTheDocument()
      expect(screen.getByText(event === 'SIGNED_OUT' ? 'anonymous' : 'loading')).toBeInTheDocument()
      expect(client.getQueryData(['private'])).toBeUndefined()
      expect(sessionStorage.getItem('ondina:draft-registrar-venta:user-1')).toBeNull()
      expect(auth.single).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
  it.each([
    { data: makePerfil({ activo: false }), error: null, message: /inactiva/i },
    { data: null, error: { code: 'PGRST116' }, message: /no tiene un perfil/i },
  ])('blocks and clears data when background refresh rejects the profile: $message', async ({ data, error, message }) => {
    const client = setup()
    await screen.findByText('user-1')
    client.setQueryData(['private'], 'cached')
    sessionStorage.setItem('ondina:draft-registrar-venta:user-1', 'draft')
    auth.single.mockResolvedValue({ data, error })
    vi.useFakeTimers()
    try {
      act(() => change('TOKEN_REFRESHED', session('user-1')))
      expect(screen.getByText('user-1')).toBeInTheDocument()
      expect(screen.queryByText('loading')).not.toBeInTheDocument()
      expect(auth.single).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.runOnlyPendingTimersAsync() })
      expect(screen.getByText('anonymous')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(message)
      expect(client.getQueryData(['private'])).toBeUndefined()
      expect(sessionStorage.getItem('ondina:draft-registrar-venta:user-1')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
  it.each([
    { rol: 'bodega' as const, sucursal_id: 'suc-1' },
    { rol: 'vendedor' as const, sucursal_id: 'suc-2' },
  ])('applies refreshed permissions and clears previous data: $rol / $sucursal_id', async (permissions) => {
    const client = setup()
    await screen.findByText('user-1')
    fireEvent.change(screen.getByRole('textbox', { name: 'Open form' }), { target: { value: 'Unsaved sale' } })
    client.setQueryData(['private'], 'cached')
    auth.single.mockResolvedValue({ data: makePerfil(permissions), error: null })
    vi.useFakeTimers()
    try {
      act(() => change('TOKEN_REFRESHED', session('user-1')))
      await act(async () => { await vi.runOnlyPendingTimersAsync() })
      expect(screen.getByLabelText('Profile permissions')).toHaveTextContent(`${permissions.rol}:${permissions.sucursal_id}`)
      expect(screen.getByRole('textbox', { name: 'Open form' })).toHaveValue('Unsaved sale')
      expect(client.getQueryData(['private'])).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
  it('ignores a late background profile response after an identity change', async () => {
    setup()
    await screen.findByText('user-1')
    const refresh = deferred<{ data: ReturnType<typeof makePerfil>; error: null }>()
    auth.single.mockReturnValueOnce(refresh.promise)
    vi.useFakeTimers()
    try {
      act(() => change('TOKEN_REFRESHED', session('user-1')))
      await act(async () => { await vi.runOnlyPendingTimersAsync() })
      auth.single.mockResolvedValue({ data: makePerfil({ id: 'user-2' }), error: null })
      act(() => change('SIGNED_IN', session('user-2')))
      await act(async () => { await vi.runOnlyPendingTimersAsync() })
      expect(screen.getByText('user-2')).toBeInTheDocument()
      await act(async () => refresh.resolve({ data: makePerfil({ activo: false }), error: null }))
      expect(screen.getByText('user-2')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
  it('discards a deferred profile query when logout completes first', async () => {
    setup()
    await screen.findByText('user-1')
    vi.useFakeTimers()
    try {
      act(() => change('SIGNED_IN', session('user-2')))
      await act(async () => fireEvent.click(screen.getByText('Logout')))
      expect(screen.getByText('anonymous')).toBeInTheDocument()
      await act(async () => { await vi.runOnlyPendingTimersAsync() })
      expect(auth.single).toHaveBeenCalledTimes(1)
      expect(screen.getByText('anonymous')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
