import type { IndicadorProducto, IndicadorProduccionDiario } from './types'

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
