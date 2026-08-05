import type { DomainModule } from '../types/module'
import ventasModule from './ventas'
import bodegaModule from './bodega'
import produccionModule from './produccion'
import administracionModule from './administracion'
export const domains: DomainModule[] = [
  ventasModule,
  bodegaModule,
  produccionModule,
  administracionModule,
]
