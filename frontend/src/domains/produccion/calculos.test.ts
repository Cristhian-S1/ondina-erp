import { describe, expect, it } from 'vitest'
import { calcularResumenIndicadores } from './calculos'
import type { IndicadorProduccionDiario } from './types'

describe('calcularResumenIndicadores', () => {
  it('calcula los totales de unidades y registros', () => {
    const filas: IndicadorProduccionDiario[] = [
      {
        sucursal_id: 'sucursal-1',
        fecha: '2026-08-12',
        producto_id: 'agua-20l',
        cantidad: 100,
        registros: 2,
      },
      {
        sucursal_id: 'sucursal-1',
        fecha: '2026-08-12',
        producto_id: 'hielo-1kg',
        cantidad: 50,
        registros: 1,
      },
    ]

    const resultado = calcularResumenIndicadores(filas)

    expect(resultado.totalUnidades).toBe(150)
    expect(resultado.totalRegistros).toBe(3)
  })

  it('agrupa registros del mismo producto', () => {
    const filas: IndicadorProduccionDiario[] = [
      {
        sucursal_id: 'sucursal-1',
        fecha: '2026-08-12',
        producto_id: 'agua-20l',
        cantidad: 40,
        registros: 1,
      },
      {
        sucursal_id: 'sucursal-1',
        fecha: '2026-08-12',
        producto_id: 'agua-20l',
        cantidad: 60,
        registros: 2,
      },
    ]

    const resultado = calcularResumenIndicadores(filas)

    expect(resultado.porProducto).toEqual([
      {
        productoId: 'agua-20l',
        cantidad: 100,
        registros: 3,
      },
    ])
  })

  it('ordena los productos de mayor a menor cantidad producida', () => {
    const filas: IndicadorProduccionDiario[] = [
      {
        sucursal_id: 'sucursal-1',
        fecha: '2026-08-12',
        producto_id: 'hielo-1kg',
        cantidad: 30,
        registros: 1,
      },
      {
        sucursal_id: 'sucursal-1',
        fecha: '2026-08-12',
        producto_id: 'agua-20l',
        cantidad: 100,
        registros: 2,
      },
    ]

    const resultado = calcularResumenIndicadores(filas)

    expect(resultado.porProducto[0].productoId).toBe('agua-20l')
    expect(resultado.porProducto[1].productoId).toBe('hielo-1kg')
  })

  it('devuelve valores vacíos cuando no hay registros', () => {
    const resultado = calcularResumenIndicadores([])

    expect(resultado.totalUnidades).toBe(0)
    expect(resultado.totalRegistros).toBe(0)
    expect(resultado.porProducto).toEqual([])
  })
})