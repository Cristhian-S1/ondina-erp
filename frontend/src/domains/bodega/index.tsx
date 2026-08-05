import type { DomainModule } from '../../types/module'
import { BoxIcon, TruckIcon } from '../../components/icons'
import Despachos from './pages/Despachos'
import Stock from './pages/Stock'

const bodegaModule: DomainModule = {
  name: 'bodega',
  nav: [
    {
      path: '/despachos',
      label: 'Despachos',
      icon: TruckIcon,
      roles: ['vendedor', 'bodega', 'administrador'],
    },
    { path: '/stock', label: 'Stock', icon: BoxIcon, roles: ['bodega', 'administrador'] },
  ],
  routes: [
    { path: '/despachos', element: <Despachos /> },
    { path: '/stock', element: <Stock /> },
  ],
}

export default bodegaModule
