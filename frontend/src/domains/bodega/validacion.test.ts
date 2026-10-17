import { describe, expect, it } from 'vitest'
import { disponibleParaDevolver } from './validacion'

describe('disponibleParaDevolver', () => {
  it('descuenta lo ya devuelto para una devolución nueva', () => {
    expect(disponibleParaDevolver(10, 4, false)).toBe(6)
    expect(disponibleParaDevolver(10, 12, false)).toBe(0)
  })
  it('recupera el saldo anterior cuando la corrección reemplaza las devoluciones', () => {
    expect(disponibleParaDevolver(10, 4, true)).toBe(10)
  })
})
