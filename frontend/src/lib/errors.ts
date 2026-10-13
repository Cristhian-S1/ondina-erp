const mensajeGenerico = 'No fue posible completar la operación. Inténtalo de nuevo.'

const mensajesPorCodigo = new Map<string, string>([
  ['23505', 'Ya existe un registro con los mismos datos.'],
  ['23514', 'Alguno de los datos no cumple las reglas del negocio.'],
  ['23503', 'La operación hace referencia a un registro que no existe.'],
  ['42501', 'No tienes permisos para realizar esta acción.'],
  ['22P02', 'El dato enviado no tiene el formato esperado.'],
  ['22001', 'El dato enviado supera el largo máximo permitido.'],
  ['22003', 'El número enviado está fuera del rango permitido.'],
])

const mensajesDeNegocio = new Map<string, string>([
  ['El despacho solo admite envases de uso interno.', 'El despacho solo admite envases de uso interno.'],
  ['La ventana de ajuste del despacho expiró.', 'La ventana de ajuste del despacho expiró.'],
  ['No tienes permisos para crear despachos en esta sucursal.', 'No tienes permisos para crear despachos en esta sucursal.'],
  ['El usuario de la operación no coincide con la sesión.', 'El usuario de la operación no coincide con la sesión.'],
  ['El formato de las líneas no es válido.', 'El formato de las líneas no es válido.'],
  ['No tienes permisos para corregir devoluciones de esta sucursal.', 'No tienes permisos para corregir devoluciones de esta sucursal.'],
  ['No tienes permisos para registrar ventas.', 'No tienes permisos para registrar ventas.'],
  ['El descuento debe ser un número finito.', 'El descuento debe ser un número finito.'],
  ['El formato de los detalles de venta no es válido.', 'El formato de los detalles de venta no es válido.'],
  ['El vendedor no existe o está desactivado.', 'El vendedor no existe o está desactivado.'],
  ['El precio unitario debe ser un número finito.', 'El precio unitario debe ser un número finito.'],
  ['Stock o carga insuficiente para completar la operación.', 'Stock o carga insuficiente para completar la operación.'],
  ['Los movimientos conservan su historial; utiliza la anulación.', 'Los movimientos conservan su historial; utiliza la anulación.'],
  ['No se puede reactivar un movimiento anulado.', 'No se puede reactivar un movimiento anulado.'],
  ['Los datos de un movimiento registrado no se pueden editar.', 'Los datos de un movimiento registrado no se pueden editar.'],
  ['El tipo y empaque de un producto con movimientos son históricos.', 'El tipo y empaque de un producto con movimientos son históricos.'],
  ['La clave de reintento pertenece a otra operación.', 'La clave de reintento pertenece a otra operación.'],
  ['El despacho está anulado o pertenece a otra sucursal.', 'El despacho está anulado o pertenece a otra sucursal.'],
  ['No se puede devolver más de lo despachado.', 'No se puede devolver más de lo despachado.'],
  ['La merma supera lo despachado pendiente de ese producto.', 'La merma supera lo despachado pendiente de ese producto.'],
  ['Línea de producto inválida en la devolución.', 'Línea de producto inválida en la devolución.'],
  ['Línea de envase inválida en la devolución.', 'Línea de envase inválida en la devolución.'],
  ['No tienes permisos para registrar devoluciones.', 'No tienes permisos para registrar devoluciones.'],
  ['Indica el motivo de la corrección.', 'Indica el motivo de la corrección.'],
  ['No se puede modificar una regla de comisión histórica.', 'No se puede modificar una regla de comisión histórica.'],
  ['Una regla nueva no puede cambiar comisiones de ventas anteriores.', 'Una regla nueva no puede cambiar comisiones de ventas anteriores.'],
  ['Selecciona una sucursal para registrar la incidencia.', 'Selecciona una sucursal para registrar la incidencia.'],
  ['La categoría de un empaque con movimientos es histórica.', 'La categoría de un empaque con movimientos es histórica.'],

  ['Cliente inexistente o fuera de su cartera/sucursal', 'El cliente no pertenece a tu cartera o sucursal.'],
  ['Método de pago inválido (efectivo o transferencia)', 'El método de pago no es válido.'],
  ['La venta debe incluir al menos un detalle', 'Debes agregar al menos un producto a la venta.'],
  ['No hay un usuario autenticado', 'Debes iniciar sesión para realizar esta acción.'],
  ['El usuario autenticado no tiene perfil', 'No tienes un perfil habilitado para realizar esta acción.'],
  ['Detalle de venta incompleto (producto_id, cantidad y precio_unitario son obligatorios)', 'Completa el producto, la cantidad y el precio de cada detalle.'],
  ['La cantidad debe ser mayor que cero', 'La cantidad debe ser mayor que cero.'],
  ['El precio unitario no puede ser negativo', 'El precio unitario no puede ser negativo.'],
  ['El despacho está anulado', 'El despacho está anulado.'],
  ['La venta está anulada', 'La venta está anulada.'],
  ['Faltan datos del despacho: sucursal, vendedor, despachador o usuario.', 'Completa la sucursal, el vendedor y el responsable del despacho.'],
  ['Agrega al menos un producto al despacho.', 'Agrega al menos un producto al despacho.'],
  ['Línea de producto inválida en el despacho.', 'Revisa los productos y cantidades del despacho.'],
  ['Línea de envase inválida en el despacho.', 'Revisa los envases y cantidades del despacho.'],
  ['Solo administración puede corregir devoluciones', 'Solo administración puede corregir devoluciones.'],
  ['El despacho no existe', 'El despacho no existe.'],
  ['El despacho asociado no existe', 'El despacho asociado no existe.'],
  ['Estado de envase inválido', 'El estado del envase no es válido.'],
  ['El producto no existe o está desactivado', 'El producto no existe o está desactivado.'],
  ['La merma debe indicar un producto o un tipo de envase', 'Selecciona el producto o el tipo de envase de la merma.'],
  ['Stock insuficiente', 'No hay stock suficiente.'],
  ['No hay stock suficiente', 'No hay stock suficiente.'],
])

const patronesDeNegocio: [RegExp, string][] = [
  [/^(?:El vendedor no tiene carga del producto|Carga insuficiente del vendedor para el producto) [^\r\n]+$/, 'No tienes carga suficiente de uno de los productos.'],
  [/^Carga insuficiente del vendedor para devolver el producto [^\r\n]+$/, 'No tienes carga suficiente para devolver uno de los productos.'],
  [/^Stock insuficiente de envases para el tipo [^\r\n]+$/, 'No hay stock suficiente de envases.'],
  [/^Stock insuficiente en bodega para el producto [^\r\n]+$/, 'No hay stock suficiente en bodega para uno de los productos.'],
  [/^No se puede devolver más de lo despachado del producto [^\r\n]+$/, 'No se puede devolver más de lo despachado de un producto.'],
  [/^La ventana de ajuste expiró \([0-9]+ minutos\)\. Solo el administrador puede corregir el despacho\.$/, 'La ventana de ajuste expiró. Solo administración puede corregir el despacho.'],
  [/^No hay envases vacíos suficientes\. Disponibles: [0-9]+(?:\.[0-9]+)?$/, 'No hay envases vacíos suficientes.'],
  [/^Cantidad de merma superior al stock disponible\. Disponible: [0-9]+(?:\.[0-9]+)?$/, 'La cantidad de merma supera el stock disponible.'],
  [/^Cantidad de merma superior a la carga disponible\. Disponible: [0-9]+(?:\.[0-9]+)?$/, 'La cantidad de merma supera la carga disponible.'],
  [/^Cantidad de merma superior a los envases disponibles\. Disponibles: [0-9]+(?:\.[0-9]+)?$/, 'La cantidad de merma supera los envases disponibles.'],
]

const mensajesPublicos = new Map<string, string>([
  mensajeGenerico,
  ...mensajesPorCodigo.values(),
  ...mensajesDeNegocio.values(),
  ...patronesDeNegocio.map(([, mensaje]) => mensaje),
  'No fue posible cargar los clientes de tu ruta. Inténtalo de nuevo.',
  'No fue posible cargar los vendedores. Inténtalo de nuevo.',
  'No fue posible cargar los productos para la venta. Inténtalo de nuevo.',
  'No fue posible cargar tu carga. Inténtalo de nuevo.',
  'No fue posible cargar los gastos de hoy. Inténtalo de nuevo.',
  'No fue posible obtener la comisión del vendedor',
  'No fue posible obtener la cantidad de ventas',
  'No fue posible obtener el ranking de vendedores',
  'No fue posible cargar los despachos. Inténtalo de nuevo.',
  'No fue posible cargar los detalles del despacho. Inténtalo de nuevo.',
  'No fue posible cargar los envases del despacho. Inténtalo de nuevo.',
  'No fue posible cargar las devoluciones de productos. Inténtalo de nuevo.',
  'No fue posible cargar las devoluciones de envases. Inténtalo de nuevo.',
  'No fue posible cargar el stock de productos. Inténtalo de nuevo.',
  'No fue posible cargar el stock de envases. Inténtalo de nuevo.',
  'No fue posible cargar la carga de los vendedores. Inténtalo de nuevo.',
].map((mensaje) => [mensaje, mensaje]))

export function mensajeErrorSupabase(error: unknown): string {
  if (typeof error !== 'object' || error === null) return mensajeGenerico

  const { code, message } = error as { code?: unknown; message?: unknown }
  if (typeof code === 'string') {
    const porCodigo = mensajesPorCodigo.get(code)
    if (porCodigo) return porCodigo
    if (code !== 'P0001' || typeof message !== 'string') return mensajeGenerico

    const deNegocio = mensajesDeNegocio.get(message)
    if (deNegocio) return deNegocio
    return patronesDeNegocio.find(([patron]) => patron.test(message))?.[1] ?? mensajeGenerico
  }

  return typeof message === 'string'
    ? mensajesPublicos.get(message) ?? mensajeGenerico
    : mensajeGenerico
}

const mensajeAutenticacionGenerico = 'No fue posible iniciar sesión. Inténtalo de nuevo.'
const mensajeCredenciales = 'Correo o contraseña incorrectos.'
const mensajeLimiteIntentos = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'

const mensajesAutenticacionPorCodigo = new Map<string, string>([
  ['invalid_credentials', mensajeCredenciales],
  ['over_request_rate_limit', mensajeLimiteIntentos],
  ['over_email_send_rate_limit', mensajeLimiteIntentos],
])

// Los errores de Supabase Auth traen code/status estables; su texto en inglés nunca se muestra.
export function mensajeErrorAutenticacion(error: unknown): string {
  if (typeof error !== 'object' || error === null) return mensajeAutenticacionGenerico

  const { code, status, message } = error as { code?: unknown; status?: unknown; message?: unknown }
  if (typeof code === 'string') {
    const porCodigo = mensajesAutenticacionPorCodigo.get(code)
    if (porCodigo) return porCodigo
  }
  if (status === 429) return mensajeLimiteIntentos
  if (message === 'Invalid login credentials') return mensajeCredenciales
  return mensajeAutenticacionGenerico
}
