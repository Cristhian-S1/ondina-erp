import { rangoPagina } from '../../lib/paginacion'
import type { Pagina } from '../../lib/paginacion'
import { supabase } from '../../lib/supabase'
import { mensajeErrorSupabase } from '../../lib/errors'
import type { Perfil } from '../../types'
import type { Database } from '../../types/database-generated.types'
import type {
  CargaVendedor,
  Despacho,
  DespachoDetalle,
  DespachoEnvase,
  DevolucionEnvase,
  DevolucionProducto,
  FilaCuadre,
  Merma,
  OrigenMerma,
  StockBodega,
  StockEnvases,
} from './types'

export interface NuevoDespacho {
  idempotency_key: string
  sucursal_id: string
  vendedor_id: string
  despachador_id: string
  creado_por: string
  lineas: { producto_id: string; cantidad: number }[]
  envases: { tipo_empaque_id: string; cantidad: number }[]
}

export interface DevolucionProductosPayload {
  idempotency_key: string
  despacho_id: string
  creado_por: string
  lineas: { producto_id: string; cantidad: number }[]
}

export interface DevolucionEnvasesPayload {
  idempotency_key: string
  despacho_id: string
  creado_por: string
  lineas: { tipo_empaque_id: string; cantidad: number; estado: 'bueno' | 'malo' }[]
}

export interface CorregirDevolucionPayload {
  idempotency_key: string
  despacho_id: string
  creado_por: string
  motivo?: string
  lineas_producto: { producto_id: string; cantidad: number }[]
  lineas_envase: { tipo_empaque_id: string; cantidad: number; estado: 'bueno' | 'malo' }[]
}

// `type` y no `interface`: debe ser asignable a `Json` del cliente generado.
export type LineaAjusteDespacho = { producto_id: string; cantidad: number }

export interface ResultadoAjusteDespacho {
  despachoId: string
  lineasAgregadas: string[]
  ventanaExpiraEn: string
}

// Solo nombre e identificador: bodega no lee perfiles de vendedores (RB-15).
export type VendedorSucursal = Pick<Perfil, 'id' | 'nombres' | 'apellidos'>

export async function obtenerVendedores(sucursalId?: string): Promise<VendedorSucursal[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase.rpc('vendedores_sucursal', { p_sucursal_id: sucursalId })
    if (error) throw new Error('No fue posible cargar los vendedores. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

// Plantilla histórica: incluye vendedores inactivos con su bandera `activo`. Solo para nombrar
// despachos y devoluciones pasados; el selector de nuevo despacho sigue usando obtenerVendedores.
export type VendedorHistorial = Pick<Perfil, 'id' | 'nombres' | 'apellidos' | 'activo'>

export async function obtenerVendedoresHistorial(sucursalId?: string): Promise<VendedorHistorial[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase.rpc('vendedores_historial_sucursal', { p_sucursal_id: sucursalId })
    if (error) throw new Error('No fue posible cargar los vendedores. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerDespachos(sucursalId?: string): Promise<Despacho[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase
      .from('despachos')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('creado_en', { ascending: false })
      .returns<Despacho[]>()
    if (error) throw new Error('No fue posible cargar los despachos. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export interface FiltrosDespachos {
  vendedorId?: string
  desde?: string
  hasta?: string
}

export async function obtenerPaginaDespachos(sucursalId: string, opciones: FiltrosDespachos & { pagina: number; tamanoPagina?: number }): Promise<Pagina<Despacho>> {
  if (!sucursalId) return { filas: [], total: 0 }
  try {
    let query = supabase.from('despachos').select('*', { count: 'exact' })
      .eq('sucursal_id', sucursalId)
      .order('creado_en', { ascending: false }).order('id', { ascending: false })
    if (opciones.vendedorId) query = query.eq('vendedor_id', opciones.vendedorId)
    if (opciones.desde) query = query.gte('creado_en', opciones.desde)
    if (opciones.hasta) query = query.lt('creado_en', opciones.hasta)
    const { data, count, error } = await query.range(...rangoPagina(opciones.pagina, opciones.tamanoPagina)).returns<Despacho[]>()
    if (error) throw new Error('No fue posible cargar los despachos. Inténtalo de nuevo.')
    return { filas: data ?? [], total: count ?? 0 }
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerDespacho(sucursalId: string, id: string): Promise<Despacho[]> {
  try {
    const { data, error } = await supabase.from('despachos').select('*')
      .eq('sucursal_id', sucursalId).eq('id', id).returns<Despacho[]>()
    if (error) throw new Error('No fue posible cargar el despacho. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerDetallesDespacho(despachoIds: string[]): Promise<DespachoDetalle[]> {
  try {
    if (despachoIds.length === 0) return []
    const { data, error } = await supabase
      .from('despacho_detalles')
      .select('*')
      .in('despacho_id', despachoIds)
      .returns<DespachoDetalle[]>()
    if (error) throw new Error('No fue posible cargar los detalles del despacho. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerEnvasesDespacho(despachoIds: string[]): Promise<DespachoEnvase[]> {
  try {
    if (despachoIds.length === 0) return []
    const { data, error } = await supabase
      .from('despacho_envases')
      .select('*')
      .in('despacho_id', despachoIds)
      .returns<DespachoEnvase[]>()
    if (error) throw new Error('No fue posible cargar los envases del despacho. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerDevolucionesProducto(despachoIds: string[]): Promise<DevolucionProducto[]> {
  try {
    if (despachoIds.length === 0) return []
    const { data, error } = await supabase
      .from('devoluciones_productos')
      .select('*')
      .in('despacho_id', despachoIds)
      .eq('anulado', false)
      .returns<DevolucionProducto[]>()
    if (error) throw new Error('No fue posible cargar las devoluciones de productos. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerDevolucionesEnvase(despachoIds: string[]): Promise<DevolucionEnvase[]> {
  try {
    if (despachoIds.length === 0) return []
    const { data, error } = await supabase
      .from('devoluciones_envases')
      .select('*')
      .in('despacho_id', despachoIds)
      .eq('anulado', false)
      .returns<DevolucionEnvase[]>()
    if (error) throw new Error('No fue posible cargar las devoluciones de envases. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerStockBodega(sucursalId: string): Promise<StockBodega[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase
      .from('stock_bodega')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .returns<StockBodega[]>()
    if (error) throw new Error('No fue posible cargar el stock de productos. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerStockEnvases(sucursalId: string): Promise<StockEnvases[]> {
  try {
    if (!sucursalId) return []
    const { data, error } = await supabase
      .from('stock_envases')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .returns<StockEnvases[]>()
    if (error) throw new Error('No fue posible cargar el stock de envases. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerCargaVendedores(vendedorIds: string[]): Promise<CargaVendedor[]> {
  try {
    if (vendedorIds.length === 0) return []
    const { data, error } = await supabase
      .from('carga_vendedor')
      .select('*')
      .in('vendedor_id', vendedorIds)
      .returns<CargaVendedor[]>()
    if (error) throw new Error('No fue posible cargar la carga de los vendedores. Inténtalo de nuevo.')
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function crearDespacho(payload: NuevoDespacho): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('crear_despacho', {
      p_sucursal_id: payload.sucursal_id,
      p_vendedor_id: payload.vendedor_id,
      p_despachador_id: payload.despachador_id,
      p_creado_por: payload.creado_por,
      p_lineas: payload.lineas,
      p_envases: payload.envases,
      p_idempotency_key: payload.idempotency_key,
    })

    return { error: error ? mensajeErrorSupabase(error) : null }
  } catch (error: unknown) {
    return { error: mensajeErrorSupabase(error) }
  }
}

export async function registrarDevolucionProductos(
  payload: DevolucionProductosPayload,
): Promise<{ error: string | null }> {
  return registrarDevolucion({
    despacho_id: payload.despacho_id,
    creado_por: payload.creado_por,
    lineas_producto: payload.lineas,
    lineas_envase: [],
    idempotency_key: payload.idempotency_key,
  })
}

export async function corregirDevolucion(
  payload: CorregirDevolucionPayload,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('corregir_devolucion', {
      p_despacho_id: payload.despacho_id,
      p_creado_por: payload.creado_por,
      p_productos: payload.lineas_producto,
      p_envases: payload.lineas_envase,
      p_motivo: payload.motivo,
      p_idempotency_key: payload.idempotency_key,
    })

    return { error: error ? mensajeErrorSupabase(error) : null }
  } catch (error: unknown) {
    return { error: mensajeErrorSupabase(error) }
  }
}

export async function registrarDevolucionEnvases(
  payload: DevolucionEnvasesPayload,
): Promise<{ error: string | null }> {
  return registrarDevolucion({
    despacho_id: payload.despacho_id,
    creado_por: payload.creado_por,
    lineas_envase: payload.lineas,
    lineas_producto: [],
    idempotency_key: payload.idempotency_key,
  })
}

export async function registrarDevolucion(
  payload: Omit<CorregirDevolucionPayload, 'motivo'>,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('registrar_devolucion', {
      p_despacho_id: payload.despacho_id,
      p_productos: payload.lineas_producto,
      p_envases: payload.lineas_envase,
      p_idempotency_key: payload.idempotency_key,
    })
    return { error: error ? mensajeErrorSupabase(error) : null }
  } catch (error: unknown) {
    return { error: mensajeErrorSupabase(error) }
  }
}

// Mensajes de ajustar_despacho que la interfaz traduce aquí: `lib/errors` no los cubre todos y el 42501
// de esta RPC debe hablar del despacho. Cualquier otro error cae en la traducción compartida.
const mensajesAjusteDespacho = new Map<string, string>([
  ['No tienes permisos para modificar este despacho.', 'No tienes permisos para modificar este despacho.'],
  ['Indica la clave de reintento del ajuste.', 'No se pudo identificar el intento. Cierra el formulario e inténtalo de nuevo.'],
  ['El despacho no existe', 'El despacho no existe.'],
  ['El despacho está anulado', 'El despacho está anulado.'],
  ['La clave de reintento pertenece a otra operación.', 'Este reintento pertenece a otra operación. Cierra el formulario e inténtalo de nuevo.'],
  ['Agrega al menos un producto al despacho.', 'Agrega al menos un producto al despacho.'],
  ['Línea de producto inválida en el despacho.', 'Revisa los productos y cantidades del ajuste.'],
  ['El producto no existe o está desactivado', 'El producto no existe o está desactivado.'],
  ['No repitas productos en el ajuste.', 'No repitas productos en el ajuste.'],
  ['La ventana de ajuste del despacho expiró.', 'La ventana de ajuste del despacho expiró. Ya no se pueden agregar productos.'],
  ['Stock o carga insuficiente para completar la operación.', 'No hay stock suficiente en bodega para completar el ajuste.'],
])

export function mensajeErrorAjusteDespacho(error: unknown): string {
  const message = typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : undefined
  return (typeof message === 'string' ? mensajesAjusteDespacho.get(message) : undefined) ?? mensajeErrorSupabase(error)
}

function leerResultadoAjuste(data: unknown): ResultadoAjusteDespacho | null {
  if (typeof data !== 'object' || data === null) return null
  const { despacho_id, lineas_agregadas, ventana_expira_en } = data as Record<string, unknown>
  if (typeof despacho_id !== 'string' || typeof ventana_expira_en !== 'string' || !Array.isArray(lineas_agregadas)) return null
  return { despachoId: despacho_id, lineasAgregadas: lineas_agregadas.filter((id): id is string => typeof id === 'string'),
    ventanaExpiraEn: ventana_expira_en }
}

// HU-26: solo suma productos. El stock, la ventana (reloj del servidor) y la auditoría los resuelve la base.
export async function ajustarDespacho(
  despachoId: string,
  lineas: LineaAjusteDespacho[],
  idempotencyKey: string,
): Promise<{ error: string | null; resultado: ResultadoAjusteDespacho | null }> {
  try {
    const { data, error } = await supabase.rpc('ajustar_despacho', {
      p_despacho_id: despachoId,
      p_lineas: lineas,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return { error: mensajeErrorAjusteDespacho(error), resultado: null }
    return { error: null, resultado: leerResultadoAjuste(data) }
  } catch (error: unknown) {
    return { error: mensajeErrorAjusteDespacho(error), resultado: null }
  }
}

export interface VentanaAjusteServidor {
  minutos: number
  servidorAhora: string
}

// HU-26: ventana configurada y reloj del servidor. Cero filas (rol sin acceso) o fila inesperada → null.
export async function obtenerVentanaAjuste(): Promise<VentanaAjusteServidor | null> {
  try {
    const { data, error } = await supabase.rpc('ventana_ajuste_despacho')
    if (error) throw error
    const fila = data?.[0]
    if (!fila || typeof fila.minutos !== 'number' || typeof fila.servidor_ahora !== 'string') return null
    return { minutos: fila.minutos, servidorAhora: fila.servidor_ahora }
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

// HU-29. El cliente generado tipa los ids opcionales como `string`, pero la RPC exige enviarlos y acepta
// null: los argumentos se declaran con null y se afirman una sola vez contra el tipo generado.
type ArgsRegistrarMerma = Database['public']['Functions']['registrar_merma_bodega']['Args']
type ArgsCuadre = Database['public']['Functions']['cuadre_diario_bodega']['Args']

export interface NuevaMerma {
  sucursal_id: string
  origen: OrigenMerma
  despacho_id: string | null
  producto_id: string | null
  tipo_empaque_id: string | null
  cantidad: number
  motivo: string
}

const mensajesMerma = new Map<string, string>([
  ['No tienes permisos para registrar mermas en esta sucursal.', 'No tienes permisos para registrar mermas en esta sucursal.'],
  ['Selecciona una sucursal.', 'Selecciona una sucursal.'],
  ['Indica la clave de reintento de la merma.', 'No se pudo identificar el intento. Recarga la página e inténtalo de nuevo.'],
  ['Los envases dañados en una devolución no se registran otra vez como merma.', 'Los envases dañados en una devolución no se registran otra vez como merma.'],
  ['Selecciona un origen de merma válido.', 'Selecciona un origen de merma válido.'],
  ['El origen no coincide con el despacho indicado.', 'El origen no coincide con el despacho indicado.'],
  ['Indica solo un producto o un tipo de envase.', 'Indica solo un producto o un tipo de envase.'],
  ['Registra los envases dañados del despacho como devolución en estado malo.', 'Registra los envases dañados del despacho como devolución en estado malo.'],
  ['La cantidad debe ser un entero mayor que cero.', 'La cantidad debe ser un entero mayor que cero.'],
  ['Indica el motivo de la merma.', 'Indica el motivo de la merma.'],
  ['La clave de reintento pertenece a otra operación.', 'Este reintento pertenece a otra operación. Recarga la página e inténtalo de nuevo.'],
  ['La sucursal no existe.', 'La sucursal no existe.'],
  ['El producto no existe o está desactivado', 'El producto no existe o está desactivado.'],
  ['El tipo de envase no existe o está desactivado.', 'El tipo de envase no existe o está desactivado.'],
  ['El despacho no existe', 'El despacho no existe.'],
  ['El despacho está anulado', 'El despacho está anulado.'],
  ['Stock o carga insuficiente para completar la operación.', 'No hay stock o carga suficiente para registrar la merma.'],
  ['Solo administración puede anular mermas.', 'Solo administración puede anular mermas.'],
  ['Indica el motivo de la anulación.', 'Indica el motivo de la anulación.'],
  ['La merma no existe.', 'La merma no existe.'],
  ['No tienes permisos para anular esta merma.', 'No tienes permisos para anular esta merma.'],
  ['No tienes permisos para consultar este cuadre.', 'No tienes permisos para consultar este cuadre.'],
  ['Indica un rango válido de hasta 31 días, sin fechas futuras.', 'Indica un rango válido de hasta 31 días, sin fechas futuras.'],
  ['El vendedor no pertenece a esta sucursal.', 'El vendedor no pertenece a esta sucursal.'],
])

// Fallos al decodificar argumentos nativos (uuid, integer, date): son de formulario, no del servidor.
const codigosArgumentoInvalido = new Set(['22P02', '22003', '22007', '22008'])

// Mensajes de HU-29 (mermas y cuadre) traducidos por texto exacto, como mensajeErrorAjusteDespacho.
// Los demás (saldos B6 con cantidad disponible, códigos genéricos) caen en la traducción compartida.
export function mensajeErrorMerma(error: unknown): string {
  const { code, message } = typeof error === 'object' && error !== null ? error as { code?: unknown; message?: unknown } : {}
  if (typeof code === 'string' && codigosArgumentoInvalido.has(code)) return 'Revisa la cantidad, el producto y los datos ingresados.'
  return (typeof message === 'string' ? mensajesMerma.get(message) : undefined) ?? mensajeErrorSupabase(error)
}

// La clave la entrega el llamador (un intento = una clave) y se reutiliza en cada reintento del mismo contenido.
// Devuelve el id de la merma; un reintento devuelve el id original.
export async function registrarMermaBodega(
  merma: NuevaMerma,
  idempotencyKey: string,
): Promise<{ error: string | null; mermaId: string | null }> {
  try {
    const args = {
      p_sucursal_id: merma.sucursal_id,
      p_origen: merma.origen,
      p_despacho_id: merma.despacho_id,
      p_producto_id: merma.producto_id,
      p_tipo_empaque_id: merma.tipo_empaque_id,
      p_cantidad: merma.cantidad,
      p_motivo: merma.motivo,
      p_idempotency_key: idempotencyKey,
    }
    const { data, error } = await supabase.rpc('registrar_merma_bodega', args as ArgsRegistrarMerma)
    if (error) return { error: mensajeErrorMerma(error), mermaId: null }
    return { error: null, mermaId: typeof data === 'string' ? data : null }
  } catch (error: unknown) {
    return { error: mensajeErrorMerma(error), mermaId: null }
  }
}

// Solo administración; el reintento es por id de merma y no lleva clave.
export async function anularMermaBodega(mermaId: string, motivo: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('anular_merma_bodega', { p_merma_id: mermaId, p_motivo: motivo })
    return { error: error ? mensajeErrorMerma(error) : null }
  } catch (error: unknown) {
    return { error: mensajeErrorMerma(error) }
  }
}

export interface FiltrosMermas {
  origen?: OrigenMerma
  anuladas?: boolean
}

export async function obtenerPaginaMermas(
  sucursalId: string,
  opciones: FiltrosMermas & { pagina: number; tamanoPagina?: number },
): Promise<Pagina<Merma>> {
  if (!sucursalId) return { filas: [], total: 0 }
  try {
    let query = supabase.from('mermas').select('*', { count: 'exact' }).eq('sucursal_id', sucursalId)
    if (opciones.origen === 'bodega') query = query.is('despacho_id', null)
    if (opciones.origen === 'despacho') query = query.not('despacho_id', 'is', null)
    if (opciones.anuladas !== undefined) query = query.eq('anulado', opciones.anuladas)
    const { data, count, error } = await query
      .order('creado_en', { ascending: false }).order('id', { ascending: false })
      .range(...rangoPagina(opciones.pagina, opciones.tamanoPagina)).returns<Merma[]>()
    if (error) throw new Error('No fue posible cargar las mermas. Inténtalo de nuevo.')
    return { filas: data ?? [], total: count ?? 0 }
  } catch (error: unknown) {
    throw new Error(mensajeErrorMerma(error), { cause: error })
  }
}

// PostgREST entrega bigint como número JSON; una cadena numérica también se acepta. Fuera del rango
// seguro de JS se falla en voz alta en vez de mostrar una cantidad redondeada.
function leerBigint(valor: unknown, campo: string, nulable: true): number | null
function leerBigint(valor: unknown, campo: string, nulable?: false): number
function leerBigint(valor: unknown, campo: string, nulable = false): number | null {
  if (valor === null && nulable) return null
  const numero = typeof valor === 'string' && /^-?\d+$/.test(valor) ? Number(valor) : valor
  if (typeof numero === 'number' && Number.isSafeInteger(numero)) return numero
  throw new Error(`El cuadre trae una cantidad no válida (${campo}).`)
}

function leerFilaCuadre(fila: unknown): FilaCuadre {
  const f = (typeof fila === 'object' && fila !== null ? fila : {}) as Record<string, unknown>
  const { sucursal_id, vendedor_id, fecha, producto_id, comparacion_disponible } = f
  if (typeof sucursal_id !== 'string' || typeof vendedor_id !== 'string' || typeof fecha !== 'string'
    || typeof producto_id !== 'string' || typeof comparacion_disponible !== 'boolean') {
    throw new Error('El cuadre trae una fila con un formato inesperado.')
  }
  return {
    sucursal_id, vendedor_id, fecha, producto_id, comparacion_disponible,
    despachado: leerBigint(f.despachado, 'despachado'),
    vendido: leerBigint(f.vendido, 'vendido'),
    devuelto: leerBigint(f.devuelto, 'devuelto'),
    mermas: leerBigint(f.mermas, 'mermas'),
    esperado_en_carga: leerBigint(f.esperado_en_carga, 'esperado_en_carga'),
    saldo_inicial: leerBigint(f.saldo_inicial, 'saldo_inicial', true),
    carga_actual: leerBigint(f.carga_actual, 'carga_actual', true),
    diferencia_carga: leerBigint(f.diferencia_carga, 'diferencia_carga', true),
  }
}

// Fechas ISO inclusivas (máx. 31 días, sin futuro; la base lo exige). Sin vendedor se envía null explícito.
export async function obtenerCuadreDiario(
  sucursalId: string,
  desde: string,
  hasta: string,
  vendedorId: string | null,
): Promise<FilaCuadre[]> {
  try {
    const args = { p_sucursal_id: sucursalId, p_desde: desde, p_hasta: hasta, p_vendedor_id: vendedorId }
    const { data, error } = await supabase.rpc('cuadre_diario_bodega', args as ArgsCuadre)
    if (error) throw error
    return (data ?? []).map(leerFilaCuadre)
  } catch (error: unknown) {
    // Un fallo de formato propio ya trae mensaje en español; los de Supabase se traducen.
    const propio = error instanceof Error && error.message.startsWith('El cuadre trae')
    throw new Error(propio ? error.message : mensajeErrorMerma(error), { cause: error })
  }
}
