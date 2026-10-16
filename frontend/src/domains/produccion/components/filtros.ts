export interface ValoresFiltros {
  productoId: string
  desde: string
  hasta: string
}
export const filtrosVacios: ValoresFiltros = { productoId: '', desde: '', hasta: '' }
export const rangoInvertido = ({ desde, hasta }: ValoresFiltros) => !!desde && !!hasta && desde > hasta
export const hayFiltros = (valores: ValoresFiltros) => !!(valores.productoId || valores.desde || valores.hasta)

