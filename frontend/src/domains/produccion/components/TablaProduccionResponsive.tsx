import type { ReactNode } from 'react'
import { tdCls, thCls } from '../../../lib/ui'

interface Columna {
  titulo: string
  numerica?: boolean
  sinSalto?: boolean
  // Título de la tarjeta móvil (sin etiqueta, texto grande).
  destacada?: boolean
  // Etiqueta destacada (fecha/hora o estado) mostrada como insignia en la tarjeta móvil.
  insignia?: boolean
}
interface Fila {
  id: string
  celdas: ReactNode[]
}

// Un único árbol: filas como tarjetas en móvil y tabla desde 640 px.
export default function TablaProduccionResponsive({ columnas, filas }: { columnas: Columna[]; filas: Fila[] }) {
  return <div className="min-w-0 sm:overflow-x-auto">
    <table role="table" className="block w-full sm:table">
      <thead role="rowgroup" className="sr-only sm:not-sr-only sm:table-header-group">
        <tr role="row" className="bg-slate-50">{columnas.map(columna => <th role="columnheader" key={columna.titulo} scope="col" className={`${thCls} ${columna.numerica ? 'text-right' : ''}`}>{columna.titulo}</th>)}</tr>
      </thead>
      <tbody role="rowgroup" className="block space-y-3 bg-slate-50 p-3 sm:table-row-group sm:space-y-0 sm:divide-y sm:divide-slate-100 sm:bg-transparent sm:p-0">
        {filas.map(fila => <tr role="row" key={fila.id} data-testid="tarjeta-registro" className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm sm:table-row sm:rounded-none sm:border-0 sm:p-0 sm:shadow-none">
          {fila.celdas.map((celda, index) => {
            const columna = columnas[index]
            const movil = columna.destacada ? 'order-2 text-base font-semibold text-slate-900 sm:text-sm sm:font-normal'
              : columna.insignia ? 'order-1 self-start rounded-full bg-brand-50 !px-2.5 !py-1 text-xs font-semibold text-brand-800 sm:self-auto sm:rounded-none sm:bg-transparent sm:text-sm sm:font-normal sm:text-slate-900'
              : 'order-3'
            return <td role="cell" key={columna.titulo} className={`${tdCls} !block !whitespace-normal [overflow-wrap:anywhere] !p-0 sm:!table-cell sm:!px-5 sm:!py-3 sm:order-none ${movil} ${columna.numerica ? 'font-semibold sm:text-right' : ''} ${columna.sinSalto ? 'sm:!whitespace-nowrap' : ''}`}>
              <span aria-hidden="true" className={`${columna.destacada || columna.insignia ? 'sr-only' : 'mb-1 block text-xs font-medium text-slate-600'} sm:hidden`}>{columna.titulo}</span>
              {celda}
            </td>
          })}
        </tr>)}
      </tbody>
    </table>
  </div>
}
