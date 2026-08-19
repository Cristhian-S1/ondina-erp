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

export interface MermaProduccion {
  id: string
  sucursal_id: string
  producto_id: string | null
  tipo_empaque_id: string | null
  despacho_id: string | null
  cantidad: number
  motivo: string
  anulado: boolean
  creado_por: string
  creado_en: string
}

export interface NuevaMermaProduccion {
  sucursal_id: string
  producto_id: string
  tipo_empaque_id: null
  despacho_id: null
  cantidad: number
  motivo: string
  creado_por: string
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
