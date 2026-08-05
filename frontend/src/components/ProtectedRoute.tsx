import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import type { Role } from '../types'

interface ProtectedRouteProps {
  roles?: Role[]
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { perfil, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    )
  }
  if (!perfil) return <Navigate to="/login" replace />
  if (roles && !roles.includes(perfil.rol)) return <Navigate to="/" replace />

  return <Outlet />
}
