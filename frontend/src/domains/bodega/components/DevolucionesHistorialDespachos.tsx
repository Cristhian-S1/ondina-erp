import { cardCls } from '../../../lib/ui'
import { fmtFechaHora, formatMiles } from '../../../lib/format'
import EstadoVista from '../../../components/EstadoVista'
import type { PaginaDespachos, RecursosDespacho } from './despachos.types'

interface GrupoDevolucion {
  despachoId: string
  vendedor: string
  fecha: string
  lineas: {
    id: string
    tipo: 'producto' | 'envase'
    descripcion: string
    cantidad: number
  }[]
}

interface Props {
  pagina: PaginaDespachos | undefined
  productos: RecursosDespacho['productos']
  tiposEmpaque: RecursosDespacho['tiposEmpaque']
}

export default function DevolucionesHistorialDespachos({ pagina, productos, tiposEmpaque }: Props) {
  const { despachos = [], desvProducto = [], desvEnvase = [] } = pagina ?? {}
  const despachosFiltrados = despachos
  const gruposDevolucion: GrupoDevolucion[] = (() => {
    const idsVisibles = new Set(despachosFiltrados.map((d) => d.id))
    const grupos = new Map<string, GrupoDevolucion>()
    const asegurar = (despachoId: string) => {
      let grupo = grupos.get(despachoId)
      if (!grupo) {
        const d = despachos.find((x) => x.id === despachoId)
        grupo = {
          despachoId,
          vendedor: d?.vendedorNombre ?? 'Vendedor no disponible',
          fecha: d?.creado_en ?? '',
          lineas: [],
        }
        grupos.set(despachoId, grupo)
      }
      return grupo
    }
    for (const dv of desvProducto) {
      if (!idsVisibles.has(dv.despacho_id)) continue
      const p = productos.find((x) => x.id === dv.producto_id)
      asegurar(dv.despacho_id).lineas.push({
        id: `dp-${dv.id}`,
        tipo: 'producto',
        descripcion: p?.nombre ?? 'Producto',
        cantidad: dv.cantidad,
      })
    }
    for (const de of desvEnvase) {
      if (!idsVisibles.has(de.despacho_id)) continue
      const t = tiposEmpaque.find((x) => x.id === de.tipo_empaque_id)
      asegurar(de.despacho_id).lineas.push({
        id: `de-${de.id}`,
        tipo: 'envase',
        descripcion: `${t?.nombre ?? 'Envase'} (${de.estado})`,
        cantidad: de.cantidad,
      })
    }
    return [...grupos.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  })()

  return (
    <aside className={`${cardCls} min-w-0`}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Devoluciones de esta página</h2>
        <p className="text-sm text-slate-600">Agrupadas por despacho</p>
      </div>

      {gruposDevolucion.length === 0 ? (
        <div role="status"><EstadoVista variante="vacio" mensaje="No hay devoluciones en los despachos de esta página." /></div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {gruposDevolucion.map((g) => (
            <li key={g.despachoId} className="px-4 py-3">
              <div className="flex min-w-0 flex-col items-start gap-1">
                <p className="max-w-full truncate text-sm font-semibold text-slate-900">{g.vendedor}</p>
                <span className="text-xs text-slate-600">{fmtFechaHora(g.fecha)} · Despacho #{g.despachoId.slice(0, 8)}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {g.lineas.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-slate-700">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          l.tipo === 'producto' ? 'bg-amber-600' : 'bg-emerald-600'
                        }`}
                      />
                      <span className="truncate">{l.descripcion}</span>
                    </span>
                    <span
                      className={`shrink-0 font-medium ${
                        l.tipo === 'producto' ? 'text-amber-800' : 'text-emerald-700'
                      }`}
                    >
                      {l.tipo === 'producto' ? `−${formatMiles(l.cantidad)}` : `+${formatMiles(l.cantidad)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
