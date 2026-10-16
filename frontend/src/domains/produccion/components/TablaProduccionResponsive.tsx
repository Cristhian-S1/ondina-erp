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
  // Cantidad principal: en la tarjeta móvil va en la misma fila que el producto (destacada).
  cantidad?: boolean
}
interface Fila {
  id: string
  celdas: ReactNode[]
}

// Un único árbol: filas como tarjetas en móvil y tabla desde 640 px.
export default function TablaProduccionResponsive({ columnas, filas, resumenNumerico = false }: { columnas: Columna[]; filas: Fila[]; resumenNumerico?: boolean }) {
  // Tarjeta compacta: producto + cantidad en una fila; fecha y observaciones como metadato debajo.
  const compacta = columnas.some(columna => columna.cantidad) && columnas.some(columna => columna.destacada)
  return <div className="min-w-0 sm:overflow-x-auto">
    <table role="table" className="block w-full sm:table">
      <thead role="rowgroup" className="sr-only sm:not-sr-only sm:table-header-group">
        <tr role="row" className="bg-slate-50">{columnas.map(columna => <th role="columnheader" key={columna.titulo} scope="col" className={`${thCls} ${columna.numerica ? 'text-right' : ''}`}>{columna.titulo}</th>)}</tr>
      </thead>
      <tbody role="rowgroup" className="block space-y-3 bg-slate-50 p-3 sm:table-row-group sm:space-y-0 sm:divide-y sm:divide-slate-100 sm:bg-transparent sm:p-0">
        {filas.map(fila => <tr role="row" key={fila.id} data-testid="tarjeta-registro" className={`${compacta || resumenNumerico ? 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1' : 'flex flex-col gap-3'} min-w-0 rounded-xl border border-slate-300 bg-white p-4 shadow-sm sm:table-row sm:rounded-none sm:border-0 sm:p-0 sm:shadow-none`}>
          {fila.celdas.map((celda, index) => {
            const columna = columnas[index]
            const ordenMetrica = columnas.slice(0, index).filter(item => !item.destacada).length
            const ordenMetadato = columnas.slice(0, index).filter(item => !item.destacada && !item.cantidad).length
            const posicion = resumenNumerico && !columna.destacada
              ? { gridColumnStart: String(ordenMetrica % 2 + 1), gridRowStart: String(2 + Math.floor(ordenMetrica / 2)) }
              : compacta && !columna.destacada && !columna.cantidad ? { gridRowStart: String(2 + ordenMetadato) } : undefined
            const movil = resumenNumerico ? (columna.destacada ? 'col-span-2 row-start-1 text-base font-semibold text-slate-900 sm:text-sm sm:font-normal' : 'text-sm text-slate-600 sm:text-slate-900')
              : compacta && columna.destacada ? 'col-start-1 row-start-1 text-base font-semibold text-slate-900 sm:text-sm sm:font-normal'
              : compacta && columna.cantidad ? 'col-start-2 row-start-1 text-right text-base font-semibold text-slate-900 sm:text-sm'
              : compacta && columna.insignia ? 'col-span-2 !text-xs !text-slate-600 sm:!text-sm sm:!text-slate-900'
              : compacta ? 'col-span-2 !text-xs !text-slate-600 sm:!text-sm sm:!text-slate-900 [&>span:last-child]:line-clamp-2 sm:[&>span:last-child]:line-clamp-none'
              : columna.destacada ? 'order-2 text-base font-semibold text-slate-900 sm:text-sm sm:font-normal'
              : columna.insignia ? 'order-1 self-start rounded-full bg-brand-50 !px-2.5 !py-1 text-xs font-semibold text-brand-800 sm:self-auto sm:rounded-none sm:bg-transparent sm:text-sm sm:font-normal sm:text-slate-900'
              : 'order-3'
            return <td role="cell" key={columna.titulo} style={posicion} className={`${tdCls} !block !whitespace-normal [overflow-wrap:anywhere] !p-0 sm:!table-cell sm:!px-5 sm:!py-3 sm:order-none ${movil} ${columna.numerica ? 'font-semibold sm:text-right' : ''} ${columna.sinSalto ? 'sm:!whitespace-nowrap' : ''}`}>
              <span aria-hidden="true" className={`${columna.destacada || columna.cantidad || (!compacta && columna.insignia) ? 'sr-only' : resumenNumerico || compacta ? 'mr-1 inline text-xs font-medium text-slate-600' : 'mb-1 block text-xs font-medium text-slate-600'} sm:hidden`}>{columna.titulo}</span>
              {compacta && !columna.destacada && !columna.cantidad && !columna.insignia ? <span>{celda}</span> : celda}
            </td>
          })}
        </tr>)}
      </tbody>
    </table>
  </div>
}
