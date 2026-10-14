import type { EnvaseDisponible, IndicadorProducto, IndicadorProduccionDiario } from './types'

export interface ResumenProduccion {
  totalUnidades: number
  totalRegistros: number
  porProducto: IndicadorProducto[]
}

export function calcularResumenIndicadores(filas: IndicadorProduccionDiario[]): ResumenProduccion {
  const acumulados = new Map<string, IndicadorProducto>()
  let totalUnidades = 0
  let totalRegistros = 0
  for (const fila of filas) {
    totalUnidades += fila.cantidad
    totalRegistros += fila.registros
    const actual = acumulados.get(fila.producto_id)
    acumulados.set(fila.producto_id, {
      productoId: fila.producto_id,
      cantidad: (actual?.cantidad ?? 0) + fila.cantidad,
      registros: (actual?.registros ?? 0) + fila.registros,
    })
  }
  return {
    totalUnidades,
    totalRegistros,
    porProducto: [...acumulados.values()].sort((a, b) => b.cantidad - a.cantidad),
  }
}

/** Calcula HU-22 desde movimientos reales, sin persistir métricas duplicadas. */

/** Envases vacíos disponibles para producir un producto retornable; null si no hay límite conocido. */
export function limiteEnvases(empaqueId: string | null | undefined, envases: EnvaseDisponible[]): number | null {
  if (!empaqueId) return null
  return envases.find(item => item.tipo_empaque_id === empaqueId)?.cantidad ?? null
}

export function mensajeLimiteEnvases(cantidad: number, limite: number | null): string | undefined {
  if (limite === null || cantidad <= limite) return undefined
  return limite === 1 ? 'Solo hay 1 envase vacío disponible para este producto.' : `Solo hay ${limite} envases vacíos disponibles para este producto.`
}
