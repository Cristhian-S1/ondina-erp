import { useWatch } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import type { RegistrarVentaForm, RegistrarVentaFormInput } from '../schemas'
import { btnPrimary, cardCls } from '../../../lib/ui'
import { formatMiles } from '../../../lib/format'
import { ShoppingCartIcon } from '../../../components/icons'

export default function ResumenFormularioVenta({ control, pendiente, bloqueado, motivoId }: {
  control: Control<RegistrarVentaFormInput, unknown, RegistrarVentaForm>
  pendiente: boolean
  bloqueado: boolean
  motivoId?: string
}) {
  const [detalles, descuento] = useWatch({ control, name: ['detalles', 'descuento'] })
  const subtotal = (detalles ?? []).reduce((sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0), 0)
  const total = Math.max(0, subtotal - (Number(descuento) || 0))
  return <section className={cardCls}>
    <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">4 · Resumen</h2>
    <div className="space-y-4 p-5">
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-6"><dt>Subtotal</dt><dd>$ {formatMiles(subtotal)}</dd></div>
        <div className="flex justify-between gap-6"><dt>Descuento</dt><dd>−$ {formatMiles(Number(descuento) || 0)}</dd></div>
        <div className="hidden justify-between gap-6 border-t border-slate-100 pt-1 font-semibold sm:flex"><dt>Total a cobrar</dt><dd>$ {formatMiles(total)}</dd></div>
      </dl>
      {total === 0 && detalles?.some(item => Number(item.cantidad) > 0) && <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">El total de la venta es $0. Revisa los precios y el descuento; se pedirá una confirmación adicional antes de registrarla.</p>}
      <p className="text-xs text-slate-600">Revisa cliente, cantidades y pago antes de confirmar.</p>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg sm:static sm:justify-end sm:border-0 sm:p-0 sm:shadow-none">
        <div className="min-w-0 text-sm sm:hidden"><p>Total a cobrar</p><p className="font-bold">$ {formatMiles(total)}</p></div>
        <button type="submit" className={btnPrimary} disabled={pendiente || bloqueado} aria-describedby={motivoId}>
          <ShoppingCartIcon className="h-4 w-4" />{pendiente ? 'Registrando venta...' : 'Confirmar venta'}
        </button>
      </div>
    </div>
  </section>
}
