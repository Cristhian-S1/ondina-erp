export const labelCls = 'block text-sm font-medium text-slate-700'

export const inputCls =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 focus:outline-none'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60'

export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'

export const cardCls = 'rounded-2xl border border-slate-200 bg-white shadow-sm'

export const thCls =
  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'

export const tdCls = 'px-4 py-3 text-sm text-slate-900'

export function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
