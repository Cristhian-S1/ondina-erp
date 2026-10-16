import { useId } from 'react'
import type { ReactNode } from 'react'
import { BidonIcon, HieloIcon } from '../../../components/icons'

type Tono = 'producto' | 'envase'

// Cada sección de la devolución lleva su propio color, icono y conteo para distinguir a simple vista
// "Productos del despacho" (ámbar, cubos de hielo) de "Envases" (verde, bidón).
const TONOS: Record<Tono, { caja: string; encabezado: string; icono: string }> = {
  producto: {
    caja: 'border-amber-300',
    encabezado: 'border-amber-300 bg-amber-50 text-amber-900',
    icono: 'bg-amber-200 text-amber-900',
  },
  envase: {
    caja: 'border-emerald-300',
    encabezado: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    icono: 'bg-emerald-200 text-emerald-900',
  },
}

export default function SeccionDevolucion({ tono, titulo, lineas, yaDevueltos = false, children }: {
  tono: Tono
  titulo: string
  lineas: number
  yaDevueltos?: boolean
  children: ReactNode
}) {
  const tituloId = useId()
  const estilo = TONOS[tono]
  const Icono = tono === 'producto' ? HieloIcon : BidonIcon
  return (
    <section aria-labelledby={tituloId} data-tono={tono} className={`@container min-w-0 overflow-hidden rounded-xl border-2 bg-white ${estilo.caja}`}>
      <header className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 px-3 py-3 ${estilo.encabezado}`}>
        <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${estilo.icono}`}>
          <Icono className="h-5 w-5" />
        </span>
        <h3 id={tituloId} className="min-w-0 flex-1 text-base font-bold">{titulo}</h3>
        <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-1 pl-12 @lg:basis-auto @lg:pl-0">
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-800">
            {lineas} {lineas === 1 ? 'línea' : 'líneas'}
          </span>
          {yaDevueltos && <span className="text-xs font-semibold text-emerald-800">Ya devueltos</span>}
        </div>
      </header>
      {children}
    </section>
  )
}
