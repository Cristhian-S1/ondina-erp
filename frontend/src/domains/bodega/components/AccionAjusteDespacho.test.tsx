import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import * as api from '../api'
import AccionAjusteDespacho from './AccionAjusteDespacho'

// Unit tests never reach Supabase; without this, importing the real client throws when VITE_* env vars are absent (CI).
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('../api')

const creadoEn = '2026-10-13T12:00:00.000Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-13T12:10:00.000Z'))
  vi.mocked(api.obtenerVentanaAjuste).mockResolvedValue(null)
})
afterEach(() => vi.useRealTimers())

// react-query resuelve la RPC en microtareas: se vacían sin avanzar el reloj falso.
const respuestaRpc = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })

it('HU-26 · muestra la acción y el tiempo restante dentro de la ventana, y la oculta al vencer', async () => {
  const onAgregar = vi.fn()
  renderWithProviders(<AccionAjusteDespacho creadoEn={creadoEn} onAgregar={onAgregar} />)
  await respuestaRpc()
  fireEvent.click(screen.getByRole('button', { name: 'Agregar productos' }))
  expect(onAgregar).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/Quedan 5 min 00 s para agregar productos \(aprox\.\)/)).toBeInTheDocument()

  act(() => { vi.advanceTimersByTime(60_000) })
  expect(screen.getByText(/Quedan 4 min 00 s/)).toBeInTheDocument()

  act(() => { vi.advanceTimersByTime(4 * 60_000) })
  expect(screen.queryByRole('button', { name: 'Agregar productos' })).not.toBeInTheDocument()
  expect(screen.getByText('La ventana de ajuste de este despacho está cerrada.')).toBeInTheDocument()
})

it('HU-26 · un despacho ya vencido no ofrece la acción', async () => {
  vi.setSystemTime(new Date('2026-10-13T12:30:00.000Z'))
  renderWithProviders(<AccionAjusteDespacho creadoEn={creadoEn} onAgregar={vi.fn()} />)
  await respuestaRpc()
  expect(screen.queryByRole('button', { name: 'Agregar productos' })).not.toBeInTheDocument()
})

it('HU-26 · la expiración de la RPC reemplaza la estimación por defecto', async () => {
  renderWithProviders(<AccionAjusteDespacho creadoEn={creadoEn} expiraEn="2026-10-13T12:20:00.000Z" onAgregar={vi.fn()} />)
  await respuestaRpc()
  expect(screen.getByText('Quedan 10 min 00 s para agregar productos.')).toBeInTheDocument()
})

it('HU-26 · un dispositivo 3 min atrasado respecto al servidor oculta la acción al vencer según el reloj del servidor', async () => {
  // Servidor 12:13, dispositivo 12:10: la ventana de 15 min cierra a las 12:15 del servidor (en 2 min reales).
  vi.mocked(api.obtenerVentanaAjuste).mockResolvedValue({ minutos: 15, servidorAhora: '2026-10-13T12:13:00.000Z' })
  renderWithProviders(<AccionAjusteDespacho creadoEn={creadoEn} onAgregar={vi.fn()} />)
  await respuestaRpc()
  expect(screen.getByText('Quedan 2 min 00 s para agregar productos (ventana de 15 min).')).toBeInTheDocument()

  act(() => { vi.advanceTimersByTime(2 * 60_000 - 1_000) })
  expect(screen.getByRole('button', { name: 'Agregar productos' })).toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(1_000) })
  // Con el reloj del dispositivo la acción seguiría visible 3 min más.
  expect(screen.queryByRole('button', { name: 'Agregar productos' })).not.toBeInTheDocument()
  expect(screen.getByText('La ventana de ajuste de este despacho está cerrada.')).toBeInTheDocument()
})

it('HU-26 · usa los minutos configurados por la RPC y no el valor por defecto', async () => {
  vi.mocked(api.obtenerVentanaAjuste).mockResolvedValue({ minutos: 20, servidorAhora: '2026-10-13T12:10:00.000Z' })
  renderWithProviders(<AccionAjusteDespacho creadoEn={creadoEn} onAgregar={vi.fn()} />)
  await respuestaRpc()
  expect(screen.getByText('Quedan 10 min 00 s para agregar productos (ventana de 20 min).')).toBeInTheDocument()
  expect(screen.queryByText(/aprox/)).not.toBeInTheDocument()
})

it('HU-26 · si la RPC falla, usa 15 min aproximados y la acción sigue disponible', async () => {
  vi.mocked(api.obtenerVentanaAjuste).mockRejectedValue(new Error('PGRST202 function not found'))
  renderWithProviders(<AccionAjusteDespacho creadoEn={creadoEn} onAgregar={vi.fn()} />)
  await respuestaRpc()
  expect(screen.getByRole('button', { name: 'Agregar productos' })).toBeInTheDocument()
  expect(screen.getByText(/Quedan 5 min 00 s para agregar productos \(aprox\.\)/)).toBeInTheDocument()
})
