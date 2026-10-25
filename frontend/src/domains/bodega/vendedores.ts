import type { VendedorHistorial } from './api'

export function etiquetaVendedorHistorial(v: Pick<VendedorHistorial, 'nombres' | 'apellidos' | 'activo'>): string {
  return `${v.nombres} ${v.apellidos}${v.activo ? '' : ' (inactivo)'}`
}
