import { describe, expect, it } from 'vitest'
import { mensajeErrorAutenticacion, mensajeErrorSupabase } from './errors'

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
    ['La venta está anulada', 'La venta está anulada.'],
    ['La merma supera lo despachado pendiente de ese producto.', 'La merma supera lo despachado pendiente de ese producto.'],
    ['La devolución y las mermas superan lo despachado de ese producto.', 'La devolución más las mermas activas superan lo despachado de ese producto. Revisa las mermas registradas.'],
    ['Indica el motivo de la merma.', 'Indica el motivo de la merma.'],
    ['Registra los envases dañados del despacho como devolución en estado malo.', 'Registra los envases dañados del despacho como devolución en estado malo.'],
  ])('traduce P0001: %s', (message, esperado) => {
    expect(mensajeErrorSupabase({ code: 'P0001', message })).toBe(esperado)
    expect(mensajeErrorSupabase(new Error(esperado))).toBe(esperado)
  })

  it('no reconoce texto de negocio incrustado en errores técnicos', () => {
    expect(mensajeErrorSupabase({ code: 'PGRST202', message: 'La venta debe incluir al menos un detalle' })).toBe(generico)
    expect(mensajeErrorSupabase({ code: 'P0001', message: 'private SQL detail: La venta debe incluir al menos un detalle' })).toBe(generico)
  })
})

describe('B2/B3 · safe business rejections', () => {
  it.each([
    'El despacho solo admite envases de uso interno.',
    'Stock o carga insuficiente para completar la operación.',
    'No se puede reactivar un movimiento anulado.',
    'No se puede devolver más de lo despachado.',
    'La ventana de ajuste del despacho expiró.',
    'No tienes permisos para crear despachos en esta sucursal.',
    'El usuario de la operación no coincide con la sesión.',
    'El formato de las líneas no es válido.',
    'No tienes permisos para registrar ventas.',
    'El descuento debe ser un número finito.',
    'El precio unitario debe ser un número finito.',
    'El vendedor no existe o está desactivado.',
    'La clave de reintento pertenece a otra operación.',
    'Indica el motivo de la corrección.',
    'No tienes permisos para registrar devoluciones.',
    'No se puede modificar una regla de comisión histórica.',
    'Una regla nueva no puede cambiar comisiones de ventas anteriores.',
    'Línea de producto inválida en la devolución.',
    'Línea de envase inválida en la devolución.',
    'Selecciona una sucursal para registrar la incidencia.',
    'La merma supera lo despachado pendiente de ese producto.',
  ])('allows the exact reviewed Spanish rejection: %s', message => {
    expect(mensajeErrorSupabase({ code: 'P0001', message })).toBe(message)
    expect(mensajeErrorSupabase({ code: 'P0001', message: message + ' private SQL detail' })).toBe(generico)
  })
})

describe('B6 · errores de autenticación', () => {
  it.each([
    [{ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }, 'Correo o contraseña incorrectos.'],
    [{ message: 'Invalid login credentials' }, 'Correo o contraseña incorrectos.'],
    [{ code: 'over_request_rate_limit', status: 429, message: 'Request rate limit reached' }, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
    [{ code: 'over_email_send_rate_limit', status: 429, message: 'Email rate limit exceeded' }, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
    [{ status: 429, message: 'Too many requests' }, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
  ])('traduce %j a un texto fijo en español', (error, esperado) => {
    expect(mensajeErrorAutenticacion(error)).toBe(esperado)
  })

  it.each([
    null, 'Email not confirmed', new TypeError('Failed to fetch'), { code: 'unexpected_failure', status: 500, message: 'Database error' },
  ])('oculta cualquier otro error de autenticación: %j', (error) => {
    expect(mensajeErrorAutenticacion(error)).toBe('No fue posible iniciar sesión. Inténtalo de nuevo.')
  })
})
