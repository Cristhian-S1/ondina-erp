// Tabla que pasa a tarjetas bajo 640 px con un único árbol DOM (docs/engineering/frontend.md).
export const tablaCls = 'block w-full sm:table'
export const theadCls = 'sr-only sm:not-sr-only sm:table-header-group'
export const tbodyCls = 'block space-y-2 p-3 sm:table-row-group sm:space-y-0 sm:divide-y sm:divide-slate-100 sm:p-0'
export const filaCls = 'grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:table-row sm:rounded-none sm:border-0 sm:px-0 sm:py-0'
export const celdaCls = 'block min-w-0 break-words text-sm text-slate-900 sm:table-cell sm:px-4 sm:py-3'
export const celdaAnchaCls = `${celdaCls} col-span-2`
export const celdaNumeroCls = `${celdaCls} sm:text-right sm:tabular-nums`
export const etiquetaMovilCls = 'block text-xs font-medium text-slate-600 sm:hidden'
