import type { ReactNode } from 'react'
import { tdCls, thCls } from '../../../lib/ui'

interface Columna {
  titulo: string
  numerica?: boolean
  sinSalto?: boolean
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
      <tbody role="rowgroup" className="block divide-y divide-slate-100 sm:table-row-group">
        {filas.map(fila => <tr role="row" key={fila.id} className="block min-w-0 space-y-3 p-5 sm:table-row sm:space-y-0 sm:p-0">
          {fila.celdas.map((celda, index) => <td role="cell" key={columnas[index].titulo} className={`${tdCls} !block !whitespace-normal [overflow-wrap:anywhere] !p-0 sm:!table-cell sm:!px-5 sm:!py-3 ${columnas[index].numerica ? 'font-semibold sm:text-right' : ''} ${columnas[index].sinSalto ? 'sm:!whitespace-nowrap' : ''}`}>
            <span aria-hidden="true" className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">{columnas[index].titulo}</span>
            {celda}
          </td>)}
        </tr>)}
      </tbody>
    </table>
  </div>
}
