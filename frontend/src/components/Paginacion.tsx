import { btnSecondary } from '../lib/ui'
import { TAMANO_PAGINA, totalPaginas } from '../lib/paginacion'

export interface PaginacionProps {
  pagina: number
  total: number
  tamanoPagina?: number
  onCambiar: (pagina: number) => void
  cargando?: boolean
  etiqueta?: string
}

export default function Paginacion({ pagina, total, tamanoPagina = TAMANO_PAGINA, onCambiar,
  cargando = false, etiqueta = 'Paginación' }: PaginacionProps) {
  const paginas = totalPaginas(total, tamanoPagina)
  return (
    <nav aria-label={etiqueta} aria-busy={cargando} className="flex min-w-0 flex-wrap items-center justify-center gap-2 border-t border-slate-100 p-3">
      <p role="status" aria-live="polite" aria-atomic="true" className="w-full text-center text-sm text-slate-600">
        {cargando ? 'Actualizando… ' : ''}Página {pagina} de {paginas} · {total} registros
      </p>
      <button type="button" aria-label="Página anterior" className={`${btnSecondary} min-w-11`} disabled={cargando || pagina <= 1 || total === 0} onClick={() => onCambiar(pagina - 1)}>Anterior</button>
      <button type="button" aria-label="Página siguiente" className={`${btnSecondary} min-w-11`} disabled={cargando || pagina >= paginas || total === 0} onClick={() => onCambiar(pagina + 1)}>Siguiente</button>
    </nav>
  )
}
