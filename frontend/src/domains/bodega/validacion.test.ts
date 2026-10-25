import { describe, expect, it } from 'vitest'
import { ajusteDespachoSchema, disponibleParaDevolver } from './validacion'

describe('disponibleParaDevolver', () => {
  it('descuenta lo ya devuelto para una devolución nueva', () => {
    expect(disponibleParaDevolver(10, 4, false)).toBe(6)
    expect(disponibleParaDevolver(10, 12, false)).toBe(0)
  })
  it('recupera el saldo anterior cuando la corrección reemplaza las devoluciones', () => {
    expect(disponibleParaDevolver(10, 4, true)).toBe(10)
  })
})

describe('ajusteDespachoSchema · HU-26', () => {
  const linea = (producto_id: string, cantidad: string | number) => ({ producto_id, cantidad })
  const mensajes = (lineas: ReturnType<typeof linea>[]) => {
    const r = ajusteDespachoSchema.safeParse({ lineas })
    return r.success ? [] : r.error.issues.map(i => i.message)
  }

  it('acepta enteros positivos como número o texto es-CL y entrega números', () => {
    const r = ajusteDespachoSchema.safeParse({ lineas: [linea('p-1', '1.250'), linea('p-2', 3)] })
    expect(r.success && r.data.lineas).toEqual([{ producto_id: 'p-1', cantidad: 1250 }, { producto_id: 'p-2', cantidad: 3 }])
  })

  it.each([[0], ['0'], [''], [-2], ['-2'], [1.5], [Number.NaN]])('rechaza la cantidad %j', cantidad => {
    expect(mensajes([linea('p-1', cantidad)]).length).toBeGreaterThan(0)
  })

  it('distingue decimal de cero y negativo en el mensaje', () => {
    expect(mensajes([linea('p-1', 1.5)])).toEqual(['La cantidad debe ser un número entero.'])
    expect(mensajes([linea('p-1', 0)])).toEqual(['Ingresa una cantidad mayor que cero.'])
    expect(mensajes([linea('p-1', -1)])).toEqual(['Ingresa una cantidad mayor que cero.'])
  })

  it('rechaza productos repetidos señalando la línea repetida', () => {
    const r = ajusteDespachoSchema.safeParse({ lineas: [linea('p-1', 1), linea('p-2', 1), linea('p-1', 2)] })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues).toHaveLength(1)
      expect(r.error.issues[0]).toMatchObject({ path: ['lineas', 2, 'producto_id'], message: 'No repitas productos en el ajuste.' })
    }
  })

  it('exige producto y al menos una línea', () => {
    expect(mensajes([linea('', 1)])).toEqual(['Selecciona un producto.'])
    expect(mensajes([])).toEqual(['Agrega al menos un producto al despacho.'])
  })
})
