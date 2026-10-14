import { lazy, Suspense } from 'react'
import type { Role } from '../../types'
import type { DomainModule } from '../../types/module'
import EstadoVista from '../../components/EstadoVista'
import {
  ClipboardListIcon,
  DollarIcon,
  DropletIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '../../components/icons'

const allowedRoles: Role[] = ['vendedor', 'administrador']
const commissionRoles: Role[] = ['vendedor']

const fallback = <EstadoVista variante="cargando" mensaje="Cargando página..." />

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
      roles: allowedRoles,
    },
    {
      path: '/ventas/registrar',
      label: 'Registrar venta',
      icon: ShoppingCartIcon,
      roles: allowedRoles,
    },
    {
      path: '/clientes',
      label: 'Clientes',
      icon: UsersIcon,
      roles: allowedRoles,
    },
    {
      path: '/carga',
      label: 'Mi carga',
      icon: DropletIcon,
      roles: allowedRoles,
    },
    {
      path: '/gastos',
      label: 'Gastos',
      icon: DollarIcon,
      roles: allowedRoles,
    },
    {
      path: '/mi-comision',
      label: 'Mi comisión',
      icon: DollarIcon,
      roles: commissionRoles,
    },
    {
      path: '/ranking-vendedores',
      label: 'Ranking vendedores',
      icon: ShoppingCartIcon,
      roles: allowedRoles,
    },
  ],

  routes: [
    { path: '/ventas', roles: allowedRoles, element: <Suspense fallback={fallback}><pages.Ventas /></Suspense> },
    { path: '/ventas/registrar', roles: allowedRoles, element: <Suspense fallback={fallback}><pages.RegistrarVenta /></Suspense> },
    { path: '/clientes', roles: allowedRoles, element: <Suspense fallback={fallback}><pages.Clientes /></Suspense> },
    { path: '/carga', roles: allowedRoles, element: <Suspense fallback={fallback}><pages.Carga /></Suspense> },
    { path: '/gastos', roles: allowedRoles, element: <Suspense fallback={fallback}><pages.Gastos /></Suspense> },
    { path: '/mi-comision', roles: commissionRoles, element: <Suspense fallback={fallback}><pages.MiComision /></Suspense> },
    { path: '/ranking-vendedores', roles: allowedRoles, element: <Suspense fallback={fallback}><pages.RankingVendedores /></Suspense> },
  ],
}

export default ventasModule
