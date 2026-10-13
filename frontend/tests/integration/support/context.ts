// Contexto por archivo de recorrido: clientes autenticados por usuario,
// verificador service_role y ayudantes de lectura de saldos.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createVerifierClient, signIn } from './clients'
import { setActiveClient } from './registry'
import { toPerfil, type RecorridosFixtures, type SessionUser, type UserKey } from './fixtures'
import type { Perfil } from '@/types'

export interface ActingUser {
  user: SessionUser
  perfil: Perfil
  client: SupabaseClient
}

export interface JourneyContext {
  fixtures: RecorridosFixtures
  verifier: SupabaseClient
  user(key: UserKey): SessionUser
  perfil(key: UserKey): Perfil
  client(key: UserKey): Promise<SupabaseClient>
  actAs(key: UserKey): Promise<ActingUser>
  dispose(): Promise<void>
}

export function createJourneyContext(fixtures: RecorridosFixtures): JourneyContext {
  const clients = new Map<UserKey, SupabaseClient>()
  const verifier = createVerifierClient(fixtures)

  async function client(key: UserKey): Promise<SupabaseClient> {
    const cached = clients.get(key)
    if (cached) return cached
    const created = await signIn(fixtures, fixtures.users[key])
    clients.set(key, created)
    return created
  }

  return {
    fixtures,
    verifier,
    user: (key) => fixtures.users[key],
    perfil: (key) => toPerfil(fixtures.users[key]),
    client,
    async actAs(key) {
      const session = await client(key)
      setActiveClient(session)
      return { user: fixtures.users[key], perfil: toPerfil(fixtures.users[key]), client: session }
    },
    async dispose() {
      setActiveClient(null)
      for (const session of clients.values()) {
        try {
          await session.auth.signOut()
        } catch {
          // El cierre de sesión es limpieza local; un fallo no invalida el recorrido.
        }
      }
      clients.clear()
    },
  }
}

// --- Saldos (lecturas del verificador) ---

async function cantidad(
  verifier: SupabaseClient,
  table: 'stock_bodega' | 'stock_envases' | 'carga_vendedor',
  filter: Record<string, string>,
): Promise<number> {
  let query = verifier.from(table).select('cantidad')
  for (const [column, value] of Object.entries(filter)) {
    query = query.eq(column, value)
  }
  const { data, error } = await query.single()
  if (error) {
    throw new Error(`No fue posible leer ${table} (${JSON.stringify(filter)}): ${error.message}`)
  }
  return Number((data as { cantidad: number }).cantidad)
}

export function stockProducto(verifier: SupabaseClient, sucursalId: string, productoId: string): Promise<number> {
  return cantidad(verifier, 'stock_bodega', { sucursal_id: sucursalId, producto_id: productoId })
}

export function stockEmpaque(verifier: SupabaseClient, sucursalId: string, tipoEmpaqueId: string): Promise<number> {
  return cantidad(verifier, 'stock_envases', { sucursal_id: sucursalId, tipo_empaque_id: tipoEmpaqueId })
}

export function cargaVendedor(verifier: SupabaseClient, vendedorId: string, productoId: string): Promise<number> {
  return cantidad(verifier, 'carga_vendedor', { vendedor_id: vendedorId, producto_id: productoId })
}
