import { useController } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import type { RegistrarVentaForm, RegistrarVentaFormInput } from '../schemas'
import type { ProductoVenta } from '../types'
import { btnDangerOutline } from '../../../lib/ui'
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
  // Tarjeta por línea mientras el contenedor de productos mida menos de 56rem (ancho disponible, no el del
  // viewport: con el menú lateral a 1024 px la tabla sólo dispone de ~740 px); tabla desde @4xl.
  const celda = 'min-w-0 @4xl:px-3 @4xl:py-3'
  // Cantidad y Precio comparten fila entre 400 y 639 px: etiquetas de exactamente dos líneas para que los inputs
  // queden a la misma altura aunque una etiqueta se envuelva. Bajo 400 px se apilan a todo el ancho (9.999.999 cabe).
  const etiquetaPareja = 'min-[400px]:max-sm:[&_label]:line-clamp-2 min-[400px]:max-sm:[&_label]:h-10'
  return <tr role="row" data-testid="linea-producto-venta" className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-3 rounded-xl border border-slate-300 bg-white p-3 shadow-sm sm:p-4 @4xl:table-row @4xl:rounded-none @4xl:border-0 @4xl:border-b @4xl:border-slate-100 @4xl:p-0 @4xl:shadow-none">
    <td role="cell" aria-hidden="true" className="order-[-2] flex min-w-0 grow basis-0 items-center gap-2 self-center @4xl:hidden">
      <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">Línea {index + 1}</span>
      <span className="min-w-0 truncate text-base font-semibold text-slate-900">{productoElegido ? productoElegido.nombre : 'Sin producto seleccionado'}</span>
    </td>
    <td role="cell" className={`basis-full border-t border-slate-200 pt-3 @4xl:border-0 @4xl:pt-3 ${celda}`}>
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
    <td role="cell" className={`order-[-1] flex shrink-0 flex-col items-end self-center @4xl:order-none text-xs leading-tight @4xl:table-cell @4xl:self-auto @4xl:text-sm ${celda}`}><span className="text-slate-600 @4xl:hidden">Disponible</span><span className={`text-sm font-semibold @4xl:font-normal ${excede ? 'text-red-700' : 'text-slate-900 @4xl:text-slate-700'}`}>{formatMiles(disponible)}</span></td>
    <td role="cell" className={`basis-full min-[400px]:basis-[calc(60%-0.375rem)] sm:basis-[calc(50%-0.375rem)] ${etiquetaPareja} ${celda} @4xl:min-w-44`}>
      <CampoFormulario etiqueta={`Cantidad de ${nombre}`} error={cantidad.fieldState.error?.message ?? (excede ? 'Excede tu carga' : undefined)}>
        {atributos => <InputNumerico {...atributos} {...cantidad.field} value={Number(cantidad.field.value) || 0} onChange={valor => cantidad.field.onChange(valor ?? 0)} />}
      </CampoFormulario>
    </td>
    <td role="cell" className={`grow basis-full min-[400px]:basis-[calc(40%-0.375rem)] sm:basis-[calc(50%-0.375rem)] ${etiquetaPareja} ${celda}`}>
      <CampoFormulario etiqueta={`Precio unitario de ${nombre}`} error={precio.fieldState.error?.message}>
        {atributos => <InputNumerico {...atributos} {...precio.field} value={Number(precio.field.value) || 0} onChange={valor => precio.field.onChange(valor ?? 0)} conFlechas={false} />}
      </CampoFormulario>
    </td>
    <td role="cell" className={`flex min-w-0 grow basis-0 flex-col self-center text-sm font-semibold text-slate-900 @4xl:table-cell ${celda}`}><span className="text-xs font-medium text-slate-600 @4xl:hidden">Subtotal</span><span>$ {formatMiles(subtotal)}</span></td>
    <td role="cell" className={`shrink-0 self-end ${celda} @4xl:text-right`}><button type="button" className={`${btnDangerOutline} @4xl:w-auto`} onClick={onQuitar} disabled={!puedeQuitar}>Quitar</button></td>
  </tr>
}
