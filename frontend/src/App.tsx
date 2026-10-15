import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { domains } from './domains'

const SolicitarRecuperacion = lazy(() => import('./pages/SolicitarRecuperacion'))
const Restablecer = lazy(() => import('./pages/Restablecer'))
const recoveryFallback = <main className="flex min-h-svh items-center justify-center"><p role="status">Cargando...</p></main>

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar" element={<Suspense fallback={recoveryFallback}><SolicitarRecuperacion /></Suspense>} />
      <Route path="/restablecer" element={<Suspense fallback={recoveryFallback}><Restablecer /></Suspense>} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Dashboard />} />
          {domains.flatMap((module) =>
            module.routes.map((route) => (
              <Route key={route.path} element={<ProtectedRoute roles={route.roles} />}>
                <Route path={route.path} element={route.element} />
              </Route>
            )),
          )}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
