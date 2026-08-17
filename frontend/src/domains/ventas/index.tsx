import type { DomainModule } from '../../types/module'
import {
  ClipboardListIcon,
  DollarIcon,
  DropletIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '../../components/icons'
import { Navigate } from 'react-router-dom'
import Clientes from './pages/Clientes'
import Ventas from './pages/Ventas'
import Gastos from './pages/Gastos'
import Carga from './pages/Carga'
import RankingVendedores from './pages/RankingVendedores'
import MiComision from './pages/MiComision'

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
    { path: '/ventas', element: <Ventas /> },
    { path: '/ventas/registrar', element: <Navigate to="/ventas" replace /> },
    { path: '/clientes', element: <Clientes /> },
    { path: '/carga', element: <Carga /> },
    { path: '/gastos', element: <Gastos /> },
    { path: '/mi-comision', element: <MiComision /> },
    { path: '/ranking-vendedores', element: <RankingVendedores /> },
  ],
}

export default ventasModule