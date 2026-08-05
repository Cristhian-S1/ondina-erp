export type Role = 'vendedor' | 'bodega' | 'produccion' | 'administrador'

export type TipoProducto = 'agua' | 'hielo'
export type CategoriaEmpaque = 'retornable' | 'no_retornable' | 'uso_interno'

export interface Sucursal {
  id: string
  nombre: string
  direccion: string | null
  comuna: string | null
  region: string | null
  telefono: string | null
  activa: boolean
  creado_en: string
}

export interface Perfil {
  id: string
  sucursal_id: string | null
  nombres: string
  apellidos: string
  rut: string | null
  telefono: string | null
  rol: Role
  activo: boolean
  creado_en: string
}

export interface Producto {
  id: string
  nombre: string
  tipo: TipoProducto
  tipo_empaque_id: string | null
  precio_base: number
  activo: boolean
  creado_en: string
}

export interface TipoEmpaque {
  id: string
  nombre: string
  categoria: CategoriaEmpaque
  activo: boolean
}


