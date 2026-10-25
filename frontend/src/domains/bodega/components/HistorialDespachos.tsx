import { fmtFechaHora, formatMiles } from '../../../lib/format'
import EstadoVista from '../../../components/EstadoVista'
import DetalleDespacho from './DetalleDespacho'
import type { PaginaDespachos, RecursosDespacho } from './despachos.types'

function AvatarNombre({ nombre }: { nombre?: string }) {
  const iniciales = nombre
    ? nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase()
    : '?'

  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
      {iniciales}
    </span>
  )
}

function fmtHora(iso: string) {
  return fmtFechaHora(iso).split(' ')[1]
}

interface Props {
  pagina: PaginaDespachos | undefined
  productos: RecursosDespacho['productos']
  tiposEmpaque: RecursosDespacho['tiposEmpaque']
  despachoExpandido: string | null
  setDespachoExpandido: (valor: string | null) => void
  onDevolucion: () => void
  ventanasAjuste: Record<string, string>
  onAgregarProductos: (despachoId: string) => void
}

export default function HistorialDespachos({ pagina, productos, tiposEmpaque, despachoExpandido, setDespachoExpandido, onDevolucion, ventanasAjuste, onAgregarProductos }: Props) {
  const { despachos: despachosFiltrados = [], despachoDetalles = [], despachoEnvases = [], desvProducto = [], desvEnvase = [] } = pagina ?? {}
  const detallesDeDespacho = (despachoId: string) =>
    despachoDetalles.filter((d) => d.despacho_id === despachoId)

  const envasesDeDespacho = (despachoId: string) =>
    despachoEnvases.filter((e) => e.despacho_id === despachoId)

  const devolucionesDe = (despachoId: string) => ({
    productos: desvProducto.filter((x) => x.despacho_id === despachoId),
    envases: desvEnvase.filter((x) => x.despacho_id === despachoId),
  })

  const horaLlegadaDe = (despachoId: string) => {
    const fechas = [
      ...desvProducto.filter((x) => x.despacho_id === despachoId).map((x) => x.creado_en),
      ...desvEnvase.filter((x) => x.despacho_id === despachoId).map((x) => x.creado_en),
    ]
    return fechas.length > 0 ? fechas.sort().reverse()[0] : null
  }

  return (
    <>
      {despachosFiltrados.length === 0 ? (
        <div role="status"><EstadoVista variante="vacio" mensaje="No hay despachos para el día y vendedor seleccionados." /></div>
      ) : (
        <ul className="space-y-2 p-3">
          {despachosFiltrados.map((d) => {
            const expandido = despachoExpandido === d.id
            const detalles = detallesDeDespacho(d.id)
            const devs = devolucionesDe(d.id)
            const llegada = horaLlegadaDe(d.id)
            return (
              <li
                key={d.id}
                className={`rounded-xl border transition ${
                  expandido
                    ? 'border-brand-200 bg-brand-50/40'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <button
                  type="button"
                  aria-expanded={expandido}
                  aria-controls={`despacho-${d.id}`}
                  onClick={() => setDespachoExpandido(expandido ? null : d.id)}
                  className="flex min-w-0 w-full flex-col items-start gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <AvatarNombre nombre={d.vendedorDisponible ? d.vendedorNombre : undefined} />
                    <div className="min-w-0">
                      <p className={`${d.vendedorDisponible ? 'truncate' : 'break-words'} text-sm font-semibold text-slate-900`}>
                        {d.vendedorNombre}
                      </p>
                      <p className="text-xs text-slate-600">{fmtFechaHora(d.creado_en)} · Despacho #{d.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
                    <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
                      {formatMiles(d.totalUnidades)} unid.
                    </span>
                    {llegada && (
                      <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white">
                        Llegada {fmtHora(llegada)}
                      </span>
                    )}
                    <span
                      className={`text-slate-600 transition-transform ${
                        expandido ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    >
                      ▼
                    </span>
                  </div>
                </button>

                {expandido && (
                  <DetalleDespacho d={d} detalles={detalles} envases={envasesDeDespacho(d.id)}
                    devs={devs} llegada={llegada} productos={productos} tiposEmpaque={tiposEmpaque} onDevolucion={onDevolucion}
                    ventanaExpiraEn={ventanasAjuste[d.id]} onAgregarProductos={() => onAgregarProductos(d.id)} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
