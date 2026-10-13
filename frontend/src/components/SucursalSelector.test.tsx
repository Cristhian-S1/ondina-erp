import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { obtenerSucursales } from '@/lib/catalog'
import SucursalSelector from './SucursalSelector'

vi.mock('@/lib/catalog', () => ({ obtenerSucursales: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('does not silently select a branch and reports the chosen value', async () => {
  vi.mocked(obtenerSucursales).mockResolvedValue([{ id: 's1', nombre: 'Norte', activa: true, direccion: 'Calle 1', comuna: null, region: null, telefono: null, creado_en: '2026-01-01' }])
  const onChange = vi.fn()
  renderWithProviders(<SucursalSelector value="" onChange={onChange} />)
  await screen.findByRole('option', { name: 'Norte' })
  expect(screen.getByRole('combobox', { name: 'Sucursal' })).toHaveValue('')
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 's1' } })
  expect(onChange).toHaveBeenCalledWith('s1')
})
it('distinguishes catalogue failure from empty branches and can retry', async () => {
  vi.mocked(obtenerSucursales).mockRejectedValue(new Error('Network'))
  renderWithProviders(<SucursalSelector value="" onChange={() => {}} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar las sucursales')
  expect(screen.queryByText('No hay sucursales activas.')).not.toBeInTheDocument()
  vi.mocked(obtenerSucursales).mockResolvedValue([])
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar sucursales' }))
  expect(await screen.findByText('No hay sucursales activas.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
