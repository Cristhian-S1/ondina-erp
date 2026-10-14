import { useController } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import type { RegistrarVentaForm, RegistrarVentaFormInput } from '../schemas'
import type { ProductoVenta } from '../types'
import { btnDanger } from '../../../lib/ui'
import { formatMiles } from '../../../lib/format'
import CampoFormulario from './CampoFormulario'
import InputNumerico from '../../../components/InputNumerico'

export default function FilaProductoVenta({ control, index, productos, seleccionados, carga, onQuitar, puedeQuitar }: {
  control: Control<RegistrarVentaFormInput, unknown, RegistrarVentaForm>
  index: number
  productos: ProductoVenta[]
  seleccionados: string[]
  carga: Map<string, number>
  onQuitar: () => void
  puedeQuitar: boolean
}) {
  const producto = useController({ control, name: `detalles.${index}.productoId` })
  const cantidad = useController({ control, name: `detalles.${index}.cantidad` })
  const precio = useController({ control, name: `detalles.${index}.precioUnitario` })
  const productoElegido = productos.find(item => item.id === producto.field.value)
  const nombre = productoElegido?.nombre ?? `producto ${index + 1}`
  const disponible = carga.get(producto.field.value)
  const excede = disponible !== undefined && Number(cantidad.field.value) > disponible
  const subtotal = (Number(cantidad.field.value) || 0) * (Number(precio.field.value) || 0)
  // Tarjeta por línea bajo 1024 px (en 768 px la tabla de 6 columnas truncaba el producto); tabla desde lg.
  const celda = 'min-w-0 lg:px-3 lg:py-3'
  return <tr role="row" data-testid="linea-producto-venta" className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm lg:table-row lg:rounded-none lg:border-0 lg:border-b lg:border-slate-100 lg:p-0 lg:shadow-none">
    <td role="cell" aria-hidden="true" className="col-span-2 flex items-center gap-2 border-b border-slate-200 pb-3 lg:hidden">
      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">Línea {index + 1}</span>
      <span className="min-w-0 truncate text-base font-semibold text-slate-900">{productoElegido ? productoElegido.nombre : 'Sin producto seleccionado'}</span>
    </td>
    <td role="cell" className={`col-span-2 ${celda}`}>
      <CampoFormulario etiqueta={`Producto ${index + 1}`} error={producto.fieldState.error?.message}>
        {atributos => <select {...atributos} {...producto.field} onChange={event => {
          producto.field.onChange(event)
          const elegido = productos.find(item => item.id === event.target.value)
          if (elegido) precio.field.onChange(elegido.precio_base)
        }}>
          <option value="">Selecciona...</option>
          {productos.map(item => <option key={item.id} value={item.id} disabled={!carga.get(item.id) || seleccionados.some((id, i) => i !== index && id === item.id)}>{item.nombre}{!carga.get(item.id) ? ' (sin carga)' : ''} {item.tipo_empaque ? `(${item.tipo_empaque.nombre})` : ''}{seleccionados.some((id, i) => i !== index && id === item.id) ? ' (ya seleccionado)' : ''}</option>)}
        </select>}
      </CampoFormulario>
    </td>
    <td role="cell" className={`col-span-2 ${celda} text-sm`}><span className="mr-2 text-xs font-medium text-slate-600 lg:hidden">Disponible</span><span className={excede ? 'font-medium text-red-700' : 'text-slate-700'}>{formatMiles(disponible)}</span></td>
    <td role="cell" className={`col-span-2 sm:col-span-1 ${celda} lg:min-w-44`}>
      <CampoFormulario etiqueta={`Cantidad de ${nombre}`} error={cantidad.fieldState.error?.message ?? (excede ? 'Excede tu carga' : undefined)}>
        {atributos => <InputNumerico {...atributos} {...cantidad.field} value={Number(cantidad.field.value) || 0} onChange={valor => cantidad.field.onChange(valor ?? 0)} />}
      </CampoFormulario>
    </td>
    <td role="cell" className={`col-span-2 sm:col-span-1 ${celda}`}>
      <CampoFormulario etiqueta={`Precio unitario de ${nombre}`} error={precio.fieldState.error?.message}>
        {atributos => <InputNumerico {...atributos} {...precio.field} value={Number(precio.field.value) || 0} onChange={valor => precio.field.onChange(valor ?? 0)} conFlechas={false} />}
      </CampoFormulario>
    </td>
    <td role="cell" className={`col-span-2 flex items-baseline justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900 lg:table-cell lg:border-0 ${celda}`}><span className="text-xs font-medium text-slate-600 lg:hidden">Subtotal</span><span>$ {formatMiles(subtotal)}</span></td>
    <td role="cell" className={`col-span-2 ${celda} lg:text-right`}><button type="button" className={`${btnDanger} w-full lg:w-auto`} onClick={onQuitar} disabled={!puedeQuitar}>Quitar</button></td>
  </tr>
}
