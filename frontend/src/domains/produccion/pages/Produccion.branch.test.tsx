import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { makePerfil, renderWithProviders } from '@/test/render'
import Produccion from './Produccion'
import * as api from '../api'

const location = vi.hoisted(() => ({ pathname: '/produccion/registrar' }))
vi.mock('react-router-dom', async (original) => ({ ...await original<typeof import('react-router-dom')>(), useLocation: () => location }))
vi.mock('@/lib/catalog', () => ({
  obtenerProductos: vi.fn().mockResolvedValue([{ id: 'p1', nombre: 'Agua', activo: true }]),
  obtenerTiposEmpaque: vi.fn().mockResolvedValue([]),
  obtenerSucursales: vi.fn().mockResolvedValue([{ id: 's1', nombre: 'Norte' }, { id: 's2', nombre: 'Sur' }]),
}))
vi.mock('../api', () => ({
  obtenerEnvasesDisponibles: vi.fn().mockResolvedValue([]), obtenerMermas: vi.fn().mockResolvedValue([]),
  obtenerProducciones: vi.fn().mockResolvedValue([]), registrarMerma: vi.fn().mockResolvedValue(null), registrarProduccion: vi.fn().mockResolvedValue(null),
  subscribeProduccion: vi.fn(() => vi.fn()),
}))

beforeEach(() => { vi.clearAllMocks(); location.pathname = '/produccion/registrar'; vi.mocked(api.obtenerProducciones).mockResolvedValue([]) })

async function selectBranch(id = 's1') {
  await screen.findByRole('option', { name: 'Norte' })
  fireEvent.change(screen.getByRole('combobox', { name: 'Sucursal' }), { target: { value: id } })
}

describe('Producción operational branch', () => {
  it.each([null, 's1'])('requires an explicit administrator selection with profile branch %s', async (sucursal_id) => {
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id }) })
    expect(await screen.findByRole('combobox', { name: 'Sucursal' })).toHaveValue('')
    expect(screen.getByText(/selecciona una sucursal para trabajar/i)).toBeInTheDocument()
    expect(screen.queryByText('Cargando información...')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar producción' })).not.toBeInTheDocument()
    expect(api.obtenerProducciones).not.toHaveBeenCalled()
    expect(api.subscribeProduccion).not.toHaveBeenCalled()
  })

  it('loads the selected branch and ignores a late previous-branch response', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.obtenerProducciones>>) => void
    vi.mocked(api.obtenerProducciones).mockImplementation((id) => id === 's1' ? new Promise(r => { resolve = r }) : Promise.resolve([]))
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
    await selectBranch()
    expect(api.obtenerProducciones).toHaveBeenCalledWith('s1')
    await selectBranch('s2')
    expect(await screen.findByText('No hay producciones registradas.')).toBeInTheDocument()
    await act(async () => { resolve([{ id: 'old', sucursal_id: 's1', producto_id: 'p1', cantidad: 777, creado_en: '2026-01-01', anulado: false, creado_por: 'u', observaciones: null }]) })
    expect(screen.queryByText('777')).not.toBeInTheDocument()
    expect(api.obtenerProducciones).toHaveBeenCalledWith('s2')
  })

  it('writes to the chosen branch and resets the form when switching', async () => {
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
    await selectBranch()
    fireEvent.change(await screen.findByLabelText('Producto'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar producción' }))
    await screen.findByRole('status')
    expect(api.registrarProduccion).toHaveBeenCalledWith(expect.objectContaining({ sucursal_id: 's1', cantidad: 12 }))
    await selectBranch('s2')
    expect(await screen.findByLabelText('Cantidad')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not refresh the previous scope when a submitted write finishes after switching', async () => {
    let resolve!: (value: string | null) => void
    vi.mocked(api.registrarProduccion).mockReturnValueOnce(new Promise(r => { resolve = r }))
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
    await selectBranch()
    fireEvent.change(await screen.findByLabelText('Producto'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar producción' }))
    await waitFor(() => expect(api.registrarProduccion).toHaveBeenCalledOnce())
    await selectBranch('s2')
    await screen.findByText('Nueva producción')
    await act(async () => { resolve(null) })
    expect(vi.mocked(api.obtenerProducciones).mock.calls.filter(([id]) => id === 's1')).toHaveLength(1)
    expect(screen.queryByText(/Producción registrada/)).not.toBeInTheDocument()
  })

  it('writes mermas to the chosen branch', async () => {
    location.pathname = '/produccion/incidencias'
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
    await selectBranch('s2')
    fireEvent.change(await screen.findByLabelText('Producto'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Envases dañados' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar merma' }))
    await waitFor(() => expect(api.registrarMerma).toHaveBeenCalledWith(expect.objectContaining({ sucursal_id: 's2', cantidad: 2 })))
  })

  it('keeps non-admins in their assigned branch without a selector', async () => {
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'produccion', sucursal_id: 's1' }) })
    await screen.findByText('Nueva producción')
    expect(screen.queryByRole('combobox', { name: 'Sucursal' })).not.toBeInTheDocument()
    expect(api.obtenerProducciones).toHaveBeenCalledWith('s1')
  })
})
