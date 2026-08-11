export type EstadoEnvase = 'bueno' | 'malo'

export interface Despacho {
  id: string
  sucursal_id: string
  vendedor_id: string
  despachador_id: string
  anulado: boolean
  creado_por: string
  creado_en: string
  modificado_por: string | null
  modificado_en: string | null
}

export interface DespachoDetalle {
  id: string
  despacho_id: string
  producto_id: string
  cantidad: number
  es_ajuste: boolean
  creado_en: string
}

export interface DespachoEnvase {
  id: string
  despacho_id: string
  tipo_empaque_id: string
  cantidad: number
  es_ajuste: boolean
  creado_en: string
}

export interface DevolucionProducto {
  id: string
  despacho_id: string
  producto_id: string
  cantidad: number
  anulado: boolean
  creado_por: string
  creado_en: string
}

export interface DevolucionEnvase {
  id: string
  despacho_id: string
  tipo_empaque_id: string
  cantidad: number
  estado: EstadoEnvase
  anulado: boolean
  creado_por: string
  creado_en: string
}

export interface StockBodega {
  sucursal_id: string
  producto_id: string
  cantidad: number
  modificado_en: string
}

export interface StockEnvases {
  sucursal_id: string
  tipo_empaque_id: string
  cantidad: number
  modificado_en: string
}

export interface CargaVendedor {
  vendedor_id: string
  producto_id: string
  cantidad: number
  modificado_en: string
}
