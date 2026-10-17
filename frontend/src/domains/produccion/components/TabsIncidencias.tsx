import { Children, useId, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

const consultaMovil = '(max-width: 639px)'
function suscribir(cambio: () => void) {
  const media = window.matchMedia?.(consultaMovil)
  media?.addEventListener('change', cambio)
  return () => media?.removeEventListener('change', cambio)
}
function esMovil() { return window.matchMedia?.(consultaMovil).matches ?? false }
const etiquetas = ['Incidencias', 'Mermas']

// Keep both drafts mounted; only the selected mobile panel is exposed.
export default function TabsIncidencias({ children }: { children: ReactNode }) {
  const movil = useSyncExternalStore(suscribir, esMovil, () => false)
  const [activo, setActivo] = useState(0)
  const id = useId()
  function seleccionar(indice: number, enfocar = false) {
    setActivo(indice)
    if (enfocar) document.getElementById(`${id}-tab-${indice}`)?.focus()
  }
  return <div className="min-w-0 space-y-6">
    {movil && <div role="tablist" aria-label="Tipo de registro" className="grid grid-cols-2 gap-2">
      {etiquetas.map((etiqueta, indice) => <button type="button" key={etiqueta} role="tab" id={`${id}-tab-${indice}`} aria-controls={`${id}-panel-${indice}`} aria-selected={activo === indice} tabIndex={activo === indice ? 0 : -1}
        className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-600 ${activo === indice ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`}
        onClick={() => seleccionar(indice)} onKeyDown={event => {
          const siguiente = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - indice : undefined
          if (siguiente !== undefined) { event.preventDefault(); seleccionar(siguiente, true) }
        }}>{etiqueta}</button>)}
    </div>}
    {Children.toArray(children).map((panel, indice) => <div key={indice} id={`${id}-panel-${indice}`} role={movil ? 'tabpanel' : undefined} aria-labelledby={movil ? `${id}-tab-${indice}` : undefined} tabIndex={movil ? 0 : undefined} hidden={movil && activo !== indice}>{panel}</div>)}
  </div>
}
