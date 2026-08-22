import { z } from 'zod'

// --- HU-02: registrar cliente ---
export const tipoClienteEnum = z.enum(['mayorista', 'minorista', 'ocasional'])

export const crearClienteSchema = z.object({
  nombre: z.string().min(1, 'Ingresa el nombre').max(120, 'Máximo 120 caracteres'),
  direccion: z.string().min(1, 'Ingresa la dirección').max(200, 'Máximo 200 caracteres'),
  telefono: z
    .string()
    .max(30, 'Máximo 30 caracteres')
    .optional()
    .or(z.literal('')),
  numero_local: z
    .string()
    .max(50, 'Máximo 50 caracteres')
    .optional()
    .or(z.literal('')),
  tipo: tipoClienteEnum.default('minorista'),
  vendedor_id: z.string().min(1, 'Selecciona un vendedor'),
})

export type CrearClienteInput = z.infer<typeof crearClienteSchema>
export type CrearClienteForm = z.input<typeof crearClienteSchema>

// --- HU-07: registrar gasto extra ---
export const tipoGastoEnum = z.enum(['combustible', 'averia', 'otra'])

export const crearGastoSchema = z.object({
  tipo: tipoGastoEnum.default('otra'),
  monto: z.coerce.number('Ingresa un monto').positive('El monto debe ser mayor a 0'),
  motivo: z.string().min(1, 'Ingresa el motivo').max(300, 'Máximo 300 caracteres'),
})

export type CrearGastoInput = z.infer<typeof crearGastoSchema>
export type CrearGastoForm = z.input<typeof crearGastoSchema>

// --- HU-01: registrar venta ---
export const metodoPagoEnum = z.enum(['efectivo', 'transferencia'])

export const detalleVentaSchema = z.object({
  productoId: z.string().min(1, 'Selecciona un producto'),
  cantidad: z.coerce.number().int('Debe ser un entero').min(0, 'La cantidad no puede ser negativa'),
  precioUnitario: z.coerce.number().min(0, 'El precio no puede ser negativo'),
})

export const registrarVentaSchema = z.object({
  clienteId: z.string().min(1, 'Selecciona un cliente'),
  metodoPago: metodoPagoEnum,
  descuento: z.coerce.number().min(0, 'El descuento no puede ser negativo').default(0),
  observaciones: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  detalles: z.array(detalleVentaSchema).min(1, 'Agrega al menos un producto'),
})

export type RegistrarVentaForm = z.infer<typeof registrarVentaSchema>
export type RegistrarVentaFormInput = z.input<typeof registrarVentaSchema>