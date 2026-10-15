// O2 / #44: real Mailpit recovery and active-profile cutoff with an unchanged JWT.
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createAnonClient } from './support/clients'
import { createJourneyContext, type JourneyContext } from './support/context'
import { setActiveClient } from './support/registry'
import { solicitarRecuperacion, actualizarPassword } from '@/domains/auth/api'

vi.mock('@/lib/supabase', async () => {
  const { supabaseProxy } = await import('./support/registry')
  return { supabase: supabaseProxy }
})

const MAILPIT = 'http://127.0.0.1:54324'
let ctx: JourneyContext
beforeAll(() => {
  const fixtures = inject('recorridos')
  if (!['127.0.0.1', 'localhost'].includes(new URL(fixtures.url).hostname)) {
    throw new Error('O2 recovery journeys are local-only.')
  }
  ctx = createJourneyContext(fixtures)
})
afterAll(async () => { await ctx?.dispose() })

interface MailSummary { ID: string; To: { Address: string }[] }
async function recoveryToken(email: string): Promise<string> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT}/api/v1/messages`)
    if (!response.ok) throw new Error(`Mailpit index HTTP ${response.status}`)
    const index = await response.json() as { messages: MailSummary[] }
    const mail = index.messages.find((item) => item.To.some((to) => to.Address === email))
    if (mail) {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${mail.ID}`)
      if (!detail.ok) throw new Error(`Mailpit message HTTP ${detail.status}`)
      const body = await detail.json() as { HTML: string; Text: string }
      const links = `${body.Text}\n${body.HTML}`.replaceAll('&amp;', '&').match(/https?:\/\/[^\s<>"']+/g) ?? []
      for (const link of links) {
        const url = new URL(link)
        if (url.searchParams.get('type') === 'recovery') {
          const token = url.searchParams.get('token_hash') ?? url.searchParams.get('token')
          if (token) return token
        }
      }
      throw new Error('Mailpit recovery message contained no recovery token.')
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('Mailpit did not receive the synthetic recovery email within 10 seconds.')
}

describe('O2 · recuperación de contraseña', () => {
  it('correo real → PASSWORD_RECOVERY → nueva contraseña → login; enlace reutilizado falla', async () => {
    // Existing B5 fixture passwords predate the current policy; use a dedicated compliant account.
    const email = `o2-${ctx.fixtures.runId}@example.invalid`
    const originalPassword = `O2-Original-${ctx.fixtures.runId}-2026`
    const created = await ctx.verifier.auth.admin.createUser({ email, password: originalPassword, email_confirm: true })
    expect(created.error).toBeNull()
    const user = { id: created.data.user!.id, email, password: originalPassword }
    const client = createAnonClient(ctx.fixtures)
    const events: string[] = []
    const listener = client.auth.onAuthStateChange((event) => { events.push(event) })
    setActiveClient(client)
    try {
      await solicitarRecuperacion(user.email, 'http://127.0.0.1:5173/restablecer')
      const tokenHash = await recoveryToken(user.email)
      const verified = await client.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
      expect(verified.error).toBeNull()
      expect(verified.data.session?.user.id).toBe(user.id)
      expect(events).toContain('PASSWORD_RECOVERY')

      const password = `O2-Nueva-${ctx.fixtures.runId}-2026`
      await actualizarPassword(password)
      expect((await client.auth.signOut()).error).toBeNull()
      expect((await client.auth.getSession()).data.session).toBeNull()
      const login = await client.auth.signInWithPassword({ email: user.email, password })
      expect(login.error).toBeNull()
      expect(login.data.user?.id).toBe(user.id)
      expect((await client.auth.signOut()).error).toBeNull()

      const reused = await client.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
      expect(reused.error?.code).toBe('otp_expired')
      expect(reused.data.session).toBeNull()
      expect((await client.auth.getSession()).data.session).toBeNull()
    } finally {
      listener.data.subscription.unsubscribe()
      // Restore even if a preceding assertion fails. Never print credentials or tokens.
      try {
        const restored = await ctx.verifier.auth.admin.updateUserById(user.id, { password: user.password })
        expect(restored.error).toBeNull()
        const original = await client.auth.signInWithPassword({ email: user.email, password: user.password })
        expect(original.error).toBeNull()
      } finally {
        await client.auth.signOut()
        setActiveClient(null)
        // No ERP profile/history references this dedicated Auth fixture.
        expect((await ctx.verifier.auth.admin.deleteUser(user.id)).error).toBeNull()
      }
    }
  })
})

describe('O2 · desactivación con JWT vigente', () => {
  it('corta PostgREST con el mismo JWT y recupera las lecturas al restaurar activo', async () => {
    const user = ctx.user('vendedor-b')
    const client = createAnonClient(ctx.fixtures)
    const login = await client.auth.signInWithPassword({ email: user.email, password: user.password })
    expect(login.error).toBeNull()
    const jwt = login.data.session!.access_token
    const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()) as { exp: number }
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000)
    // A fixed Authorization header proves no refresh or new login can explain the cutoff.
    const fixed = createClient(ctx.fixtures.url, ctx.fixtures.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const read = () => fixed.from('carga_vendedor').select('vendedor_id, cantidad').eq('vendedor_id', user.id)
    const before = await read()
    expect(before.error).toBeNull()
    expect(before.data!.length).toBeGreaterThan(0)
    try {
      const disabled = await ctx.verifier.from('perfiles').update({ activo: false }).eq('id', user.id).select('activo').single()
      expect(disabled.error).toBeNull()
      expect(disabled.data?.activo).toBe(false)
      expect((await fixed.auth.getUser(jwt)).error).toBeNull()
      const after = await read()
      expect(after.error).toBeNull()
      expect(after.data).toEqual([])
      const catalog = await fixed.from('productos').select('id')
      expect(catalog.error).toBeNull()
      expect(catalog.data).toEqual([])
      expect((await client.auth.getSession()).data.session?.access_token).toBe(jwt)
    } finally {
      const restored = await ctx.verifier.from('perfiles').update({ activo: true }).eq('id', user.id).select('activo').single()
      expect(restored.error).toBeNull()
      expect(restored.data?.activo).toBe(true)
      const again = await read()
      expect(again.error).toBeNull()
      expect(again.data).toEqual(before.data)
      await client.auth.signOut()
    }
  })
})
