import { fmtFechaHora, formatMiles } from '../../../lib/format'
import { btnDangerOutline, thCls } from '../../../lib/ui'
import type { Perfil } from '../../../types'
import type { Merma } from '../types'
import { nombreItemMerma } from '../mermas'
import { etiquetaVendedorHistorial } from '../vendedores'
import type { RecursosDespacho } from './despachos.types'
import { celdaAnchaCls, celdaCls, celdaNumeroCls, etiquetaMovilCls, filaCls, tablaCls, tbodyCls, theadCls } from './tablaResponsiva'

interface Props {
  filas: Merma[]
  recursos: RecursosDespacho
  perfil: Perfil
  puedeAnular: boolean
  ocupado: boolean
  onAnular: (merma: Merma) => void
}

// La base solo expone el UUID del actor; se nombra al usuario actual y a los vendedores de la plantilla histórica.
function nombreActor(id: string, perfil: Perfil, recursos: RecursosDespacho): string {
  if (id === perfil.id) return `${perfil.nombres} ${perfil.apellidos} (tú)`
  const vendedor = recursos.vendedoresHistorial.find(v => v.id === id)
  return vendedor ? etiquetaVendedorHistorial(vendedor) : `Usuario ref. ${id.slice(0, 8)}`
}

export default function ListaMermas({ filas, recursos, perfil, puedeAnular, ocupado, onAnular }: Props) {
  return (
    <div className="sm:overflow-x-auto">
      <table role="table" className={tablaCls} aria-label="Mermas de la sucursal">
        <thead role="rowgroup" className={theadCls}>
          <tr role="row" className="border-b border-slate-100 bg-slate-50">
            <th role="columnheader" scope="col" className={thCls}>Fecha</th>
            <th role="columnheader" scope="col" className={thCls}>Origen</th>
            <th role="columnheader" scope="col" className={thCls}>Ítem</th>
            <th role="columnheader" scope="col" className={`${thCls} text-right`}>Cantidad</th>
            <th role="columnheader" scope="col" className={thCls}>Motivo</th>
            <th role="columnheader" scope="col" className={thCls}>Registrado por</th>
            <th role="columnheader" scope="col" className={thCls}>Estado</th>
            {puedeAnular && <th role="columnheader" scope="col" className={thCls}>Acción</th>}
          </tr>
        </thead>
        <tbody role="rowgroup" className={tbodyCls}>
          {filas.map(m => (
            <tr role="row" key={m.id} className={`${filaCls} ${m.anulado ? 'bg-slate-50 text-slate-600' : ''}`}>
              <td role="cell" className={celdaCls}><span className={etiquetaMovilCls}>Fecha</span>{fmtFechaHora(m.creado_en)}</td>
              <td role="cell" className={celdaCls}><span className={etiquetaMovilCls}>Origen</span>
                {m.despacho_id ? `Despacho #${m.despacho_id.slice(0, 8)}` : 'Bodega'}</td>
              <td role="cell" className={celdaAnchaCls}><span className={etiquetaMovilCls}>Ítem</span>{nombreItemMerma(m, recursos)}</td>
              <td role="cell" className={celdaNumeroCls}><span className={etiquetaMovilCls}>Cantidad</span>{formatMiles(m.cantidad)}</td>
              <td role="cell" className={celdaAnchaCls}><span className={etiquetaMovilCls}>Motivo</span>{m.motivo}</td>
              <td role="cell" className={celdaCls}><span className={etiquetaMovilCls}>Registrado por</span>{nombreActor(m.creado_por, perfil, recursos)}</td>
              <td role="cell" className={celdaCls}><span className={etiquetaMovilCls}>Estado</span>
                {m.anulado
                  ? <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800">Anulada</span>
                  : <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Activa</span>}
              </td>
              {puedeAnular && (
                <td role="cell" className={celdaAnchaCls}>
                  {!m.anulado && <button type="button" className={`${btnDangerOutline} w-full sm:w-auto`} disabled={ocupado}
                    aria-label={`Anular merma de ${nombreItemMerma(m, recursos)} del ${fmtFechaHora(m.creado_en)}`}
                    onClick={() => onAnular(m)}>Anular</button>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
