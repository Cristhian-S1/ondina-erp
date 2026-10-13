import { lazy, Suspense } from 'react'
import type { DomainModule } from '../../types/module'
import {
  ClipboardListIcon,
  DollarIcon,
  DropletIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '../../components/icons'

const pages = {
  Clientes: lazy(() => import('./pages/Clientes')),
  Ventas: lazy(() => import('./pages/Ventas')),
  RegistrarVenta: lazy(() => import('./pages/RegistrarVenta')),
  Gastos: lazy(() => import('./pages/Gastos')),
  Carga: lazy(() => import('./pages/Carga')),
  RankingVendedores: lazy(() => import('./pages/RankingVendedores')),
  MiComision: lazy(() => import('./pages/MiComision')),
}

const ventasModule: DomainModule = {
  name: 'ventas',
  nav: [
    {
      path: '/ventas',
      label: 'Resumen',
      icon: ClipboardListIcon,
      roles: ['vendedor', 'administrador'],
    },
    {
      path: '/ventas/registrar',
      label: 'Registrar venta',
      icon: ShoppingCartIcon,
      roles: ['vendedor', 'administrador'],
    },
    {
      path: '/clientes',
      label: 'Clientes',
      icon: UsersIcon,
      roles: ['vendedor', 'administrador'],
    },
    {
      path: '/carga',
      label: 'Mi carga',
      icon: DropletIcon,
      roles: ['vendedor', 'administrador'],
    },
    {
      path: '/gastos',
      label: 'Gastos',
      icon: DollarIcon,
      roles: ['vendedor', 'administrador'],
    },
    {
      path: '/mi-comision',
      label: 'Mi comisión',
      icon: DollarIcon,
      roles: ['vendedor'],
    },
    {
      path: '/ranking-vendedores',
      label: 'Ranking vendedores',
      icon: ShoppingCartIcon,
      roles: ['vendedor', 'administrador'],
    },
  ],

  routes: [
    { path: '/ventas', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Ventas /></Suspense> },
    { path: '/ventas/registrar', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.RegistrarVenta /></Suspense> },
    { path: '/clientes', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Clientes /></Suspense> },
    { path: '/carga', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Carga /></Suspense> },
    { path: '/gastos', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.Gastos /></Suspense> },
    { path: '/mi-comision', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.MiComision /></Suspense> },
    { path: '/ranking-vendedores', element: <Suspense fallback={<p role="status">Cargando página...</p>}><pages.RankingVendedores /></Suspense> },
  ],
}

export default ventasModule
