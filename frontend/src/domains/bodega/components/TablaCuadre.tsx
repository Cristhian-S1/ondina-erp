import { fmtFecha, formatMiles } from '../../../lib/format'
import { thCls } from '../../../lib/ui'
import type { FilaCuadre } from '../types'
import { etiquetaVendedorHistorial } from '../vendedores'
import type { RecursosDespacho } from './despachos.types'
import { celdaAnchaCls, celdaCls, celdaNumeroCls, etiquetaMovilCls, filaCls, tablaCls, tbodyCls, theadCls } from './tablaResponsiva'

// Los valores de comparación solo se muestran cuando la base los entrega (comparacion_disponible); jamás se
// derivan en el navegador. `carga_actual` es la carga de hoy, no una foto de un día pasado.
function Comparacion({ fila }: { fila: FilaCuadre }) {
  if (!fila.comparacion_disponible) {
    return <span className="text-slate-600">Comparación no disponible</span>
  }
  const dato = (etiqueta: string, valor: number | null) => (
    <span className="block">{etiqueta}: <b>{valor === null ? '—' : formatMiles(valor)}</b></span>
  )
  return <>
    {dato('Saldo inicial', fila.saldo_inicial)}
    {dato('Carga actual (hoy)', fila.carga_actual)}
    {dato('Diferencia', fila.diferencia_carga)}
  </>
}

export default function TablaCuadre({ filas, recursos }: { filas: FilaCuadre[]; recursos: RecursosDespacho }) {
  const vendedor = (id: string) => {
    const v = recursos.vendedoresHistorial.find(x => x.id === id)
    return v ? etiquetaVendedorHistorial(v) : `Vendedor no disponible · ref. ${id.slice(0, 8)}`
  }
  const producto = (id: string) => recursos.productos.find(p => p.id === id)?.nombre ?? 'Producto no disponible'
  return (
    <div className="sm:overflow-x-auto">
      <table role="table" className={tablaCls} aria-label="Cuadre diario por vendedor y producto">
        <thead role="rowgroup" className={theadCls}>
          <tr role="row" className="border-b border-slate-100 bg-slate-50">
            <th role="columnheader" scope="col" className={thCls}>Fecha</th>
            <th role="columnheader" scope="col" className={thCls}>Vendedor</th>
            <th role="columnheader" scope="col" className={thCls}>Producto</th>
            <th role="columnheader" scope="col" className={`${thCls} text-right`}>Despachado</th>
            <th role="columnheader" scope="col" className={`${thCls} text-right`}>Vendido</th>
            <th role="columnheader" scope="col" className={`${thCls} text-right`}>Devuelto</th>
            <th role="columnheader" scope="col" className={`${thCls} text-right`}>Mermas</th>
            <th role="columnheader" scope="col" className={`${thCls} text-right`}>Saldo de movimientos del día</th>
            <th role="columnheader" scope="col" className={thCls}>Comparación de carga</th>
          </tr>
        </thead>
        <tbody role="rowgroup" className={tbodyCls}>
          {filas.map(f => (
            <tr role="row" key={`${f.fecha}:${f.vendedor_id}:${f.producto_id}`} className={filaCls}>
              <td role="cell" className={celdaCls}><span className={etiquetaMovilCls}>Fecha</span>{fmtFecha(f.fecha)}</td>
              <td role="cell" className={celdaCls}><span className={etiquetaMovilCls}>Vendedor</span>{vendedor(f.vendedor_id)}</td>
              <td role="cell" className={celdaAnchaCls}><span className={etiquetaMovilCls}>Producto</span><span className="font-semibold sm:font-normal">{producto(f.producto_id)}</span></td>
              <td role="cell" className={celdaNumeroCls}><span className={etiquetaMovilCls}>Despachado</span>{formatMiles(f.despachado)}</td>
              <td role="cell" className={celdaNumeroCls}><span className={etiquetaMovilCls}>Vendido</span>{formatMiles(f.vendido)}</td>
              <td role="cell" className={celdaNumeroCls}><span className={etiquetaMovilCls}>Devuelto</span>{formatMiles(f.devuelto)}</td>
              <td role="cell" className={celdaNumeroCls}><span className={etiquetaMovilCls}>Mermas</span>{formatMiles(f.mermas)}</td>
              <td role="cell" className={celdaNumeroCls}><span className={etiquetaMovilCls}>Saldo de movimientos del día</span><b>{formatMiles(f.esperado_en_carga)}</b></td>
              <td role="cell" className={celdaAnchaCls}><span className={etiquetaMovilCls}>Comparación de carga</span><Comparacion fila={f} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
