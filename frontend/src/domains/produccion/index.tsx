import EstadoVista from '../../components/EstadoVista'
import { lazy, Suspense } from 'react'
import type { Role } from '../../types'
import type { DomainModule } from '../../types/module'
import { Navigate } from 'react-router-dom'
import { AlertIcon, BarChartIcon, BoxIcon, FactoryIcon, ShieldIcon } from '../../components/icons'

const allowedRoles: Role[] = ['produccion', 'administrador']

const pages = {
  Produccion: lazy(() => import('./pages/Produccion')),
}

const produccionModule: DomainModule = {
  name: 'produccion',
  nav: [
    { path: '/produccion/registrar', label: 'Registrar producción', icon: FactoryIcon, roles: allowedRoles },
    { path: '/produccion/envases', label: 'Envases vacíos', icon: BoxIcon, roles: allowedRoles },
    { path: '/produccion/historial', label: 'Historial', icon: ShieldIcon, roles: allowedRoles },
    { path: '/produccion/indicadores', label: 'Indicadores', icon: BarChartIcon, roles: allowedRoles },
    { path: '/produccion/incidencias', label: 'Incidencias', icon: AlertIcon, roles: allowedRoles },
  ],
  routes: [
    { path: '/produccion', roles: allowedRoles, element: <Navigate to="/produccion/registrar" replace /> },
    { path: '/produccion/registrar', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando producción..." />}><pages.Produccion /></Suspense> },
    { path: '/produccion/envases', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando producción..." />}><pages.Produccion /></Suspense> },
    { path: '/produccion/historial', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando producción..." />}><pages.Produccion /></Suspense> },
    { path: '/produccion/indicadores', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando producción..." />}><pages.Produccion /></Suspense> },
    { path: '/produccion/incidencias', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando producción..." />}><pages.Produccion /></Suspense> },
  ],
}

export default produccionModule
