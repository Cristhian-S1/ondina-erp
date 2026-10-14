import { afterEach, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { fechaSantiago, inicioPeriodo, useJornadaSantiago } from './useJornadaSantiago'

afterEach(() => vi.useRealTimers())

it('avanza Hoy en una pestaña abierta a medianoche y libera el reloj al desmontar', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-14T02:59:59Z'))
  const { result, unmount } = renderHook(() => useJornadaSantiago())
  expect(result.current).toBe('2026-10-13')
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current).toBe('2026-10-14')
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('calcula días de calendario de Santiago y periodos que cruzan mes/año', () => {
  expect(fechaSantiago(new Date('2026-10-14T02:00:00Z'))).toBe('2026-10-13')
  expect(inicioPeriodo('2026-01-01', 1)).toBe('2025-12-31')
  expect(inicioPeriodo('2026-03-01', 6)).toBe('2026-02-23')
  expect(inicioPeriodo('2026-09-06', 1)).toBe('2026-09-05')
})
