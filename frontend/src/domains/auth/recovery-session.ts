import type { Session } from '@supabase/supabase-js'

const KEY = 'ondina:recovery-session'

export function recoverySessionId(session: Session | null): string | null {
  try {
    const payload = session?.access_token.split('.')[1]
    if (!payload) return null
    return (JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      session_id?: string
    }).session_id ?? null
  } catch {
    return null
  }
}

// Store only the session identifier, never a token. Shared storage preserves the
// recovery boundary on reload and when another tab opens the persisted session.
export function rememberRecovery(session: Session | null) {
  try {
    const id = recoverySessionId(session)
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    // The provider retains the current recovery boundary when storage is unavailable.
  }
}

export function isRecoverySession(session: Session | null): boolean {
  try {
    const id = recoverySessionId(session)
    return !!id && localStorage.getItem(KEY) === id
  } catch {
    return false
  }
}
