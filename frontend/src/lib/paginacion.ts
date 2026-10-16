export const TAMANO_PAGINA = 20

export interface Pagina<T> {
  filas: T[]
  total: number
}

function enteroPositivo(valor: number) {
  return Number.isFinite(valor) ? Math.max(1, Math.floor(valor)) : 1
}

export function rangoPagina(pagina: number, tamanoPagina = TAMANO_PAGINA): [number, number] {
  const tamano = enteroPositivo(tamanoPagina)
  const desde = (enteroPositivo(pagina) - 1) * tamano
  return [desde, desde + tamano - 1]
}

export function totalPaginas(total: number, tamanoPagina = TAMANO_PAGINA) {
  return Math.max(1, Math.ceil(Math.max(0, total) / enteroPositivo(tamanoPagina)))
}
