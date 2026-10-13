import { QueryClient } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { makePerfil, renderWithProviders } from '@/test/render'
import type { CrearClienteInput } from '../schemas'
import { crearCliente, obtenerVendedoresSucursal } from '../api'
import { useCrearCliente } from './useCrearCliente'

vi.mock('../api', () => ({ crearCliente: vi.fn(), obtenerVendedoresSucursal: vi.fn() }))
const input: CrearClienteInput = { nombre: 'Almacén', direccion: 'Calle 1', tipo: 'minorista', vendedor_id: 'v2' }
let invalidate: ReturnType<typeof vi.spyOn>
function Form({ sucursalId }: { sucursalId?: string }) {
  const mutation = useCrearCliente(sucursalId)
  return <>
    <button onClick={() => mutation.mutate(input)}>Crear</button>
    {mutation.error && <p role="alert">{mutation.error.message}</p>}
    {mutation.isSuccess && <p role="status">Registrado</p>}
  </>
}
beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
  vi.mocked(crearCliente).mockResolvedValue({ error: null })
  vi.mocked(obtenerVendedoresSucursal).mockResolvedValue([{ id: 'v2', nombres: 'Ana', apellidos: 'López' }])
})

it('rejects a missing admin branch without falling back to the profile branch', async () => {
  renderWithProviders(<Form />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: 's1' }) })
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Selecciona una sucursal')
  expect(crearCliente).not.toHaveBeenCalled()
})
it('rejects a seller outside the selected branch before writing', async () => {
  vi.mocked(obtenerVendedoresSucursal).mockResolvedValue([{ id: 'v1', nombres: 'Ana', apellidos: 'López' }])
  renderWithProviders(<Form sucursalId="s2" />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Selecciona un vendedor activo de la sucursal elegida')
  expect(obtenerVendedoresSucursal).toHaveBeenCalledWith('s2')
  expect(crearCliente).not.toHaveBeenCalled()
})
it('creates and invalidates the exact admin portfolio scope', async () => {
  const perfil = makePerfil({ rol: 'administrador', sucursal_id: null })
  renderWithProviders(<Form sucursalId="s2" />, { perfil })
  fireEvent.click(screen.getByRole('button'))
  await screen.findByRole('status')
  expect(crearCliente).toHaveBeenCalledWith(expect.objectContaining({ vendedor_id: 'v2', sucursal_id: 's2' }))
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ventas', 'clientes', perfil.id, 's2', 'v2'] }))
})
it('forces a vendedor creation to their own identity and branch', async () => {
  const perfil = makePerfil({ id: 'self', sucursal_id: 'own' })
  renderWithProviders(<Form sucursalId="foreign" />, { perfil })
  fireEvent.click(screen.getByRole('button'))
  await screen.findByRole('status')
  expect(crearCliente).toHaveBeenCalledWith(expect.objectContaining({ vendedor_id: 'self', sucursal_id: 'own' }))
  expect(obtenerVendedoresSucursal).not.toHaveBeenCalled()
})
