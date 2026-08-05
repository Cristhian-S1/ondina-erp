import type { DomainModule } from '../../types/module'
import { AlertIcon, ShoppingCartIcon, UsersIcon } from '../../components/icons'
import Clientes from './pages/Clientes'
import Ventas from './pages/Ventas'
import Gastos from './pages/Gastos'

const ventasModule: DomainModule = {
  name: 'ventas',
  nav: [
    {
      path: '/clientes',
      label: 'Clientes',
      icon: UsersIcon,
      roles: ['vendedor', 'administrador'],
    },
    {
      path: '/ventas',
      label: 'Ventas',
      icon: ShoppingCartIcon,
      roles: ['vendedor', 'administrador'],
    },
    { path: '/gastos', label: 'Gastos', icon: AlertIcon, roles: ['vendedor', 'administrador'] },
  ],
  routes: [
    { path: '/clientes', element: <Clientes /> },
    { path: '/ventas', element: <Ventas /> },
    { path: '/gastos', element: <Gastos /> },
  ],
}

export default ventasModule
