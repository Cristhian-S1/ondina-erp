import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'

// Start these imports together, only after ProtectedRoute accepts the session.
// Login keeps the auth/query providers but does not download the application shell.
const AuthenticatedRoutes = lazy(async () => {
  const [{ default: DashboardLayout }, { default: Dashboard }, { domains }] = await Promise.all([
    import('./components/DashboardLayout'),
    import('./pages/Dashboard'),
    import('./domains'),
  ])
  return {
    default: function AuthenticatedRoutes() {
      return (
        <Routes>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )
    },
  }
})

const loading = (
  <div className="flex min-h-svh items-center justify-center">
    <p className="text-sm text-slate-500">Cargando...</p>
  </div>
)

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<Suspense fallback={loading}><AuthenticatedRoutes /></Suspense>} />
      </Route>
    </Routes>
  )
}

export default App
