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
  const nombre = productos.find(item => item.id === producto.field.value)?.nombre ?? `producto ${index + 1}`
  const disponible = carga.get(producto.field.value)
  const excede = disponible !== undefined && Number(cantidad.field.value) > disponible
  const subtotal = (Number(cantidad.field.value) || 0) * (Number(precio.field.value) || 0)
  const celda = 'min-w-0 sm:px-3 sm:py-3'
  return <tr role="row" className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-b border-slate-100 p-4 sm:table-row sm:p-0">
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
    <td role="cell" className={`col-span-2 ${celda} text-sm`}><span className="mr-2 text-xs text-slate-500 sm:hidden">Disponible</span><span className={excede ? 'text-red-600' : 'text-slate-700'}>{formatMiles(disponible)}</span></td>
    <td role="cell" className={`${celda} sm:min-w-44`}>
      <CampoFormulario etiqueta={`Cantidad de ${nombre}`} error={cantidad.fieldState.error?.message ?? (excede ? 'Excede tu carga' : undefined)}>
        {atributos => <InputNumerico {...atributos} {...cantidad.field} value={Number(cantidad.field.value) || 0} onChange={valor => cantidad.field.onChange(valor ?? 0)} />}
      </CampoFormulario>
    </td>
    <td role="cell" className={celda}>
      <CampoFormulario etiqueta={`Precio unitario de ${nombre}`} error={precio.fieldState.error?.message}>
        {atributos => <InputNumerico {...atributos} {...precio.field} value={Number(precio.field.value) || 0} onChange={valor => precio.field.onChange(valor ?? 0)} conFlechas={false} />}
      </CampoFormulario>
    </td>
    <td role="cell" className={`${celda} text-sm font-semibold`}><span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">Subtotal</span>$ {formatMiles(subtotal)}</td>
    <td role="cell" className={`${celda} text-right`}><button type="button" className={btnDanger} onClick={onQuitar} disabled={!puedeQuitar}>Quitar</button></td>
  </tr>
}
