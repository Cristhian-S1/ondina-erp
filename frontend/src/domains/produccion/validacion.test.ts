import { describe, expect, it } from 'vitest'
import { validarIncidencia, validarProduccion } from './validacion'
import type { NuevaIncidencia, NuevaProduccion } from './types'

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

describe('validarIncidencia', () => {
  it('acepta una incidencia válida', () => {
    const datos: NuevaIncidencia = {
      produccion_id: null,
      descripcion: 'Falla temporal en la máquina de hielo.',
      creado_por: 'usuario-1',
    }

    expect(validarIncidencia(datos)).toBeNull()
  })

  it('rechaza una descripción vacía', () => {
    const datos: NuevaIncidencia = {
      produccion_id: null,
      descripcion: '',
      creado_por: 'usuario-1',
    }

    expect(validarIncidencia(datos)).toBe(
      'Describe la incidencia antes de registrarla.',
    )
  })

  it('rechaza una descripción que solo contiene espacios', () => {
    const datos: NuevaIncidencia = {
      produccion_id: null,
      descripcion: '   ',
      creado_por: 'usuario-1',
    }

    expect(validarIncidencia(datos)).toBe(
      'Describe la incidencia antes de registrarla.',
    )
  })

  it('rechaza una descripción superior a 1000 caracteres', () => {
    const datos: NuevaIncidencia = {
      produccion_id: null,
      descripcion: 'a'.repeat(1001),
      creado_por: 'usuario-1',
    }

    expect(validarIncidencia(datos)).toBe(
      'La descripción no puede superar 1000 caracteres.',
    )
  })
})