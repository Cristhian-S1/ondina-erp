import type { Merma } from './types'
import type { RecursosDespacho } from './components/despachos.types'

export function nombreItemMerma(merma: Merma, recursos: RecursosDespacho): string {
  if (merma.producto_id) {
    const producto = recursos.productos.find(p => p.id === merma.producto_id)
    return producto?.nombre ?? 'Producto no disponible'
  }
  const envase = recursos.tiposEmpaque.find(t => t.id === merma.tipo_empaque_id)
  return `${envase?.nombre ?? 'Envase no disponible'} (envase vacío)`
}
