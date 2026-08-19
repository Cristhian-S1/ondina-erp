import type { NuevaMermaProduccion, NuevaProduccion } from './types'

export function validarProduccion(datos: NuevaProduccion): string | null {
  if (!datos.sucursal_id || !datos.producto_id) return 'Selecciona un producto.'
  if (!Number.isInteger(datos.cantidad) || datos.cantidad <= 0) {
    return 'La cantidad debe ser un número entero mayor que cero.'
  }
  return null
}

export function validarMerma(datos: NuevaMermaProduccion): string | null {
  if (!datos.producto_id) {
    return 'Selecciona un producto.'
  }

  if (!Number.isInteger(datos.cantidad) || datos.cantidad <= 0) {
    return 'La cantidad debe ser un número entero mayor que cero.'
  }

  const motivo = datos.motivo.trim()

  if (!motivo) {
    return 'Indica el motivo de la merma.'
  }

  if (motivo.length > 1000) {
    return 'El motivo no puede superar 1000 caracteres.'
  }

  return null
}