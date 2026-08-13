interface ErrorConCodigo {
  code?: string
  message?: string
  details?: string
}

const mensajesPorCodigo: Record<string, string> = {
  '23505': 'Ya existe un registro con los mismos datos.',
  '23514': 'Alguno de los datos no cumple las reglas del negocio.',
  '23503': 'La operación hace referencia a un registro que no existe.',
  '42501': 'No tienes permisos para realizar esta acción.',
  '22P02': 'El dato enviado no tiene el formato esperado.',
  '22001': 'El dato enviado supera el largo máximo permitido.',
  '22003': 'El número enviado está fuera del rango permitido.',
}

export function mensajeErrorSupabase(error: unknown): string {
  const e = (error ?? {}) as ErrorConCodigo

  if (e.code === 'P0001') {
    return e.message ?? 'Operación rechazada por las reglas del negocio.'
  }
  if (e.code && mensajesPorCodigo[e.code]) {
    return mensajesPorCodigo[e.code]
  }
  if (e.message) {
    return e.message
  }
  return 'Ocurrió un error inesperado.'
}
