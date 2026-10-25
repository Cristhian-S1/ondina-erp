import { z } from 'zod'
import { parseMiles } from '../../lib/format'

/** Saldo de producto; una corrección reemplaza las devoluciones previas completas. */
export function disponibleParaDevolver(despachado: number, devuelto: number, esCorreccion: boolean): number {
  return Math.max(0, despachado - devuelto + (esCorreccion ? devuelto : 0))
}

// HU-26: el ajuste solo suma productos. La cantidad llega como texto es-CL desde el formulario
// o como número; ambos terminan en un entero positivo (la base repite estas reglas).
const cantidadAjusteSchema = z.union([z.string(), z.number()])
  .transform(valor => (typeof valor === 'string' ? parseMiles(valor) : valor))
  .pipe(z.number('Ingresa una cantidad.')
    .int('La cantidad debe ser un número entero.')
    .positive('Ingresa una cantidad mayor que cero.'))

export const ajusteDespachoSchema = z.object({
  lineas: z.array(z.object({
    producto_id: z.string().min(1, 'Selecciona un producto.'),
    cantidad: cantidadAjusteSchema,
  })).min(1, 'Agrega al menos un producto al despacho.'),
}).superRefine((ajuste, ctx) => {
  const vistos = new Set<string>()
  ajuste.lineas.forEach((linea, indice) => {
    if (linea.producto_id && vistos.has(linea.producto_id)) {
      ctx.addIssue({ code: 'custom', path: ['lineas', indice, 'producto_id'], message: 'No repitas productos en el ajuste.' })
    }
    vistos.add(linea.producto_id)
  })
})

export type AjusteDespachoInput = z.input<typeof ajusteDespachoSchema>
export type AjusteDespachoValidado = z.output<typeof ajusteDespachoSchema>
