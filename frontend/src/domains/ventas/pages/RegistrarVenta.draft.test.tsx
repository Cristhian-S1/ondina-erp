import { Profiler } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/context/auth-context'
import { makePerfil } from '@/test/render'
import RegistrarVenta from './RegistrarVenta'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), refetch: vi.fn() }))
const productos = [{ id: 'p1', nombre: 'Bidón POL', precio_base: 1000 }]
vi.mock('../hooks/useProductosVenta', () => ({ useProductosVenta: () => ({ data: productos }) }))
vi.mock('../hooks/useClientesRuta', () => ({ useClientesRuta: () => ({ data: [{ id: 'c1', nombre: 'Cliente' }] }) }))
vi.mock('../hooks/useCargaVendedor', () => ({ useCargaVendedor: () => ({ data: [{ producto_id: 'p1', cantidad: 100 }], refetch: mocks.refetch }) }))
vi.mock('../hooks/useRegistrarVenta', () => ({ useRegistrarVenta: () => ({ mutate: mocks.mutate, isPending: false }) }))
const key = (user: string) => `ondina:draft-registrar-venta:${user}`
const draft = { clienteId: 'c1', metodoPago: 'efectivo', descuento: 0, observaciones: 'Pedido anterior', detalles: [{ productoId: 'p1', cantidad: 7, precioUnitario: 1000 }] }
function setup(user: string) {
  const client = new QueryClient()
  const renders = vi.fn()
  const view = (id: string) => <QueryClientProvider client={client}><MemoryRouter>
    <AuthContext.Provider value={{ perfil: makePerfil({ id }), loading: false, signIn: vi.fn(), signOut: vi.fn() }}>
      <Profiler id="venta" onRender={renders}><RegistrarVenta /></Profiler>
    </AuthContext.Provider>
  </MemoryRouter></QueryClientProvider>
  const result = render(view(user))
  return { ...result, renders, switchUser: (id: string) => result.rerender(view(id)) }
}
afterEach(() => { sessionStorage.clear(); vi.clearAllMocks() })

describe('Sale draft identity and completion', () => {
  it('restores only the current user draft, including after a user switch', async () => {
    sessionStorage.setItem(key('user-1'), JSON.stringify(draft))
    const form = setup('user-1')
    expect(screen.getByDisplayValue('Pedido anterior')).toBeInTheDocument()
    form.switchUser('user-2')
    await waitFor(() => expect(screen.queryByDisplayValue('Pedido anterior')).not.toBeInTheDocument())
    expect(sessionStorage.getItem(key('user-2')) ?? '').not.toContain('Pedido anterior')
    expect(sessionStorage.getItem('ondina:draft-registrar-venta')).toBeNull()
  })
  it('persists changes under the current user key', async () => {
    setup('user-2')
    fireEvent.change(screen.getAllByRole('textbox').at(-1)!, { target: { value: 'Nuevo pedido' } })
    await waitFor(() => expect(sessionStorage.getItem(key('user-2'))).toContain('Nuevo pedido'))
    expect(sessionStorage.getItem(key('user-1'))).toBeNull()
  })
  it.each(['{broken', JSON.stringify({ ...draft, detalles: [null] }), JSON.stringify({ ...draft, metodoPago: 'invalid' }), JSON.stringify({ ...draft, detalles: [{ ...draft.detalles[0], cantidad: 'abc' }] })])('discards a malformed draft: %s', (raw) => {
    sessionStorage.setItem(key('user-1'), raw)
    setup('user-1')
    expect(screen.queryByDisplayValue('Pedido anterior')).not.toBeInTheDocument()
    expect(sessionStorage.getItem(key('user-1'))).not.toBe(raw)
  })
  it('clears a restored draft on success and uses fresh defaults on remount', async () => {
    sessionStorage.setItem(key('user-1'), JSON.stringify(draft))
    mocks.mutate.mockImplementation((_values, options) => options.onSuccess({ id: 'sale-123', error: null }))
    const form = setup('user-1')
    fireEvent.click(screen.getByRole('button', { name: /Confirmar venta/i }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByDisplayValue('Pedido anterior')).not.toBeInTheDocument())
    expect(sessionStorage.getItem(key('user-1'))).toBeNull()
    form.unmount()
    setup('user-1')
    expect(screen.queryByDisplayValue('Pedido anterior')).not.toBeInTheDocument()
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('')
  })
})


it('A1-03 · seis teclas de observaciones no renderizan el formulario y agrupan la persistencia', async () => {
  const form = setup('user-1')
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Producto 1' })).toHaveValue('p1'))
  vi.useFakeTimers()
  const guardar = vi.spyOn(Storage.prototype, 'setItem')
  form.renders.mockClear()
  try {
    const campo = screen.getByLabelText('Observaciones')
    for (const value of ['P', 'Pe', 'Ped', 'Pedi', 'Pedid', 'Pedido']) fireEvent.change(campo, { target: { value } })
    console.info('B3 renders Observaciones / escrituras inmediatas:', form.renders.mock.calls.length, guardar.mock.calls.length)
    expect(form.renders.mock.calls.length).toBe(0)
    expect(guardar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(300))
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(key('user-1'))).toContain('Pedido')
  } finally { vi.useRealTimers(); guardar.mockRestore() }
})

it('A1-03 · flush al desmontar conserva la última tecla antes del debounce', async () => {
  const form = setup('user-1')
  fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: 'Última tecla' } })
  form.unmount()
  expect(sessionStorage.getItem(key('user-1'))).toContain('Última tecla')
})
