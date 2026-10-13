// Tipos y definiciones de las cuentas sintéticas del B5 (issue #43).
// `global-setup.ts` materializa estas definiciones en Supabase Auth + perfiles
// y comparte el resultado con los recorridos mediante `provide`/`inject`.

import type { Role, Perfil } from '@/types'

export type SucursalKey = 'A' | 'B'

export type UserKey =
  | 'vendedor-a'
  | 'vendedor-b'
  | 'bodega-a'
  | 'bodega-b'
  | 'produccion-a'
  | 'produccion-b'
  | 'admin-a'
  | 'admin-b'
  | 'vendedor-inactivo-a'
  | 'admin-global'

export interface UserDefinition {
  key: UserKey
  rol: Role
  sucursal: SucursalKey | null
  nombres: string
  apellidos: string
  activo: boolean
}

// Una cuenta por rol y sucursal, un vendedor inactivo y la administración
// global (sucursal nula), como exige la tarea B5.
export const USER_DEFINITIONS: readonly UserDefinition[] = [
  { key: 'vendedor-a', rol: 'vendedor', sucursal: 'A', nombres: 'B5 Vendedor', apellidos: 'Sucursal A', activo: true },
  { key: 'vendedor-b', rol: 'vendedor', sucursal: 'B', nombres: 'B5 Vendedor', apellidos: 'Sucursal B', activo: true },
  { key: 'bodega-a', rol: 'bodega', sucursal: 'A', nombres: 'B5 Bodega', apellidos: 'Sucursal A', activo: true },
  { key: 'bodega-b', rol: 'bodega', sucursal: 'B', nombres: 'B5 Bodega', apellidos: 'Sucursal B', activo: true },
  { key: 'produccion-a', rol: 'produccion', sucursal: 'A', nombres: 'B5 Producción', apellidos: 'Sucursal A', activo: true },
  { key: 'produccion-b', rol: 'produccion', sucursal: 'B', nombres: 'B5 Producción', apellidos: 'Sucursal B', activo: true },
  { key: 'admin-a', rol: 'administrador', sucursal: 'A', nombres: 'B5 Administración', apellidos: 'Sucursal A', activo: true },
  { key: 'admin-b', rol: 'administrador', sucursal: 'B', nombres: 'B5 Administración', apellidos: 'Sucursal B', activo: true },
  { key: 'vendedor-inactivo-a', rol: 'vendedor', sucursal: 'A', nombres: 'B5 Vendedor Inactivo', apellidos: 'Sucursal A', activo: false },
  { key: 'admin-global', rol: 'administrador', sucursal: null, nombres: 'B5 Administración Global', apellidos: 'Sin sucursal', activo: true },
]

export interface SessionUser extends UserDefinition {
  id: string
  email: string
  password: string
  sucursalId: string | null
}

export interface ProductoFixture {
  id: string
  nombre: string
  tipo: 'agua' | 'hielo'
  precio_base: number
}

export interface EmpaqueFixture {
  id: string
  nombre: string
  categoria: 'retornable' | 'no_retornable' | 'uso_interno'
}

export interface RecorridosFixtures {
  runId: string
  url: string
  anonKey: string
  serviceRoleKey: string
  sucursales: Record<SucursalKey, string>
  users: Record<UserKey, SessionUser>
  productos: ProductoFixture[]
  empaques: EmpaqueFixture[]
}

declare module 'vitest' {
  export interface ProvidedContext {
    recorridos: RecorridosFixtures
  }
}

export function toPerfil(user: SessionUser): Perfil {
  return {
    id: user.id,
    sucursal_id: user.sucursalId,
    nombres: user.nombres,
    apellidos: user.apellidos,
    rut: null,
    telefono: null,
    rol: user.rol,
    activo: user.activo,
    creado_en: new Date().toISOString(),
  }
}
