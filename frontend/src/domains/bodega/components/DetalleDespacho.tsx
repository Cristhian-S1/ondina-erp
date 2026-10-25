import { btnSecondary } from '../../../lib/ui'
import { fmtFecha, fmtFechaHora, formatMiles } from '../../../lib/format'
import AccionAjusteDespacho from './AccionAjusteDespacho'
import type { PaginaDespachos, RecursosDespacho } from './despachos.types'

interface Props {
  d: PaginaDespachos['despachos'][number]
  detalles: PaginaDespachos['despachoDetalles']
  envases: PaginaDespachos['despachoEnvases']
  devs: { productos: PaginaDespachos['desvProducto']; envases: PaginaDespachos['desvEnvase'] }
  llegada: string | null
  productos: RecursosDespacho['productos']
  tiposEmpaque: RecursosDespacho['tiposEmpaque']
  onDevolucion: () => void
  // HU-26: expiración devuelta por la RPC tras un ajuste, si la hay.
  ventanaExpiraEn?: string
  onAgregarProductos: () => void
}

export default function DetalleDespacho({ d, detalles, envases, devs, llegada, productos, tiposEmpaque, onDevolucion, ventanaExpiraEn, onAgregarProductos }: Props) {
  return (
    <div id={`despacho-${d.id}`} className="space-y-3 border-t border-slate-100 px-4 py-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Productos despachados
        </p>
        {detalles.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">Sin detalles registrados.</p>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {detalles.map((det) => (
              <li
                key={det.id}
                className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0"
              >
                <span className="text-slate-700">
                  {productos.find((p) => p.id === det.producto_id)?.nombre ??
                    'Producto'}
                  {det.es_ajuste && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Ajuste · {fmtFechaHora(det.creado_en)}
                    </span>
                  )}
                </span>
                <span className="font-semibold text-slate-900">
                  {formatMiles(det.cantidad)}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatMiles(d.totalUnidades)}</span>
            </li>
          </ul>
        )}
      </div>

      {envases.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Envases despachados
          </p>
          <ul className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {envases.map((env) => (
              <li
                key={env.id}
                className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0"
              >
                <span className="text-slate-700">
                  {tiposEmpaque.find((t) => t.id === env.tipo_empaque_id)?.nombre ??
                    'Envase'}
                </span>
                <span className="font-semibold text-slate-900">
                  {formatMiles(env.cantidad)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(devs.productos.length > 0 || devs.envases.length > 0) && (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Devoluciones
            </p>
            {llegada && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Llegada · {fmtFecha(llegada)}
              </span>
            )}
          </div>
          <ul className="mt-2 space-y-1">
            {devs.productos.map((dv) => (
              <li
                key={dv.id}
                className="flex items-center justify-between text-sm text-slate-700"
              >
                <span>
                  {productos.find((p) => p.id === dv.producto_id)?.nombre ??
                    'Producto'}
                </span>
                <span className="font-medium text-amber-800">−{formatMiles(dv.cantidad)}</span>
              </li>
            ))}
            {devs.envases.map((de) => (
              <li
                key={de.id}
                className="flex items-center justify-between text-sm text-slate-700"
              >
                <span>
                  {tiposEmpaque.find((t) => t.id === de.tipo_empaque_id)?.nombre ??
                    'Envase'}
                </span>
                <span
                  className={
                    de.estado === 'bueno'
                      ? 'font-medium text-emerald-700'
                      : 'font-medium text-amber-800'
                  }
                >
                  +{formatMiles(de.cantidad)} {de.estado === 'bueno' ? 'buenas' : 'malas'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!d.anulado && (
        <AccionAjusteDespacho creadoEn={d.creado_en} expiraEn={ventanaExpiraEn} onAgregar={onAgregarProductos} />
      )}

      <button
        type="button"
        className={btnSecondary}
        onClick={onDevolucion}
      >
        Registrar devolución
      </button>
    </div>
  )
}
