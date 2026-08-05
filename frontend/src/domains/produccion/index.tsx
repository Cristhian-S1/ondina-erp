import type { DomainModule } from '../../types/module'
import { FactoryIcon } from '../../components/icons'
import Produccion from './pages/Produccion'

const produccionModule: DomainModule = {
  name: 'produccion',
  nav: [
    {
      path: '/produccion',
      label: 'Producción',
      icon: FactoryIcon,
      roles: ['produccion', 'administrador'],
    },
  ],
  routes: [{ path: '/produccion', element: <Produccion /> }],
}

export default produccionModule
