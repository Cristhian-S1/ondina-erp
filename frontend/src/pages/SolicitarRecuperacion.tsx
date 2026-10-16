import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthCard from '../domains/auth/AuthCard'
import { solicitarRecuperacion } from '../domains/auth/api'
import { solicitudSchema } from '../domains/auth/schemas'
import { btnPrimary, errorBlockCls, errorTextCls, inputCls, inputErrorCls, labelCls } from '../lib/ui'

const COOLDOWN_KEY = 'ondina:recovery-next-at'
function remaining() {
  try {
    const deadline = Number(sessionStorage.getItem(COOLDOWN_KEY))
    return Number.isFinite(deadline) ? Math.max(0, Math.min(60, Math.ceil((deadline - Date.now()) / 1000))) : 0
  } catch {
    return 0
  }
}

function startCooldown() {
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + 60_000))
  } catch {
    // In-memory cooldown remains available when browser storage is disabled.
  }
}

export default function SolicitarRecuperacion() {
  const [seconds, setSeconds] = useState(remaining)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({
    resolver: zodResolver(solicitudSchema),
  })

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function submit({ email }: { email: string }) {
    if (seconds > 0) return
    setError(null)
    setSent(false)
    setSeconds(60)
    startCooldown()
    try {
      await solicitarRecuperacion(email, new URL('/restablecer', window.location.origin).href)
      setSent(true)
    } catch {
      setError('No fue posible enviar el enlace. Espera un minuto e intenta nuevamente.')
    }
  }

  return (
    <AuthCard title="Recuperar contraseña">
      <p className="text-sm text-slate-600">Ingresa tu correo y te enviaremos las instrucciones para recuperar tu acceso.</p>
      <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5" aria-busy={isSubmitting}>
        <div>
          <label htmlFor="recovery-email" className={labelCls}>Correo electrónico</label>
          <input
            id="recovery-email" type="email" autoComplete="email" autoCapitalize="none"
            {...register('email')} aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'recovery-email-error' : undefined}
            className={`${inputCls} ${errors.email ? inputErrorCls : ''}`}
          />
          {errors.email && <p id="recovery-email-error" className={errorTextCls}>{errors.email.message}</p>}
        </div>
        {sent && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también tu carpeta de spam.
          </p>
        )}
        {error && <p role="alert" className={errorBlockCls}>{error}</p>}
        <button className={`${btnPrimary} w-full`} disabled={isSubmitting || seconds > 0}>
          {isSubmitting ? 'Enviando...' : sent ? 'Reenviar enlace' : 'Enviar enlace'}
        </button>
        {seconds > 0 && <p className="text-sm text-slate-600">Podrás solicitar otro enlace en {seconds} segundos.</p>}
      </form>
    </AuthCard>
  )
}
