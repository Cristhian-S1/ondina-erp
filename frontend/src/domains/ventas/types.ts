// Tipos del dominio de ventas. Reusa los tipos generados desde Supabase en
// `types/database-generated.types.ts` cuando aplique, y define aquí los DTO
// que consume la UI.

import type { Database } from '../../types/database-generated.types'
import type { Producto, TipoEmpaque } from '../../types'

export type TipoCliente = 'mayorista' | 'minorista' | 'ocasional'
export type MetodoPago = 'efectivo' | 'transferencia'
export type TipoGasto = 'combustible' | 'averia' | 'otra'

export type ClienteRow = Database['public']['Tables']['clientes']['Row']

export type Cliente = ClienteRow

export interface ClienteCartera {
  id: string
  nombre: string
  telefono: string | null
  direccion: string
  numero_local: string | null
  tipo: string
  activo: boolean
  creado_en: string
}

export type CargaVendedorRow = Database['public']['Tables']['carga_vendedor']['Row']

export interface CargaVendedor extends CargaVendedorRow {
  producto: Pick<Producto, 'id' | 'nombre' | 'tipo' | 'precio_base'> | null
}

export type GastoExtra = Database['public']['Tables']['gastos_extras']['Row']

export interface ProductoVenta extends Producto {
  tipo_empaque: Pick<TipoEmpaque, 'id' | 'nombre' | 'categoria'> | null
}

// Payload del detalle que se envía como JSONB a `registrar_venta`.
export interface DetalleVentaInput {
  producto_id: string
  cantidad: number
  precio_unitario: number
  envases_recibidos: number
}

// Draft de detalle del formulario. Envases_recibidos siempre va en 0 al backend
// (HU-05 eliminada del frontend; los envases los registra bodega vía HU-28).
export interface DetalleVentaDraft {
  productoId: string
  cantidad: number
  precioUnitario: number
}

export interface RegistrarVentaArgs {
  p_cliente_id: string
  p_metodo_pago: MetodoPago
  p_detalles: DetalleVentaInput[]
  p_descuento: number
  p_observaciones: string | undefined
}