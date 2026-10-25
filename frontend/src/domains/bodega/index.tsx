import { lazy, Suspense } from 'react'
import type { Role } from '../../types'
import type { DomainModule } from '../../types/module'
import { AlertIcon, BarChartIcon, BoxIcon, RecycleIcon, TruckIcon } from '../../components/icons'

import EstadoVista from '../../components/EstadoVista'

const allowedRoles: Role[] = ['bodega', 'administrador']

const pages = {
  Despachos: lazy(() => import('./pages/Despachos')),
  Devoluciones: lazy(() => import('./pages/Devoluciones')),
  Stock: lazy(() => import('./pages/Stock')),
  Mermas: lazy(() => import('./pages/Mermas')),
  CuadreDiario: lazy(() => import('./pages/CuadreDiario')),
}

const bodegaModule: DomainModule = {
  name: 'bodega',
  nav: [
    {
      path: '/despachos',
      label: 'Despachos',
      icon: TruckIcon,
      roles: allowedRoles,
    },
    {
      path: '/devoluciones',
      label: 'Devoluciones',
      icon: RecycleIcon,
      roles: allowedRoles,
    },
    { path: '/stock', label: 'Stock', icon: BoxIcon, roles: allowedRoles },
    { path: '/mermas', label: 'Mermas', icon: AlertIcon, roles: allowedRoles },
    { path: '/cuadre-diario', label: 'Cuadre diario', icon: BarChartIcon, roles: allowedRoles },
  ],
  routes: [
    { path: '/despachos', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando página..." />}><pages.Despachos /></Suspense> },
    { path: '/devoluciones', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando página..." />}><pages.Devoluciones /></Suspense> },
    { path: '/stock', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando página..." />}><pages.Stock /></Suspense> },
    { path: '/mermas', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando página..." />}><pages.Mermas /></Suspense> },
    { path: '/cuadre-diario', roles: allowedRoles, element: <Suspense fallback={<EstadoVista variante="cargando" mensaje="Cargando página..." />}><pages.CuadreDiario /></Suspense> },
  ],
}

export default bodegaModule
