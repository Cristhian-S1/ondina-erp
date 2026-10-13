// Resolución del entorno del stack local. En CI se usan las variables
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY; en local se leen
// de `supabase status -o env` (nunca de archivos .env reales).

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export interface SupabaseEnv {
  url: string
  anonKey: string
  serviceRoleKey: string
}

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))

function parseStatusEnv(output: string): Record<string, string> {
  const parsed: Record<string, string> = {}
  for (const rawLine of output.split('\n')) {
    const match = /^([A-Z0-9_]+)="(.*)"$/.exec(rawLine.trim())
    if (match) parsed[match[1]] = match[2]
  }
  return parsed
}

export function resolveSupabaseEnv(): SupabaseEnv {
  const url = process.env.SUPABASE_URL?.trim()
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (url && anonKey && serviceRoleKey) {
    return { url, anonKey, serviceRoleKey }
  }

  let statusOutput: string
  try {
    statusOutput = execFileSync('supabase', ['status', '-o', 'env'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    throw new Error(
      'No fue posible leer `supabase status -o env`. Inicia el stack aislado con `supabase start` o define SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.',
      { cause: error },
    )
  }

  const parsed = parseStatusEnv(statusOutput)
  const resolved = {
    url: parsed.API_URL,
    anonKey: parsed.ANON_KEY,
    serviceRoleKey: parsed.SERVICE_ROLE_KEY,
  }
  if (!resolved.url || !resolved.anonKey || !resolved.serviceRoleKey) {
    throw new Error('`supabase status -o env` no entregó API_URL, ANON_KEY y SERVICE_ROLE_KEY; revisa el stack local.')
  }
  return resolved
}
