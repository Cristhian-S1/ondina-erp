import { lazy, Suspense } from 'react'
import type { DomainModule } from '../../types/module'
import { BarChartIcon, MapPinIcon, SettingsIcon, ShieldIcon } from '../../components/icons'

const pages = {
  Reportes: lazy(() => import('./pages/Reportes')),
  Ubicaciones: lazy(() => import('./pages/Ubicaciones')),
  Administracion: lazy(() => import('./pages/Administracion')),
  Auditoria: lazy(() => import('./pages/Auditoria')),
}

const administracionModule: DomainModule = {
  name: 'administracion',
  nav: [
    { path: '/reportes', label: 'Reportes', icon: BarChartIcon, roles: ['administrador'] },
    { path: '/ubicaciones', label: 'Geolocalización', icon: MapPinIcon, roles: ['administrador'] },
    { path: '/administracion', label: 'Administración', icon: SettingsIcon, roles: ['administrador'] },
    { path: '/auditoria', label: 'Auditoría', icon: ShieldIcon, roles: ['administrador'] },
  ],
  routes: [
    { path: '/reportes', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Reportes /></Suspense> },
    { path: '/ubicaciones', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Ubicaciones /></Suspense> },
    { path: '/administracion', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Administracion /></Suspense> },
    { path: '/auditoria', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Auditoria /></Suspense> },
  ],
}

export default administracionModule
