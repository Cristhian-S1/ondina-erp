import { lazy, Suspense } from 'react'
import type { DomainModule } from '../../types/module'
import { BoxIcon, RecycleIcon, TruckIcon } from '../../components/icons'

const pages = {
  Despachos: lazy(() => import('./pages/Despachos')),
  Devoluciones: lazy(() => import('./pages/Devoluciones')),
  Stock: lazy(() => import('./pages/Stock')),
}

const bodegaModule: DomainModule = {
  name: 'bodega',
  nav: [
    {
      path: '/despachos',
      label: 'Despachos',
      icon: TruckIcon,
      roles: ['bodega', 'administrador'],
    },
    {
      path: '/devoluciones',
      label: 'Devoluciones',
      icon: RecycleIcon,
      roles: ['bodega', 'administrador'],
    },
    { path: '/stock', label: 'Stock', icon: BoxIcon, roles: ['bodega', 'administrador'] },
  ],
  routes: [
    { path: '/despachos', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Despachos /></Suspense> },
    { path: '/devoluciones', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Devoluciones /></Suspense> },
    { path: '/stock', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Stock /></Suspense> },
  ],
}

export default bodegaModule
