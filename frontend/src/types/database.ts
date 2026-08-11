import type { Perfil, Producto, Sucursal, TipoEmpaque } from './index'
import type {
  CargaVendedor,
  Despacho,
  DespachoDetalle,
  DespachoEnvase,
  DevolucionEnvase,
  DevolucionProducto,
  StockBodega,
  StockEnvases,
} from '../domains/bodega/types'
import type { IncidenciaProduccion, Produccion } from '../domains/produccion/types'

export interface Database {
  public: {
    Tables: {
      perfiles: {
        Row: Perfil
        Insert: Omit<Perfil, 'id' | 'creado_en'>
        Update: Partial<Perfil>
        Relationships: []
      }
      sucursales: {
        Row: Sucursal
        Insert: Omit<Sucursal, 'id' | 'creado_en'>
        Update: Partial<Sucursal>
        Relationships: []
      }
      productos: {
        Row: Producto
        Insert: Omit<Producto, 'id' | 'creado_en'>
        Update: Partial<Producto>
        Relationships: []
      }
      tipos_empaque: {
        Row: TipoEmpaque
        Insert: Omit<TipoEmpaque, 'id'>
        Update: Partial<TipoEmpaque>
        Relationships: []
      }
      despachos: {
        Row: Despacho
        Insert: Omit<Despacho, 'id' | 'creado_en' | 'modificado_por' | 'modificado_en' | 'anulado'>
        Update: Partial<Despacho>
        Relationships: []
      }
      despacho_detalles: {
        Row: DespachoDetalle
        Insert: Omit<DespachoDetalle, 'id' | 'creado_en' | 'es_ajuste'>
        Update: Partial<DespachoDetalle>
        Relationships: []
      }
      despacho_envases: {
        Row: DespachoEnvase
        Insert: Omit<DespachoEnvase, 'id' | 'creado_en' | 'es_ajuste'>
        Update: Partial<DespachoEnvase>
        Relationships: []
      }
      devoluciones_productos: {
        Row: DevolucionProducto
        Insert: Omit<DevolucionProducto, 'id' | 'creado_en' | 'anulado'>
        Update: Partial<DevolucionProducto>
        Relationships: []
      }
      devoluciones_envases: {
        Row: DevolucionEnvase
        Insert: Omit<DevolucionEnvase, 'id' | 'creado_en' | 'anulado'>
        Update: Partial<DevolucionEnvase>
        Relationships: []
      }
      stock_bodega: {
        Row: StockBodega
        Insert: StockBodega
        Update: Partial<StockBodega>
        Relationships: []
      }
      stock_envases: {
        Row: StockEnvases
        Insert: StockEnvases
        Update: Partial<StockEnvases>
        Relationships: []
      }

      carga_vendedor: {
        Row: CargaVendedor
        Insert: Omit<CargaVendedor, 'cantidad' | 'modificado_en'>
        Update: Partial<CargaVendedor>
        Relationships: []
      }

      producciones: {
        Row: Produccion
        Insert: Omit<Produccion, 'id' | 'creado_en' | 'anulado'>
        Update: Partial<Produccion>
        Relationships: []
      }

      incidencias_produccion: {
        Row: IncidenciaProduccion
        Insert: Omit<IncidenciaProduccion, 'id' | 'creado_en'>
        Update: Partial<IncidenciaProduccion>
        Relationships: []
      }
    }

    Views: {
      v_indicadores_produccion_diarios: {
        Row: import('../domains/produccion/types').IndicadorProduccionDiario
      }
    }
  }
}
