// Registro del cliente activo. Los servicios de dominio importan el módulo
// compartido `src/lib/supabase`; cada recorrido nunca lo toca directamente:
// `vi.mock('@/lib/supabase')` lo reemplaza por `supabaseProxy`, que delega en
// el cliente autenticado del usuario que el test declaró con `actAs`.

import type { SupabaseClient } from '@supabase/supabase-js'

let active: SupabaseClient | null = null

export function setActiveClient(client: SupabaseClient | null): void {
  active = client
}

export function getActiveClient(): SupabaseClient {
  if (!active) {
    throw new Error('La suite de integración intentó usar Supabase sin un cliente activo; llama a actAs antes.')
  }
  return active
}

export const supabaseProxy = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getActiveClient()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
