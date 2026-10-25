import { describe, expect, it } from 'vitest'
import { anulacionMermaSchema, mermaSchema, rangoCuadreSchema } from './validacion'

const base = { origen: 'bodega', despacho_id: '', producto_id: 'p-1', tipo_empaque_id: '', cantidad: 3, motivo: ' Se rompió ' }

function mensajes(entrada: unknown) {
  const r = mermaSchema.safeParse(entrada)
  return r.success ? [] : r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
}

describe('HU-29 · mermaSchema', () => {
  it('normaliza ids vacíos a null y recorta el motivo', () => {
    expect(mermaSchema.parse(base)).toEqual({
      origen: 'bodega', despacho_id: null, producto_id: 'p-1', tipo_empaque_id: null, cantidad: 3, motivo: 'Se rompió',
    })
  })

  it('acepta cantidades en texto es-CL', () => {
    expect(mermaSchema.parse({ ...base, cantidad: '1.200' }).cantidad).toBe(1200)
  })

  it.each([
    ['cero', 0], ['negativa', -2], ['fraccionaria', 1.5], ['vacía', ''], ['texto', 'abc'],
  ])('rechaza una cantidad %s', (_n, cantidad) => {
    expect(mensajes({ ...base, cantidad }).some(m => m.startsWith('cantidad'))).toBe(true)
  })

  it('rechaza una cantidad que no cabe en integer', () => {
    expect(mensajes({ ...base, cantidad: 2_147_483_648 })).toContain('cantidad: La cantidad es demasiado grande.')
    expect(mermaSchema.safeParse({ ...base, cantidad: 2_147_483_647 }).success).toBe(true)
  })

  it('exige un motivo no vacío', () => {
    expect(mensajes({ ...base, motivo: '   ' })).toEqual(['motivo: Indica el motivo de la merma.'])
    expect(mensajes({ ...base, motivo: '' })).toEqual(['motivo: Indica el motivo de la merma.'])
  })

  it('exige un origen válido', () => {
    expect(mensajes({ ...base, origen: 'planta' })).toEqual(['origen: Selecciona el origen de la merma.'])
  })

  describe('bodega: producto XOR envase', () => {
    it('acepta solo un envase', () => {
      expect(mermaSchema.parse({ ...base, producto_id: '', tipo_empaque_id: 'e-1' })).toMatchObject({ producto_id: null, tipo_empaque_id: 'e-1' })
    })
    it('rechaza ninguno', () => {
      expect(mensajes({ ...base, producto_id: '' })).toEqual(['producto_id: Selecciona un producto o un tipo de envase.'])
    })
    it('rechaza ambos', () => {
      expect(mensajes({ ...base, tipo_empaque_id: 'e-1' })).toEqual(['tipo_empaque_id: Indica solo un producto o un tipo de envase.'])
    })
    it('rechaza un despacho', () => {
      expect(mensajes({ ...base, despacho_id: 'd-1' })).toEqual(['despacho_id: La merma de bodega no lleva despacho.'])
    })
  })

  describe('despacho: solo producto', () => {
    const despacho = { ...base, origen: 'despacho', despacho_id: 'd-1' }
    it('acepta despacho y producto', () => {
      expect(mermaSchema.parse(despacho)).toMatchObject({ origen: 'despacho', despacho_id: 'd-1', producto_id: 'p-1', tipo_empaque_id: null })
    })
    it('exige el despacho', () => {
      expect(mensajes({ ...despacho, despacho_id: '' })).toEqual(['despacho_id: Selecciona un despacho del día.'])
    })
    it('exige el producto', () => {
      expect(mensajes({ ...despacho, producto_id: '' })).toEqual(['producto_id: Selecciona un producto del despacho.'])
    })
    it('rechaza un envase y remite a la devolución en estado malo', () => {
      const esperado = 'tipo_empaque_id: Registra los envases dañados del despacho como devolución en estado malo.'
      expect(mensajes({ ...despacho, producto_id: '', tipo_empaque_id: 'e-1' })).toEqual([esperado])
      expect(mensajes({ ...despacho, tipo_empaque_id: 'e-1' })).toEqual([esperado])
    })
  })
})

describe('HU-29 · anulacionMermaSchema', () => {
  it('exige un motivo propio y lo recorta', () => {
    expect(anulacionMermaSchema.parse({ motivo: '  Error de conteo ' })).toEqual({ motivo: 'Error de conteo' })
    expect(anulacionMermaSchema.safeParse({ motivo: '  ' }).success).toBe(false)
  })
})

describe('HU-29 · rangoCuadreSchema', () => {
  const hoy = '2026-10-25'
  const validar = (desde: string, hasta: string) => {
    const r = rangoCuadreSchema(hoy).safeParse({ desde, hasta })
    return r.success ? [] : r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
  }

  it('acepta un día, hoy incluido, y 31 días', () => {
    expect(validar(hoy, hoy)).toEqual([])
    expect(validar('2026-09-25', hoy)).toEqual([])
  })
  it('rechaza más de 31 días', () => {
    expect(validar('2026-09-24', hoy)).toEqual(['hasta: El rango no puede superar 31 días.'])
  })
  it('rechaza fechas futuras', () => {
    expect(validar(hoy, '2026-10-26')).toEqual(['hasta: No se pueden consultar fechas futuras.'])
  })
  it('rechaza hasta anterior a desde', () => {
    expect(validar('2026-10-25', '2026-10-24')).toEqual(['hasta: La fecha final no puede ser anterior a la inicial.'])
  })
  it.each(['', '25-10-2026', '2026-02-30', '2026-13-01'])('rechaza la fecha inválida «%s»', (valor) => {
    expect(validar(valor, hoy)).toContain('desde: Indica una fecha válida.')
  })
  it('cuenta los días del rango a través del cambio de hora', () => {
    expect(rangoCuadreSchema('2026-12-31').safeParse({ desde: '2026-09-01', hasta: '2026-10-01' }).success).toBe(true)
    expect(rangoCuadreSchema('2026-12-31').safeParse({ desde: '2026-09-01', hasta: '2026-10-02' }).success).toBe(false)
  })
})
