import { beforeEach, expect, it, vi } from 'vitest'
import { actualizarPassword, solicitarRecuperacion } from './api'
import { restablecerSchema, solicitudSchema } from './schemas'

const auth = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn(), updateUser: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }))
beforeEach(() => vi.resetAllMocks())

it('passes the email and exact public redirect to Supabase', async () => {
  auth.resetPasswordForEmail.mockResolvedValue({ error: null })
  await solicitarRecuperacion('persona@example.invalid', 'https://app.example/restablecer')
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('persona@example.invalid', {
    redirectTo: 'https://app.example/restablecer',
  })
})
it('does not expose backend recovery errors or account existence', async () => {
  auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'private diagnostic' } })
  await expect(solicitarRecuperacion('persona@example.invalid', 'https://app.example/restablecer'))
    .rejects.toThrow('No fue posible enviar el enlace. Espera un minuto e intenta nuevamente.')
})
it('updates only the password', async () => {
  auth.updateUser.mockResolvedValue({ error: null })
  await actualizarPassword('NuevaClave2026')
  expect(auth.updateUser).toHaveBeenCalledWith({ password: 'NuevaClave2026' })
})
it.each(['session_not_found', 'session_expired', 'refresh_token_not_found', 'otp_expired', 'bad_jwt'])(
  'maps invalid recovery session %s into an actionable Spanish message', async (code) => {
    auth.updateUser.mockResolvedValue({ error: { code } })
    await expect(actualizarPassword('NuevaClave2026')).rejects.toThrow('Solicita otro enlace.')
  },
)
it('explains the same-password rejection', async () => {
  auth.updateUser.mockResolvedValue({ error: { code: 'same_password' } })
  await expect(actualizarPassword('NuevaClave2026')).rejects.toThrow('Elige una contraseña diferente')
})
it.each(['Abc123456', 'ABCDEFGHIJ1', 'abcdefghij1', 'Abcdefghij'])(
  'matches config.toml password policy, rejecting %s', (password) => {
    expect(restablecerSchema.safeParse({ password, confirm: password }).success).toBe(false)
  },
)
it('accepts the policy boundary and rejects different confirmation', () => {
  expect(restablecerSchema.safeParse({ password: 'Abcdefghi1', confirm: 'Abcdefghi1' }).success).toBe(true)
  expect(restablecerSchema.safeParse({ password: 'Abcdefghi1', confirm: 'OtherValue1' }).success).toBe(false)
  expect(solicitudSchema.safeParse({ email: 'invalid' }).success).toBe(false)
})
