import { describe, expect, it } from 'vitest'
import { displayMilesInput, formatCantidad, formatMiles, formatMilesInput, fmtFecha, fmtFechaHora, parseMiles } from './format'

describe('TEST-02 · formato es-CL (lib/format)', () => {
  describe('formatMiles', () => {
    it('usa punto para miles y sin decimales', () => {
      expect(formatMiles(0)).toBe('0')
      expect(formatMiles(999)).toBe('999')
      expect(formatMiles(1000)).toBe('1.000')
      expect(formatMiles(1234567)).toBe('1.234.567')
      expect(formatMiles(1500.7)).toBe('1.501')
    })

    it('devuelve guion para nulo, indefinido o NaN', () => {
      expect(formatMiles(null)).toBe('—')
      expect(formatMiles(undefined)).toBe('—')
      expect(formatMiles(Number.NaN)).toBe('—')
    })
  })

  describe('formatCantidad', () => {
    it('mantiene la misma regla de miles', () => {
      expect(formatCantidad(0)).toBe('0')
      expect(formatCantidad(2500)).toBe('2.500')
      expect(formatCantidad(null)).toBe('—')
      expect(formatCantidad(undefined)).toBe('—')
      expect(formatCantidad(Number.NaN)).toBe('—')
    })
  })

  describe('parseMiles', () => {
    it('convierte texto con puntos a número', () => {
      expect(parseMiles('0')).toBe(0)
      expect(parseMiles('1.000')).toBe(1000)
      expect(parseMiles('1.234.567')).toBe(1234567)
    })

    it('devuelve 0 para entradas vacías o sin dígitos', () => {
      expect(parseMiles('')).toBe(0)
      expect(parseMiles('   ')).toBe(0)
      expect(parseMiles('abc')).toBe(0)
      expect(parseMiles('...')).toBe(0)
      expect(parseMiles('-')).toBe(0)
    })

    it('ignora caracteres no numéricos y conserva el signo', () => {
      expect(parseMiles('$ 12.500')).toBe(12500)
      expect(parseMiles('-5')).toBe(-5)
    })
  })

  describe('formatMilesInput', () => {
    it('formatea mientras se escribe', () => {
      expect(formatMilesInput('1000')).toBe('1.000')
      expect(formatMilesInput('1a0b0c0')).toBe('1.000')
      expect(formatMilesInput('12.345')).toBe('12.345')
      expect(formatMilesInput('1000000')).toBe('1.000.000')
    })

    it('normaliza ceros a la izquierda', () => {
      expect(formatMilesInput('0')).toBe('0')
      expect(formatMilesInput('000')).toBe('0')
      expect(formatMilesInput('007')).toBe('7')
    })

    it('devuelve cadena vacía para entradas vacías o sin dígitos', () => {
      expect(formatMilesInput('')).toBe('')
      expect(formatMilesInput('abc')).toBe('')
      expect(formatMilesInput('...')).toBe('')
    })
  })

  describe('displayMilesInput', () => {
    it('oculta el cero y mantiene el formato de miles', () => {
      expect(displayMilesInput(undefined)).toBe('')
      expect(displayMilesInput(null)).toBe('')
      expect(displayMilesInput('')).toBe('')
      expect(displayMilesInput(0)).toBe('')
      expect(displayMilesInput(2500)).toBe('2.500')
      expect(displayMilesInput('1.000')).toBe('1.000')
    })
  })
})

describe('fechas es-CL · America/Santiago', () => {
  it('fmtFecha entrega dd-mm-aaaa en la zona de Santiago', () => {
    // 2026-01-15 02:30Z = 14-01 23:30 en Santiago (UTC-3 en verano)
    expect(fmtFecha('2026-01-15T02:30:00Z')).toBe('14-01-2026')
    // 2026-07-15 12:00Z = 08:00 en Santiago (UTC-4 en invierno)
    expect(fmtFecha('2026-07-15T12:00:00Z')).toBe('15-07-2026')
  })

  it('fmtFechaHora agrega hh:mm sin segundos', () => {
    expect(fmtFechaHora('2026-01-15T02:30:45Z')).toBe('14-01-2026 23:30')
    expect(fmtFechaHora('2026-07-15T12:05:00Z')).toBe('15-07-2026 08:05')
  })

  it('R3-03: una fecha civil AAAA-MM-DD no se desplaza por la zona horaria', () => {
    expect(fmtFecha('2026-01-15')).toBe('15-01-2026')
    expect(fmtFecha('2026-07-15')).toBe('15-07-2026')
    expect(fmtFecha('2024-02-29')).toBe('29-02-2024')
    expect(fmtFecha('2026-01-01')).toBe('01-01-2026')
    expect(fmtFecha('2026-02-30')).toBe('—')
  })

  it('R3-03: fmtFechaHora con fecha civil no inventa hora ni cambia el día', () => {
    expect(fmtFechaHora('2026-01-15')).toBe('15-01-2026')
    expect(fmtFechaHora('2026-07-15')).toBe('15-07-2026')
  })

  it('devuelve — con valores vacíos o inválidos', () => {
    expect(fmtFecha(null)).toBe('—')
    expect(fmtFecha(undefined)).toBe('—')
    expect(fmtFecha('no es fecha')).toBe('—')
    expect(fmtFechaHora('')).toBe('—')
  })
})
