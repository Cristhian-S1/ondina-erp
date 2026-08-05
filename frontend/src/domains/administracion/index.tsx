import type { DomainModule } from '../../types/module'
import { BarChartIcon, MapPinIcon, SettingsIcon, ShieldIcon } from '../../components/icons'
import Reportes from './pages/Reportes'
import Ubicaciones from './pages/Ubicaciones'
import Administracion from './pages/Administracion'
import Auditoria from './pages/Auditoria'

const administracionModule: DomainModule = {
  name: 'administracion',
  nav: [
    { path: '/reportes', label: 'Reportes', icon: BarChartIcon, roles: ['administrador'] },
    { path: '/ubicaciones', label: 'Geolocalización', icon: MapPinIcon, roles: ['administrador'] },
    { path: '/administracion', label: 'Administración', icon: SettingsIcon, roles: ['administrador'] },
    { path: '/auditoria', label: 'Auditoría', icon: ShieldIcon, roles: ['administrador'] },
  ],
  routes: [
    { path: '/reportes', element: <Reportes /> },
    { path: '/ubicaciones', element: <Ubicaciones /> },
    { path: '/administracion', element: <Administracion /> },
    { path: '/auditoria', element: <Auditoria /> },
  ],
}

export default administracionModule
