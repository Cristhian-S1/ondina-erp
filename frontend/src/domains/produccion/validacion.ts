import type { NuevaIncidencia, NuevaProduccion } from './types'

export function validarProduccion(datos: NuevaProduccion): string | null {
  if (!datos.sucursal_id || !datos.producto_id) return 'Selecciona un producto.'
  if (!Number.isInteger(datos.cantidad) || datos.cantidad <= 0) {
    return 'La cantidad debe ser un número entero mayor que cero.'
  }
  return null
}

export function validarIncidencia(datos: NuevaIncidencia): string | null {
  const descripcion = datos.descripcion.trim()
  if (!descripcion) return 'Describe la incidencia antes de registrarla.'
  if (descripcion.length > 1000) return 'La descripción no puede superar 1000 caracteres.'
  return null
}
