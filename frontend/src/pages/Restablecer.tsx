import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../context/auth-context'
import AuthCard from '../domains/auth/AuthCard'
import { actualizarPassword } from '../domains/auth/api'
import { restablecerSchema } from '../domains/auth/schemas'
import { btnPrimary, btnSecondary, errorBlockCls, errorTextCls, inputCls, inputErrorCls, labelCls } from '../lib/ui'

type PasswordForm = { password: string; confirm: string }

export default function Restablecer() {
  const { recovery, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState(false)
  const [closing, setClosing] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(restablecerSchema),
  })

  async function finish() {
    setClosing(true)
    setError(null)
    try {
      await signOut()
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch {
      setError('Tu contraseña se actualizó, pero no pudimos cerrar la sesión. Intenta cerrar sesión nuevamente.')
    } finally {
      setClosing(false)
    }
  }

  async function submit({ password }: PasswordForm) {
    setError(null)
    try {
      await actualizarPassword(password)
      setUpdated(true)
      await finish()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar la contraseña. Intenta nuevamente.')
    }
  }

  const linkError = /(?:^|[?#&])error(?:_code)?=/.test(location.hash + location.search)
  let content
  if (updated) {
    content = (
      <>
        <p role="status" className="text-sm text-slate-700">
          Tu contraseña se actualizó. Cierra la sesión de recuperación para ingresar nuevamente.
        </p>
        {error && <p role="alert" className={errorBlockCls}>{error}</p>}
        <button onClick={() => void finish()} disabled={closing} className={`${btnPrimary} w-full`}>
          {closing ? 'Cerrando sesión...' : 'Cerrar sesión y volver al login'}
        </button>
      </>
    )
  } else if (loading) {
    content = <p role="status" className="text-sm text-slate-600">Verificando enlace...</p>
  } else if (!recovery || linkError) {
    content = (
      <>
        <p role="alert" className={errorBlockCls}>El enlace expiró, ya fue utilizado o no es válido.</p>
        <Link to="/recuperar" className={`${btnSecondary} w-full`}>Solicitar otro enlace</Link>
      </>
    )
  } else {
    content = (
      <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5" aria-busy={isSubmitting}>
        <p id="password-help" className="text-sm text-slate-600">
          Usa 10 caracteres o más e incluye letras mayúsculas, minúsculas y números.
        </p>
        {(['password', 'confirm'] as const).map((name) => (
          <div key={name}>
            <label htmlFor={name} className={labelCls}>
              {name === 'password' ? 'Nueva contraseña' : 'Confirmar contraseña'}
            </label>
            <input
              id={name} type="password" autoComplete="new-password" {...register(name)}
              aria-invalid={!!errors[name]}
              aria-describedby={`password-help${errors[name] ? ` ${name}-error` : ''}`}
              className={`${inputCls} ${errors[name] ? inputErrorCls : ''}`}
            />
            {errors[name] && <p id={`${name}-error`} className={errorTextCls}>{errors[name].message}</p>}
          </div>
        ))}
        {error && (
          <div>
            <p role="alert" className={errorBlockCls}>{error}</p>
            <Link to="/recuperar" className="flex min-h-11 items-center text-sm text-brand-800 underline">
              Solicitar otro enlace
            </Link>
          </div>
        )}
        <button className={`${btnPrimary} w-full`} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    )
  }

  return <AuthCard title="Restablecer contraseña">{content}</AuthCard>
}
