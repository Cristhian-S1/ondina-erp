import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import * as api from '../api'
import * as catalog from '@/lib/catalog'
import { useDatosBodega } from './useDatosBodega'
// Unit tests never reach Supabase; without this, importing the real client throws when VITE_* env vars are absent (CI).
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('../api')
vi.mock('@/lib/catalog')

function Vista() {
  const q = useDatosBodega('suc-1', true)
  return <>
    <p data-testid="estado">{q.isError ? `error:${q.error.message}` : q.isSuccess ? 'ok' : 'cargando'}</p>
    <p data-testid="activos">{q.data?.vendedores.map(v => v.nombres).join('|')}</p>
    <p data-testid="historial">{q.data?.vendedoresHistorial.map(v => `${v.nombres}:${v.activo}`).join('|')}</p>
  </>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerVendedores).mockResolvedValue([{ id: 'v1', nombres: 'Ana', apellidos: 'López' }])
  vi.mocked(api.obtenerVendedoresHistorial).mockResolvedValue([
    { id: 'v1', nombres: 'Ana', apellidos: 'López', activo: true }, { id: 'v2', nombres: 'Bruno', apellidos: 'Soto', activo: false }])
  vi.mocked(catalog.obtenerProductos).mockResolvedValue([])
  vi.mocked(catalog.obtenerTiposEmpaque).mockResolvedValue([])
  vi.mocked(api.obtenerStockBodega).mockResolvedValue([])
  vi.mocked(api.obtenerStockEnvases).mockResolvedValue([])
  vi.mocked(api.obtenerCargaVendedores).mockResolvedValue([])
})

describe('useDatosBodega', () => {
  it('expone la plantilla histórica junto a los vendedores activos', async () => {
    renderWithProviders(<Vista />)
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('ok'))
    expect(screen.getByTestId('activos')).toHaveTextContent('Ana')
    expect(screen.getByTestId('activos')).not.toHaveTextContent('Bruno')
    expect(screen.getByTestId('historial')).toHaveTextContent('Ana:true|Bruno:false')
  })

  it('R1-14 · carga igual si vendedores_historial_sucursal no está disponible y nombra con los activos', async () => {
    vi.mocked(api.obtenerVendedoresHistorial).mockRejectedValue(new Error('PGRST202 function not found'))
    renderWithProviders(<Vista />)
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('ok'))
    expect(screen.getByTestId('historial')).toHaveTextContent('Ana:true')
    expect(screen.getByTestId('historial')).not.toHaveTextContent('Bruno')
  })

  it.each([
    ['vendedores activos', () => vi.mocked(api.obtenerVendedores)],
    ['stock de envases', () => vi.mocked(api.obtenerStockEnvases)],
    ['carga de vendedores', () => vi.mocked(api.obtenerCargaVendedores)],
  ])('sigue mostrando el error cuando falla una petición crítica (%s)', async (_nombre, mockCritico) => {
    mockCritico().mockRejectedValue(new Error('fallo crítico'))
    renderWithProviders(<Vista />)
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('error:fallo crítico'))
  })
})
