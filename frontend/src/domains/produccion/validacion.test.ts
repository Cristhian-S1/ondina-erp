import { describe, expect, it } from 'vitest'
import { validarMerma, validarProduccion } from './validacion'
import type { NuevaMermaProduccion, NuevaProduccion } from './types'

describe('validarProduccion', () => {
  it('acepta una producción válida', () => {
    const datos: NuevaProduccion = {
      sucursal_id: 'sucursal-1',
      producto_id: 'producto-1',
      cantidad: 10,
      observaciones: null,
      creado_por: 'usuario-1',
    }

    expect(validarProduccion(datos)).toBeNull()
  })

  it('rechaza una producción sin producto seleccionado', () => {
    const datos: NuevaProduccion = {
      sucursal_id: 'sucursal-1',
      producto_id: '',
      cantidad: 10,
      observaciones: null,
      creado_por: 'usuario-1',
    }

    expect(validarProduccion(datos)).toBe('Selecciona un producto.')
  })

  it('rechaza una cantidad igual a cero', () => {
    const datos: NuevaProduccion = {
      sucursal_id: 'sucursal-1',
      producto_id: 'producto-1',
      cantidad: 0,
      observaciones: null,
      creado_por: 'usuario-1',
    }

    expect(validarProduccion(datos)).toBe(
      'La cantidad debe ser un número entero mayor que cero.',
    )
  })

  it('rechaza una cantidad negativa', () => {
    const datos: NuevaProduccion = {
      sucursal_id: 'sucursal-1',
      producto_id: 'producto-1',
      cantidad: -5,
      observaciones: null,
      creado_por: 'usuario-1',
    }

    expect(validarProduccion(datos)).toBe(
      'La cantidad debe ser un número entero mayor que cero.',
    )
  })

  it('rechaza una cantidad con decimales', () => {
    const datos: NuevaProduccion = {
      sucursal_id: 'sucursal-1',
      producto_id: 'producto-1',
      cantidad: 2.5,
      observaciones: null,
      creado_por: 'usuario-1',
    }

    expect(validarProduccion(datos)).toBe(
      'La cantidad debe ser un número entero mayor que cero.',
    )
  })
})

describe('validarMerma', () => {
  const base: NuevaMermaProduccion = {
    sucursal_id: 'sucursal-1',
    producto_id: 'producto-1',
    tipo_empaque_id: null,
    despacho_id: null,
    cantidad: 1,
    motivo: 'Bidón dañado durante producción.',
    creado_por: 'usuario-1',
  }

  it('acepta una merma válida', () => {
    expect(validarMerma(base)).toBeNull()
  })

  it('rechaza una merma sin producto', () => {
    expect(
      validarMerma({
        ...base,
        producto_id: '',
      }),
    ).toBe('Selecciona un producto.')
  })

  it('rechaza una cantidad igual a cero', () => {
    expect(
      validarMerma({
        ...base,
        cantidad: 0,
      }),
    ).toBe('La cantidad debe ser un número entero mayor que cero.')
  })

  it('rechaza una cantidad negativa', () => {
    expect(
      validarMerma({
        ...base,
        cantidad: -1,
      }),
    ).toBe('La cantidad debe ser un número entero mayor que cero.')
  })

  it('rechaza una cantidad con decimales', () => {
    expect(
      validarMerma({
        ...base,
        cantidad: 1.5,
      }),
    ).toBe('La cantidad debe ser un número entero mayor que cero.')
  })

  it('rechaza un motivo vacío', () => {
    expect(
      validarMerma({
        ...base,
        motivo: '',
      }),
    ).toBe('Indica el motivo de la merma.')
  })

  it('rechaza un motivo que solo contiene espacios', () => {
    expect(
      validarMerma({
        ...base,
        motivo: '   ',
      }),
    ).toBe('Indica el motivo de la merma.')
  })

  it('rechaza un motivo superior a 1000 caracteres', () => {
    expect(
      validarMerma({
        ...base,
        motivo: 'a'.repeat(1001),
      }),
    ).toBe('El motivo no puede superar 1000 caracteres.')
  })
})