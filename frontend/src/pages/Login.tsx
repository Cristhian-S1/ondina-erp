import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { mensajeErrorAutenticacion } from '../lib/errors'
import { btnPrimary, errorBlockCls, inputCls, labelCls } from '../lib/ui'
import logo from '../assets/logo.jpg'

export default function Login() {
  const { perfil, signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [verPassword, setVerPassword] = useState(false)

  if (perfil) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(mensajeErrorAutenticacion(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-brand-50/70 via-slate-100 to-brand-100/60 p-4">
      <form
        className="w-full max-w-sm space-y-5 rounded-2xl border border-brand-200 bg-white p-8 shadow-lg"
        onSubmit={handleSubmit}
      >
        <div className="text-center">
          <img
            src={logo}
            alt="Ondina"
            className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover shadow-sm"
          />
          <h1 className="text-2xl font-bold text-brand-900">Ondina</h1>
          <p className="mt-1 text-sm text-slate-500">Inicia sesión para continuar</p>
        </div>

        <div>
          <label htmlFor="login-email" className={labelCls}>Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={labelCls}>Contraseña</label>
          <div className="relative">
            <input
              id="login-password"
              type={verPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              className={`${inputCls} pr-12`}
            />
            <button
              type="button"
              onClick={() => setVerPassword((value) => !value)}
              aria-pressed={verPassword}
              className="absolute inset-y-0 right-0 mt-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs font-medium text-brand-800 hover:bg-brand-50"
            >
              <span className="sr-only">Mostrar contraseña</span>
              <span aria-hidden="true">{verPassword ? 'Ocultar' : 'Ver'}</span>
            </button>
          </div>
        </div>

        {error && (
          <p id="login-error" role="alert" className={errorBlockCls}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`${btnPrimary} w-full`}
        >
          {submitting ? 'Entrando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
