import { lazy, Suspense } from 'react'
import type { DomainModule } from '../../types/module'
import { Navigate } from 'react-router-dom'
import { AlertIcon, BarChartIcon, BoxIcon, FactoryIcon, ShieldIcon } from '../../components/icons'

const pages = {
  Produccion: lazy(() => import('./pages/Produccion')),
}

const produccionModule: DomainModule = {
  name: 'produccion',
  nav: [
    { path: '/produccion/registrar', label: 'Registrar producción', icon: FactoryIcon, roles: ['produccion', 'administrador'] },
    { path: '/produccion/envases', label: 'Envases vacíos', icon: BoxIcon, roles: ['produccion', 'administrador'] },
    { path: '/produccion/historial', label: 'Historial', icon: ShieldIcon, roles: ['produccion', 'administrador'] },
    { path: '/produccion/indicadores', label: 'Indicadores', icon: BarChartIcon, roles: ['produccion', 'administrador'] },
    { path: '/produccion/incidencias', label: 'Incidencias', icon: AlertIcon, roles: ['produccion', 'administrador'] },
  ],
  routes: [
    { path: '/produccion', element: <Navigate to="/produccion/registrar" replace /> },
    { path: '/produccion/registrar', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Produccion /></Suspense> },
    { path: '/produccion/envases', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Produccion /></Suspense> },
    { path: '/produccion/historial', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Produccion /></Suspense> },
    { path: '/produccion/indicadores', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Produccion /></Suspense> },
    { path: '/produccion/incidencias', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Produccion /></Suspense> },
  ],
}

export default produccionModule
