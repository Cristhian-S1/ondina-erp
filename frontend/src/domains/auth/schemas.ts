import { z } from 'zod'

export const solicitudSchema = z.object({
  email: z.string().trim().pipe(z.email('Ingresa un correo electrónico válido.')),
})

// Matches [auth] minimum_password_length/password_requirements in config.toml.
export const passwordSchema = z.string()
  .min(10, 'Usa al menos 10 caracteres.')
  .regex(/[a-z]/, 'Incluye al menos una letra minúscula.')
  .regex(/[A-Z]/, 'Incluye al menos una letra mayúscula.')
  .regex(/[0-9]/, 'Incluye al menos un número.')

export const restablecerSchema = z.object({ password: passwordSchema, confirm: z.string() })
  .refine(({ password, confirm }) => password === confirm, {
    path: ['confirm'], message: 'Las contraseñas no coinciden.',
  })
