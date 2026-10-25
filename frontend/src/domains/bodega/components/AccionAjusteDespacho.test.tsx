import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import AccionAjusteDespacho from './AccionAjusteDespacho'

const creadoEn = '2026-10-13T12:00:00.000Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-13T12:10:00.000Z'))
})
afterEach(() => vi.useRealTimers())

it('HU-26 · muestra la acción y el tiempo restante dentro de la ventana, y la oculta al vencer', () => {
  const onAgregar = vi.fn()
  render(<AccionAjusteDespacho creadoEn={creadoEn} onAgregar={onAgregar} />)
  fireEvent.click(screen.getByRole('button', { name: 'Agregar productos' }))
  expect(onAgregar).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/Quedan 5 min 00 s para agregar productos \(aprox\.\)/)).toBeInTheDocument()

  act(() => { vi.advanceTimersByTime(60_000) })
  expect(screen.getByText(/Quedan 4 min 00 s/)).toBeInTheDocument()

  act(() => { vi.advanceTimersByTime(4 * 60_000) })
  expect(screen.queryByRole('button', { name: 'Agregar productos' })).not.toBeInTheDocument()
  expect(screen.getByText('La ventana de ajuste de este despacho está cerrada.')).toBeInTheDocument()
})

it('HU-26 · un despacho ya vencido no ofrece la acción', () => {
  vi.setSystemTime(new Date('2026-10-13T12:30:00.000Z'))
  render(<AccionAjusteDespacho creadoEn={creadoEn} onAgregar={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Agregar productos' })).not.toBeInTheDocument()
})

it('HU-26 · la expiración de la RPC reemplaza la estimación por defecto', () => {
  render(<AccionAjusteDespacho creadoEn={creadoEn} expiraEn="2026-10-13T12:20:00.000Z" onAgregar={vi.fn()} />)
  expect(screen.getByText('Quedan 10 min 00 s para agregar productos.')).toBeInTheDocument()
})
