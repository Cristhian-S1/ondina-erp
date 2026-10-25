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

// Límite de integer en Postgres: la RPC recibe p_cantidad integer.
const MAX_CANTIDAD_MERMA = 2_147_483_647

const cantidadMermaSchema = cantidadAjusteSchema.pipe(z.number().max(MAX_CANTIDAD_MERMA, 'La cantidad es demasiado grande.'))

// HU-29: las ids sin elegir llegan como cadena vacía desde los <select>. Las reglas repiten las de la RPC
// (producto XOR envase; el origen despacho es solo de producto); la base sigue siendo la autoridad.
export const mermaSchema = z.object({
  origen: z.enum(['bodega', 'despacho'], 'Selecciona el origen de la merma.'),
  despacho_id: z.string(),
  producto_id: z.string(),
  tipo_empaque_id: z.string(),
  cantidad: cantidadMermaSchema,
  motivo: z.string().trim().min(1, 'Indica el motivo de la merma.'),
}).superRefine((merma, ctx) => {
  if (merma.origen === 'despacho') {
    if (!merma.despacho_id) ctx.addIssue({ code: 'custom', path: ['despacho_id'], message: 'Selecciona un despacho del día.' })
    if (merma.tipo_empaque_id) {
      ctx.addIssue({ code: 'custom', path: ['tipo_empaque_id'],
        message: 'Registra los envases dañados del despacho como devolución en estado malo.' })
    } else if (!merma.producto_id) {
      ctx.addIssue({ code: 'custom', path: ['producto_id'], message: 'Selecciona un producto del despacho.' })
    }
    return
  }
  if (merma.despacho_id) ctx.addIssue({ code: 'custom', path: ['despacho_id'], message: 'La merma de bodega no lleva despacho.' })
  if (merma.producto_id && merma.tipo_empaque_id) {
    ctx.addIssue({ code: 'custom', path: ['tipo_empaque_id'], message: 'Indica solo un producto o un tipo de envase.' })
  } else if (!merma.producto_id && !merma.tipo_empaque_id) {
    ctx.addIssue({ code: 'custom', path: ['producto_id'], message: 'Selecciona un producto o un tipo de envase.' })
  }
}).transform(merma => ({
  origen: merma.origen,
  despacho_id: merma.despacho_id || null,
  producto_id: merma.producto_id || null,
  tipo_empaque_id: merma.tipo_empaque_id || null,
  cantidad: merma.cantidad,
  motivo: merma.motivo,
}))

export type MermaInput = z.input<typeof mermaSchema>
export type MermaValidada = z.output<typeof mermaSchema>

export const anulacionMermaSchema = z.object({
  motivo: z.string().trim().min(1, 'Indica el motivo de la anulación.'),
})

export const MAX_DIAS_CUADRE = 31

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica una fecha válida.').refine(valor => {
  const fecha = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
}, 'Indica una fecha válida.')

const MS_DIA = 86_400_000

// `hoy` es la jornada de Santiago (YYYY-MM-DD); la base rechaza igualmente rangos futuros o de más de 31 días.
export function rangoCuadreSchema(hoy: string) {
  return z.object({ desde: fechaIso, hasta: fechaIso }).superRefine((rango, ctx) => {
    if (rango.hasta < rango.desde) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial.' })
      return
    }
    if (rango.hasta > hoy) ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'No se pueden consultar fechas futuras.' })
    const dias = (Date.parse(`${rango.hasta}T00:00:00Z`) - Date.parse(`${rango.desde}T00:00:00Z`)) / MS_DIA + 1
    if (dias > MAX_DIAS_CUADRE) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: `El rango no puede superar ${MAX_DIAS_CUADRE} días.` })
    }
  })
}
