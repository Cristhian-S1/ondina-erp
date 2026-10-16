import { lazy, Suspense, useSyncExternalStore } from 'react'
import { descartarReferenciaMutacion, obtenerReferenciaMutacion, suscribirReferenciaMutacion } from './lib/observabilidad'
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
  const referencia = useSyncExternalStore(suscribirReferenciaMutacion, obtenerReferenciaMutacion)
  return (
    <>
      {referencia && (
        <aside role="alert" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-lg">
          <p>No se pudo completar una operación. Revisa el mensaje del formulario antes de reintentar.</p>
          <p className="mt-2 break-words text-xs">Código de soporte: {referencia}</p>
          <button type="button" onClick={descartarReferenciaMutacion} className="mt-2 min-h-11 rounded-lg border border-red-300 px-4 py-2">Cerrar aviso</button>
        </aside>
      )}
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<Suspense fallback={loading}><AuthenticatedRoutes /></Suspense>} />
      </Route>
    </Routes>
    </>
  )
}

export default App
