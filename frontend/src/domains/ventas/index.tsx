import type { DomainModule } from '../../types/module'
import {
  ClipboardListIcon,
  DollarIcon,
  DropletIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '../../components/icons'
import Clientes from './pages/Clientes'
import Ventas from './pages/Ventas'
import RegistrarVenta from './pages/RegistrarVenta'
import Gastos from './pages/Gastos'
import Carga from './pages/Carga'

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
    { path: '/gastos', label: 'Gastos', icon: DollarIcon, roles: ['vendedor', 'administrador'] },
  ],
  routes: [
    { path: '/ventas', element: <Ventas /> },
    { path: '/ventas/registrar', element: <RegistrarVenta /> },
    { path: '/clientes', element: <Clientes /> },
    { path: '/carga', element: <Carga /> },
    { path: '/gastos', element: <Gastos /> },
  ],
}

export default ventasModule