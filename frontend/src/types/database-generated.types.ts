export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          accion: string
          creado_en: string
          id: number
          registro_id: string
          tabla: string
          usuario_id: string | null
          valores_anteriores: Json | null
          valores_nuevos: Json | null
        }
        Insert: {
          accion: string
          creado_en?: string
          id?: never
          registro_id: string
          tabla: string
          usuario_id?: string | null
          valores_anteriores?: Json | null
          valores_nuevos?: Json | null
        }
        Update: {
          accion?: string
          creado_en?: string
          id?: never
          registro_id?: string
          tabla?: string
          usuario_id?: string | null
          valores_anteriores?: Json | null
          valores_nuevos?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      carga_vendedor: {
        Row: {
          cantidad: number
          modificado_en: string
          producto_id: string
          vendedor_id: string
        }
        Insert: {
          cantidad?: number
          modificado_en?: string
          producto_id: string
          vendedor_id: string
        }
        Update: {
          cantidad?: number
          modificado_en?: string
          producto_id?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carga_vendedor_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_vendedor_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_vendedor_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean
          creado_en: string
          creado_por: string
          direccion: string
          id: string
          modificado_en: string | null
          modificado_por: string | null
          nombre: string
          numero_local: string | null
          sucursal_id: string
          telefono: string | null
          tipo: string
          vendedor_id: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          creado_por: string
          direccion: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          nombre: string
          numero_local?: string | null
          sucursal_id: string
          telefono?: string | null
          tipo?: string
          vendedor_id: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          creado_por?: string
          direccion?: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string
          numero_local?: string | null
          sucursal_id?: string
          telefono?: string | null
          tipo?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "clientes_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "clientes_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_vendedor_id_sucursal_id_fkey"
            columns: ["vendedor_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id", "sucursal_id"]
          },
          {
            foreignKeyName: "clientes_vendedor_id_sucursal_id_fkey"
            columns: ["vendedor_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id", "sucursal_id"]
          },
        ]
      }
      configuracion: {
        Row: {
          clave: string
          descripcion: string | null
          modificado_en: string | null
          modificado_por: string | null
          valor: string
        }
        Insert: {
          clave: string
          descripcion?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          valor: string
        }
        Update: {
          clave?: string
          descripcion?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracion_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      despacho_detalles: {
        Row: {
          cantidad: number
          creado_en: string
          despacho_id: string
          es_ajuste: boolean
          id: string
          producto_id: string
        }
        Insert: {
          cantidad: number
          creado_en?: string
          despacho_id: string
          es_ajuste?: boolean
          id?: string
          producto_id: string
        }
        Update: {
          cantidad?: number
          creado_en?: string
          despacho_id?: string
          es_ajuste?: boolean
          id?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "despacho_detalles_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despacho_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      despacho_envases: {
        Row: {
          cantidad: number
          creado_en: string
          despacho_id: string
          es_ajuste: boolean
          id: string
          tipo_empaque_id: string
        }
        Insert: {
          cantidad: number
          creado_en?: string
          despacho_id: string
          es_ajuste?: boolean
          id?: string
          tipo_empaque_id: string
        }
        Update: {
          cantidad?: number
          creado_en?: string
          despacho_id?: string
          es_ajuste?: boolean
          id?: string
          tipo_empaque_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "despacho_envases_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despacho_envases_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "tipos_empaque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despacho_envases_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "v_bidones_vacios_vendedor"
            referencedColumns: ["tipo_empaque_id"]
          },
        ]
      }
      despachos: {
        Row: {
          anulado: boolean
          creado_en: string
          creado_por: string
          despachador_id: string
          id: string
          modificado_en: string | null
          modificado_por: string | null
          sucursal_id: string
          vendedor_id: string
        }
        Insert: {
          anulado?: boolean
          creado_en?: string
          creado_por: string
          despachador_id: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          sucursal_id: string
          vendedor_id: string
        }
        Update: {
          anulado?: boolean
          creado_en?: string
          creado_por?: string
          despachador_id?: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          sucursal_id?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "despachos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despachos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "despachos_despachador_id_fkey"
            columns: ["despachador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despachos_despachador_id_fkey"
            columns: ["despachador_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "despachos_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despachos_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "despachos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despachos_vendedor_id_sucursal_id_fkey"
            columns: ["vendedor_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id", "sucursal_id"]
          },
          {
            foreignKeyName: "despachos_vendedor_id_sucursal_id_fkey"
            columns: ["vendedor_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id", "sucursal_id"]
          },
        ]
      }
      devoluciones_envases: {
        Row: {
          anulado: boolean
          cantidad: number
          creado_en: string
          creado_por: string
          despacho_id: string
          estado: string
          id: string
          tipo_empaque_id: string
        }
        Insert: {
          anulado?: boolean
          cantidad: number
          creado_en?: string
          creado_por: string
          despacho_id: string
          estado?: string
          id?: string
          tipo_empaque_id: string
        }
        Update: {
          anulado?: boolean
          cantidad?: number
          creado_en?: string
          creado_por?: string
          despacho_id?: string
          estado?: string
          id?: string
          tipo_empaque_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_envases_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_envases_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "devoluciones_envases_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_envases_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "tipos_empaque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_envases_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "v_bidones_vacios_vendedor"
            referencedColumns: ["tipo_empaque_id"]
          },
        ]
      }
      devoluciones_productos: {
        Row: {
          anulado: boolean
          cantidad: number
          creado_en: string
          creado_por: string
          despacho_id: string
          id: string
          producto_id: string
        }
        Insert: {
          anulado?: boolean
          cantidad: number
          creado_en?: string
          creado_por: string
          despacho_id: string
          id?: string
          producto_id: string
        }
        Update: {
          anulado?: boolean
          cantidad?: number
          creado_en?: string
          creado_por?: string
          despacho_id?: string
          id?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_productos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_productos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "devoluciones_productos_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_extras: {
        Row: {
          anulado: boolean
          comprobante_url: string | null
          creado_en: string
          creado_por: string
          id: string
          modificado_en: string | null
          modificado_por: string | null
          monto: number
          motivo: string
          sucursal_id: string
          tipo: string
          vendedor_id: string
        }
        Insert: {
          anulado?: boolean
          comprobante_url?: string | null
          creado_en?: string
          creado_por: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          monto: number
          motivo: string
          sucursal_id: string
          tipo?: string
          vendedor_id: string
        }
        Update: {
          anulado?: boolean
          comprobante_url?: string | null
          creado_en?: string
          creado_por?: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          monto?: number
          motivo?: string
          sucursal_id?: string
          tipo?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_extras_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_extras_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "gastos_extras_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_extras_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "gastos_extras_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_extras_vendedor_id_sucursal_id_fkey"
            columns: ["vendedor_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id", "sucursal_id"]
          },
          {
            foreignKeyName: "gastos_extras_vendedor_id_sucursal_id_fkey"
            columns: ["vendedor_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id", "sucursal_id"]
          },
        ]
      }
      incidencias_produccion: {
        Row: {
          creado_en: string
          creado_por: string
          descripcion: string
          id: string
          produccion_id: string | null
        }
        Insert: {
          creado_en?: string
          creado_por: string
          descripcion: string
          id?: string
          produccion_id?: string | null
        }
        Update: {
          creado_en?: string
          creado_por?: string
          descripcion?: string
          id?: string
          produccion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_produccion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_produccion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "incidencias_produccion_produccion_id_fkey"
            columns: ["produccion_id"]
            isOneToOne: false
            referencedRelation: "producciones"
            referencedColumns: ["id"]
          },
        ]
      }
      mermas: {
        Row: {
          anulado: boolean
          cantidad: number
          creado_en: string
          creado_por: string
          despacho_id: string | null
          id: string
          motivo: string
          producto_id: string | null
          sucursal_id: string
          tipo_empaque_id: string | null
        }
        Insert: {
          anulado?: boolean
          cantidad: number
          creado_en?: string
          creado_por: string
          despacho_id?: string | null
          id?: string
          motivo: string
          producto_id?: string | null
          sucursal_id: string
          tipo_empaque_id?: string | null
        }
        Update: {
          anulado?: boolean
          cantidad?: number
          creado_en?: string
          creado_por?: string
          despacho_id?: string | null
          id?: string
          motivo?: string
          producto_id?: string | null
          sucursal_id?: string
          tipo_empaque_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mermas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mermas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "mermas_despacho_id_sucursal_id_fkey"
            columns: ["despacho_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "despachos"
            referencedColumns: ["id", "sucursal_id"]
          },
          {
            foreignKeyName: "mermas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mermas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mermas_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "tipos_empaque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mermas_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "v_bidones_vacios_vendedor"
            referencedColumns: ["tipo_empaque_id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          apellidos: string
          creado_en: string
          id: string
          nombres: string
          rol: string
          rut: string | null
          sucursal_id: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          apellidos: string
          creado_en?: string
          id: string
          nombres: string
          rol: string
          rut?: string | null
          sucursal_id?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          apellidos?: string
          creado_en?: string
          id?: string
          nombres?: string
          rol?: string
          rut?: string | null
          sucursal_id?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      producciones: {
        Row: {
          anulado: boolean
          cantidad: number
          creado_en: string
          creado_por: string
          id: string
          observaciones: string | null
          producto_id: string
          sucursal_id: string
        }
        Insert: {
          anulado?: boolean
          cantidad: number
          creado_en?: string
          creado_por: string
          id?: string
          observaciones?: string | null
          producto_id: string
          sucursal_id: string
        }
        Update: {
          anulado?: boolean
          cantidad?: number
          creado_en?: string
          creado_por?: string
          id?: string
          observaciones?: string | null
          producto_id?: string
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "producciones_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producciones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          creado_en: string
          id: string
          nombre: string
          precio_base: number
          tipo: string
          tipo_empaque_id: string | null
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          id?: string
          nombre: string
          precio_base: number
          tipo: string
          tipo_empaque_id?: string | null
        }
        Update: {
          activo?: boolean
          creado_en?: string
          id?: string
          nombre?: string
          precio_base?: number
          tipo?: string
          tipo_empaque_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "tipos_empaque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "v_bidones_vacios_vendedor"
            referencedColumns: ["tipo_empaque_id"]
          },
        ]
      }
      reglas_comision: {
        Row: {
          creado_por: string | null
          id: string
          monto_fijo: number | null
          porcentaje: number | null
          tipo_producto: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          creado_por?: string | null
          id?: string
          monto_fijo?: number | null
          porcentaje?: number | null
          tipo_producto: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          creado_por?: string | null
          id?: string
          monto_fijo?: number | null
          porcentaje?: number | null
          tipo_producto?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reglas_comision_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reglas_comision_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      stock_bodega: {
        Row: {
          cantidad: number
          modificado_en: string
          producto_id: string
          sucursal_id: string
        }
        Insert: {
          cantidad?: number
          modificado_en?: string
          producto_id: string
          sucursal_id: string
        }
        Update: {
          cantidad?: number
          modificado_en?: string
          producto_id?: string
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_bodega_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_bodega_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_envases: {
        Row: {
          cantidad: number
          modificado_en: string
          sucursal_id: string
          tipo_empaque_id: string
        }
        Insert: {
          cantidad?: number
          modificado_en?: string
          sucursal_id: string
          tipo_empaque_id: string
        }
        Update: {
          cantidad?: number
          modificado_en?: string
          sucursal_id?: string
          tipo_empaque_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_envases_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_envases_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "tipos_empaque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_envases_tipo_empaque_id_fkey"
            columns: ["tipo_empaque_id"]
            isOneToOne: false
            referencedRelation: "v_bidones_vacios_vendedor"
            referencedColumns: ["tipo_empaque_id"]
          },
        ]
      }
      sucursales: {
        Row: {
          activa: boolean
          comuna: string | null
          creado_en: string
          direccion: string | null
          id: string
          nombre: string
          region: string | null
          telefono: string | null
        }
        Insert: {
          activa?: boolean
          comuna?: string | null
          creado_en?: string
          direccion?: string | null
          id?: string
          nombre: string
          region?: string | null
          telefono?: string | null
        }
        Update: {
          activa?: boolean
          comuna?: string | null
          creado_en?: string
          direccion?: string | null
          id?: string
          nombre?: string
          region?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      tipos_empaque: {
        Row: {
          activo: boolean
          categoria: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          categoria: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      ubicaciones_vendedores: {
        Row: {
          id: number
          latitud: number
          longitud: number
          registrado_en: string
          vendedor_id: string
        }
        Insert: {
          id?: never
          latitud: number
          longitud: number
          registrado_en?: string
          vendedor_id: string
        }
        Update: {
          id?: never
          latitud?: number
          longitud?: number
          registrado_en?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ubicaciones_vendedores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubicaciones_vendedores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      venta_detalles: {
        Row: {
          cantidad: number
          envases_recibidos: number
          id: string
          precio_unitario: number
          producto_id: string
          subtotal: number | null
          venta_id: string
        }
        Insert: {
          cantidad: number
          envases_recibidos?: number
          id?: string
          precio_unitario: number
          producto_id: string
          subtotal?: number | null
          venta_id: string
        }
        Update: {
          cantidad?: number
          envases_recibidos?: number
          id?: string
          precio_unitario?: number
          producto_id?: string
          subtotal?: number | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_detalles_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          anulado: boolean
          cliente_id: string
          creado_en: string
          creado_por: string
          descuento: number
          folio_documento: string | null
          id: string
          metodo_pago: string
          modificado_en: string | null
          modificado_por: string | null
          observaciones: string | null
          sucursal_id: string
          tipo_documento: string | null
          total: number
          vendedor_id: string
        }
        Insert: {
          anulado?: boolean
          cliente_id: string
          creado_en?: string
          creado_por: string
          descuento?: number
          folio_documento?: string | null
          id?: string
          metodo_pago: string
          modificado_en?: string | null
          modificado_por?: string | null
          observaciones?: string | null
          sucursal_id: string
          tipo_documento?: string | null
          total?: number
          vendedor_id: string
        }
        Update: {
          anulado?: boolean
          cliente_id?: string
          creado_en?: string
          creado_por?: string
          descuento?: number
          folio_documento?: string | null
          id?: string
          metodo_pago?: string
          modificado_en?: string | null
          modificado_por?: string | null
          observaciones?: string | null
          sucursal_id?: string
          tipo_documento?: string | null
          total?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_cliente_id_sucursal_id_fkey"
            columns: ["cliente_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id", "sucursal_id"]
          },
          {
            foreignKeyName: "ventas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ventas_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_modificado_por_fkey"
            columns: ["modificado_por"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_vendedor_id_sucursal_id_fkey"
            columns: ["vendedor_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id", "sucursal_id"]
          },
          {
            foreignKeyName: "ventas_vendedor_id_sucursal_id_fkey"
            columns: ["vendedor_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_vendedores"
            referencedColumns: ["vendedor_id", "sucursal_id"]
          },
        ]
      }
    }
    Views: {
      v_bidones_vacios_vendedor: {
        Row: {
          cantidad: number | null
          empaque_nombre: string | null
          fecha: string | null
          tipo_empaque_id: string | null
          vendedor_id: string | null
        }
        Relationships: []
      }
      v_comision_vendedor: {
        Row: {
          base_comision: number | null
          comision: number | null
          jornada: string | null
          monto_fijo: number | null
          porcentaje: number | null
          tipo: string | null
          vendedor_id: string | null
          ventas_del_tipo: number | null
        }
        Relationships: []
      }
      v_ranking_vendedores: {
        Row: {
          cantidad_ventas: number | null
          mes: string | null
          sucursal_id: string | null
          total_vendido: number | null
          vendedor: string | null
          vendedor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      corregir_devolucion: {
        Args: {
          p_creado_por: string
          p_despacho_id: string
          p_envases: Json
          p_productos: Json
        }
        Returns: undefined
      }
      crear_despacho: {
        Args: {
          p_creado_por: string
          p_despachador_id: string
          p_envases?: Json
          p_lineas: Json
          p_sucursal_id: string
          p_vendedor_id: string
        }
        Returns: string
      }
      es_rol: { Args: { p_rol: string }; Returns: boolean }
      mi_sucursal: { Args: never; Returns: string }
      registrar_venta: {
        Args: {
          p_cliente_id: string
          p_descuento?: number
          p_detalles: Json
          p_metodo_pago: string
          p_observaciones?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
