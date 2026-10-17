import { supabase } from '../../lib/supabase'

export async function solicitarRecuperacion(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw new Error('No fue posible enviar el enlace. Espera un minuto e intenta nuevamente.')
}

export async function actualizarPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (!error) return
  if (['session_not_found', 'session_expired', 'refresh_token_not_found', 'otp_expired', 'bad_jwt'].includes(error.code ?? '')) {
    throw new Error('El enlace expiró, ya fue utilizado o no es válido. Solicita otro enlace.')
  }
  if (error.code === 'same_password') throw new Error('Elige una contraseña diferente de la anterior.')
  throw new Error('No fue posible actualizar la contraseña. Intenta nuevamente o solicita otro enlace.')
}
