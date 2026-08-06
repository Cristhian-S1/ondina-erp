import { describe, expect, it } from 'vitest'
import { crearClienteSchema, crearGastoSchema, registrarVentaSchema } from './schemas'

describe('HU-02 · crearClienteSchema', () => {
  it('rechaza cuando falta el nombre', () => {
    const res = crearClienteSchema.safeParse({
      direccion: 'Calle 1',
      vendedor_id: 'user-1',
    })
    expect(res.success).toBe(false)
  })

  it('asume tipo minorista por defecto cuando todo es válido', () => {
    const res = crearClienteSchema.safeParse({
      nombre: 'Doña María',
      direccion: 'Calle 1',
      vendedor_id: 'user-1',
    })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.tipo).toBe('minorista')
  })
})

describe('HU-07 · crearGastoSchema', () => {
  it('rechaza monto menor o igual a 0', () => {
    const res = crearGastoSchema.safeParse({ tipo: 'otra', monto: 0, motivo: 'Algo' })
    expect(res.success).toBe(false)
  })

  it('acepta un gasto válido', () => {
    const res = crearGastoSchema.safeParse({ tipo: 'combustible', monto: 5000, motivo: 'Bencina' })
    expect(res.success).toBe(true)
  })
})

describe('HU-01 · registrarVentaSchema', () => {
  it('exige cliente, al menos un detalle y método', () => {
    const res = registrarVentaSchema.safeParse({
      clienteId: '',
      metodoPago: 'efectivo',
      descuento: 0,
      detalles: [],
    })
    expect(res.success).toBe(false)
  })

  it('acepta una venta válida con un detalle', () => {
    const res = registrarVentaSchema.safeParse({
      clienteId: 'cli-1',
      metodoPago: 'transferencia',
      descuento: 500,
      observaciones: '',
      detalles: [
        { productoId: 'p-1', cantidad: 2, precioUnitario: 1000, envasesRecibidos: 1 },
      ],
    })
    expect(res.success).toBe(true)
  })
})