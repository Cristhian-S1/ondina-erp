// Fábricas de clientes Supabase para los recorridos: los usuarios se
// autentican con Supabase Auth real (contraseñas creadas por el global setup);
// el verificador con service_role se usa solo para afirmar estado y preparar
// fixtures del entorno, nunca para ejecutar las operaciones de los recorridos.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RecorridosFixtures, SessionUser } from './fixtures'

const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } } as const

export function createAnonClient(fixtures: RecorridosFixtures): SupabaseClient {
  return createClient(fixtures.url, fixtures.anonKey, CLIENT_OPTIONS)
}

export function createVerifierClient(fixtures: RecorridosFixtures): SupabaseClient {
  return createClient(fixtures.url, fixtures.serviceRoleKey, CLIENT_OPTIONS)
}

export async function signIn(
  fixtures: RecorridosFixtures,
  user: SessionUser,
): Promise<SupabaseClient> {
  const client = createAnonClient(fixtures)
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) {
    throw new Error(`No fue posible iniciar sesión como ${user.key}: ${error.message}`)
  }
  return client
}
