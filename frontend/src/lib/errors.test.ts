import { describe, expect, it } from 'vitest'
import { mensajeErrorSupabase } from './errors'

const generico = 'No fue posible completar la operación. Inténtalo de nuevo.'

describe('REV-4 · catálogo de errores públicos', () => {
  it.each([
    null, undefined, 'private SQL detail', 42,
    { code: 'PGRST202', message: 'Could not find public.registrar_venta in the schema cache' },
    { code: 'P0001', message: 'relation public.private_table does not exist' },
    { code: 'XX000', message: 'constraint private_check failed' },
    { code: 'constructor', message: 'private SQL detail' },
    { code: 'toString', message: 'private SQL detail' },
    { code: 'P0001', message: 42 },
    new TypeError('Failed to fetch: private endpoint'),
  ])('oculta errores desconocidos: %j', (error) => {
    expect(mensajeErrorSupabase(error)).toBe(generico)
  })

  it.each([
    ['23505', 'Ya existe un registro con los mismos datos.'],
    ['23514', 'Alguno de los datos no cumple las reglas del negocio.'],
    ['23503', 'La operación hace referencia a un registro que no existe.'],
    ['42501', 'No tienes permisos para realizar esta acción.'],
    ['22P02', 'El dato enviado no tiene el formato esperado.'],
    ['22001', 'El dato enviado supera el largo máximo permitido.'],
    ['22003', 'El número enviado está fuera del rango permitido.'],
  ])('traduce %s sin revelar nombres de restricciones', (code, esperado) => {
    expect(mensajeErrorSupabase({ code, message: 'constraint public.private_check' })).toBe(esperado)
  })

  it.each([
    ['Cliente inexistente o fuera de su cartera/sucursal', 'El cliente no pertenece a tu cartera o sucursal.'],
    ['Método de pago inválido (efectivo o transferencia)', 'El método de pago no es válido.'],
    ['La venta debe incluir al menos un detalle', 'Debes agregar al menos un producto a la venta.'],
    ['El vendedor no tiene carga del producto private-id', 'No tienes carga suficiente de uno de los productos.'],
    ['Carga insuficiente del vendedor para el producto private-id', 'No tienes carga suficiente de uno de los productos.'],
    ['Stock insuficiente de envases para el tipo private-id', 'No hay stock suficiente de envases.'],
    ['Stock insuficiente en bodega para el producto private-id', 'No hay stock suficiente en bodega para uno de los productos.'],
    ['Carga insuficiente del vendedor para devolver el producto private-id', 'No tienes carga suficiente para devolver uno de los productos.'],
    ['No hay envases vacíos suficientes. Disponibles: 2', 'No hay envases vacíos suficientes.'],
    ['Cantidad de merma superior al stock disponible. Disponible: 2', 'La cantidad de merma supera el stock disponible.'],
    ['Cantidad de merma superior a la carga disponible. Disponible: 2', 'La cantidad de merma supera la carga disponible.'],
    ['Cantidad de merma superior a los envases disponibles. Disponibles: 2', 'La cantidad de merma supera los envases disponibles.'],
    ['La ventana de ajuste expiró (15 minutos). Solo el administrador puede corregir el despacho.', 'La ventana de ajuste expiró. Solo administración puede corregir el despacho.'],
    ['No se puede devolver más de lo despachado del producto private-id', 'No se puede devolver más de lo despachado de un producto.'],
    ['El producto no existe o está desactivado', 'El producto no existe o está desactivado.'],
    ['Stock insuficiente', 'No hay stock suficiente.'],
  ])('traduce P0001: %s', (message, esperado) => {
    expect(mensajeErrorSupabase({ code: 'P0001', message })).toBe(esperado)
    expect(mensajeErrorSupabase(new Error(esperado))).toBe(esperado)
  })

  it('no reconoce texto de negocio incrustado en errores técnicos', () => {
    expect(mensajeErrorSupabase({ code: 'PGRST202', message: 'La venta debe incluir al menos un detalle' })).toBe(generico)
    expect(mensajeErrorSupabase({ code: 'P0001', message: 'private SQL detail: La venta debe incluir al menos un detalle' })).toBe(generico)
  })
})
