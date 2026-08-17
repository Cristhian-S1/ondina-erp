import type { DomainModule } from '../../types/module'
import { BoxIcon, RecycleIcon, TruckIcon } from '../../components/icons'
import Despachos from './pages/Despachos'
import Devoluciones from './pages/Devoluciones'
import Stock from './pages/Stock'

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
    { path: '/despachos', element: <Despachos /> },
    { path: '/devoluciones', element: <Devoluciones /> },
    { path: '/stock', element: <Stock /> },
  ],
}

export default bodegaModule
