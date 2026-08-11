export interface Produccion {
  id: string
  sucursal_id: string
  producto_id: string
  cantidad: number
  observaciones: string | null
  anulado: boolean
  creado_por: string
  creado_en: string
}

export interface IncidenciaProduccion {
  id: string
  produccion_id: string | null
  descripcion: string
  creado_por: string
  creado_en: string
}

export interface EnvaseDisponible {
  tipo_empaque_id: string
  nombre: string
  cantidad: number
  modificado_en: string
}

export interface NuevaProduccion {
  sucursal_id: string
  producto_id: string
  cantidad: number
  observaciones: string | null
  creado_por: string
}

export interface NuevaIncidencia {
  produccion_id: string | null
  descripcion: string
  creado_por: string
}

export interface FiltrosProduccion {
  sucursalId: string
  productoId?: string
  desde?: string
  hasta?: string
  limite?: number
}

export interface IndicadorProducto {
  productoId: string
  cantidad: number
  registros: number
}

export interface IndicadorProduccionDiario {
  sucursal_id: string
  producto_id: string
  fecha: string
  cantidad: number
  registros: number
}
