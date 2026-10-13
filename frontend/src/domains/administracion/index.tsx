import { lazy, Suspense } from 'react'
import type { Role } from '../../types'
import type { DomainModule } from '../../types/module'
import { BarChartIcon, MapPinIcon, SettingsIcon, ShieldIcon } from '../../components/icons'

const allowedRoles: Role[] = ['administrador']

const pages = {
  Reportes: lazy(() => import('./pages/Reportes')),
  Ubicaciones: lazy(() => import('./pages/Ubicaciones')),
  Administracion: lazy(() => import('./pages/Administracion')),
  Auditoria: lazy(() => import('./pages/Auditoria')),
}

const administracionModule: DomainModule = {
  name: 'administracion',
  nav: [
    { path: '/reportes', label: 'Reportes', icon: BarChartIcon, roles: allowedRoles },
    { path: '/ubicaciones', label: 'Geolocalización', icon: MapPinIcon, roles: allowedRoles },
    { path: '/administracion', label: 'Administración', icon: SettingsIcon, roles: allowedRoles },
    { path: '/auditoria', label: 'Auditoría', icon: ShieldIcon, roles: allowedRoles },
  ],
  routes: [
    { path: '/reportes', roles: allowedRoles, element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Reportes /></Suspense> },
    { path: '/ubicaciones', roles: allowedRoles, element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Ubicaciones /></Suspense> },
    { path: '/administracion', roles: allowedRoles, element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Administracion /></Suspense> },
    { path: '/auditoria', roles: allowedRoles, element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Auditoria /></Suspense> },
  ],
}

export default administracionModule
