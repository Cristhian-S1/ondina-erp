import { describe, expect, it } from 'vitest'
import { displayMilesInput, formatCantidad, formatMiles, formatMilesInput, parseMiles } from './format'

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
