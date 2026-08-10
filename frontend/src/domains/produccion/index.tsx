import type { DomainModule } from '../../types/module'
import { Navigate } from 'react-router-dom'
import { AlertIcon, BarChartIcon, BoxIcon, FactoryIcon, ShieldIcon } from '../../components/icons'
import Produccion from './pages/Produccion'

const produccionModule: DomainModule = {
  name: 'produccion',
  nav: [
    { path: '/produccion/registrar', label: 'Registrar producción', icon: FactoryIcon, roles: ['produccion', 'administrador'] },
    { path: '/produccion/envases', label: 'Envases vacíos', icon: BoxIcon, roles: ['produccion', 'administrador'] },
    { path: '/produccion/historial', label: 'Historial', icon: ShieldIcon, roles: ['produccion', 'administrador'] },
    { path: '/produccion/indicadores', label: 'Indicadores', icon: BarChartIcon, roles: ['produccion', 'administrador'] },
    { path: '/produccion/incidencias', label: 'Incidencias', icon: AlertIcon, roles: ['produccion', 'administrador'] },
  ],
  routes: [
    { path: '/produccion', element: <Navigate to="/produccion/registrar" replace /> },
    { path: '/produccion/registrar', element: <Produccion /> },
    { path: '/produccion/envases', element: <Produccion /> },
    { path: '/produccion/historial', element: <Produccion /> },
    { path: '/produccion/indicadores', element: <Produccion /> },
    { path: '/produccion/incidencias', element: <Produccion /> },
  ],
}

export default produccionModule
