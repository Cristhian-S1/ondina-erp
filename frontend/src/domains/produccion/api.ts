import { supabase } from '../../lib/supabase'
import { obtenerTiposEmpaque } from '../../lib/catalog'
import { mensajeErrorSupabase } from '../../lib/errors'
import type { TipoEmpaque } from '../../types'
import type { StockEnvases } from '../bodega/types'
import type {
  EnvaseDisponible,
  IncidenciaProduccion,
  NuevaIncidenciaProduccion,
  MermaProduccion,
  NuevaMermaProduccion,
  NuevaProduccion,
  Produccion,
  FiltrosProduccion,
  IndicadorProduccionDiario,
} from './types'

const jornadaSantiago = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' })

function inicioJornada(fecha: string) {
  const referencia = Date.parse(`${fecha}T00:00:00Z`)
  let desde = referencia - 36 * 60 * 60 * 1000
  let hasta = referencia + 36 * 60 * 60 * 1000
  // Busca el primer instante del día local; cubre medianoches omitidas y horas repetidas.
  while (desde < hasta) {
    const medio = Math.floor((desde + hasta) / 2)
    if (jornadaSantiago.format(medio) < fecha) desde = medio + 1
    else hasta = medio
  }
  return desde
}

function limiteJornada(fecha: string, final: boolean) {
  if (!final) return new Date(inicioJornada(fecha)).toISOString()
  const siguiente = new Date(`${fecha}T12:00:00Z`)
  siguiente.setUTCDate(siguiente.getUTCDate() + 1)
  return new Date(inicioJornada(siguiente.toISOString().slice(0, 10)) - 1).toISOString()
}

export async function obtenerIndicadoresProduccion(
  sucursalId: string,
  desde: string,
  hasta: string,
): Promise<IndicadorProduccionDiario[]> {
  try {
    const { data, error } = await supabase
      .from('v_indicadores_produccion_diarios')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false })
      .returns<IndicadorProduccionDiario[]>()
    if (error) throw new Error(mensajeErrorSupabase(error))
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerProducciones(sucursalId: string): Promise<Produccion[]> {
  try {
    const { data, error } = await supabase
      .from('producciones')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .eq('anulado', false)
      .order('creado_en', { ascending: false })
      .limit(30)
      .returns<Produccion[]>()
    if (error) throw new Error(mensajeErrorSupabase(error))
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerHistorialProduccion(filtros: FiltrosProduccion): Promise<Produccion[]> {
  try {
    let consulta = supabase
      .from('producciones')
      .select('*')
      .eq('sucursal_id', filtros.sucursalId)
      .eq('anulado', false)
      .order('creado_en', { ascending: false })
      .limit(filtros.limite ?? 200)

    if (filtros.productoId) consulta = consulta.eq('producto_id', filtros.productoId)
    if (filtros.desde) consulta = consulta.gte('creado_en', limiteJornada(filtros.desde, false))
    if (filtros.hasta) consulta = consulta.lte('creado_en', limiteJornada(filtros.hasta, true))

    const { data, error } = await consulta.returns<Produccion[]>()
    if (error) throw new Error(mensajeErrorSupabase(error))
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerMermas(sucursalId: string): Promise<MermaProduccion[]> {
  try {
    const { data, error } = await supabase
      .from('mermas')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .eq('anulado', false)
      .is('despacho_id', null)
      .not('producto_id', 'is', null)
      .order('creado_en', { ascending: false })
      .limit(30)
      .returns<MermaProduccion[]>()

    if (error) throw new Error(mensajeErrorSupabase(error))
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function obtenerEnvasesDisponibles(
  sucursalId: string,
  catalogo: TipoEmpaque[] | Promise<TipoEmpaque[]> = obtenerTiposEmpaque(),
): Promise<EnvaseDisponible[]> {
  try {
    // El stock no necesita el catálogo para iniciar su petición (A1-07).
    const [{ data, error }, empaques] = await Promise.all([
      supabase.from('stock_envases').select('*').eq('sucursal_id', sucursalId).returns<StockEnvases[]>(),
      catalogo,
    ])
    if (error) throw new Error(mensajeErrorSupabase(error))
    return (data ?? [])
      .map((fila) => ({
        tipo_empaque_id: fila.tipo_empaque_id,
        nombre: empaques.find((item) => item.id === fila.tipo_empaque_id)?.nombre ?? 'Envase',
        cantidad: fila.cantidad,
        modificado_en: fila.modificado_en,
      }))
      .filter((fila) => empaques.find((item) => item.id === fila.tipo_empaque_id)?.categoria === 'retornable')
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function registrarProduccion(datos: NuevaProduccion): Promise<string | null> {
  try {
    const { error } = await supabase.from('producciones').insert([datos])
    return error ? mensajeErrorSupabase(error) : null
  } catch (error: unknown) {
    return mensajeErrorSupabase(error)
  }
}

export async function registrarMerma(
  datos: NuevaMermaProduccion,
): Promise<string | null> {
  try {
    const { error } = await supabase
      .from('mermas')
      .insert([datos])

    return error
      ? mensajeErrorSupabase(error)
      : null
  } catch (error: unknown) {
    return mensajeErrorSupabase(error)
  }
}

export type RecursoProduccion = 'producciones' | 'mermas' | 'stock_envases' | 'incidencias_produccion'

export function subscribeProduccion(sucursalId: string, onChange: (recurso: RecursoProduccion) => void): () => void {
  const canal = supabase.channel(`produccion-${sucursalId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'producciones', filter: `sucursal_id=eq.${sucursalId}` }, () => onChange('producciones'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mermas', filter: `sucursal_id=eq.${sucursalId}` }, () => onChange('mermas'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_envases', filter: `sucursal_id=eq.${sucursalId}` }, () => onChange('stock_envases'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias_produccion', filter: `sucursal_id=eq.${sucursalId}` }, () => onChange('incidencias_produccion'))
    .subscribe()
  return () => { void supabase.removeChannel(canal) }
}

export async function obtenerIncidencias(sucursalId: string): Promise<IncidenciaProduccion[]> {
  try {
    const { data, error } = await supabase.from('incidencias_produccion')
      .select('*').eq('sucursal_id', sucursalId)
      .order('creado_en', { ascending: false }).limit(30).returns<IncidenciaProduccion[]>()
    if (error) throw new Error(mensajeErrorSupabase(error))
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function registrarIncidencia(datos: NuevaIncidenciaProduccion): Promise<string | null> {
  try {
    const { error } = await supabase.from('incidencias_produccion').insert(datos)
    return error ? mensajeErrorSupabase(error) : null
  } catch (error: unknown) {
    return mensajeErrorSupabase(error)
  }
}
