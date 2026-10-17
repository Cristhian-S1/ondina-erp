/** Saldo de producto; una corrección reemplaza las devoluciones previas completas. */
export function disponibleParaDevolver(despachado: number, devuelto: number, esCorreccion: boolean): number {
  return Math.max(0, despachado - devuelto + (esCorreccion ? devuelto : 0))
}
