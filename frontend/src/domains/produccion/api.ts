import { supabase } from '../../lib/supabase'
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
    if (filtros.desde) consulta = consulta.gte('creado_en', `${filtros.desde}T00:00:00`)
    if (filtros.hasta) consulta = consulta.lte('creado_en', `${filtros.hasta}T23:59:59.999`)

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
  empaques: TipoEmpaque[],
): Promise<EnvaseDisponible[]> {
  try {
    const { data, error } = await supabase
      .from('stock_envases')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .returns<StockEnvases[]>()
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
    const { error } = await supabase.from('producciones').insert([datos] as never[])
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
      .insert([datos] as never[])

    return error
      ? mensajeErrorSupabase(error)
      : null
  } catch (error: unknown) {
    return mensajeErrorSupabase(error)
  }
}

export function subscribeProduccion(sucursalId: string, onChange: () => void): () => void {
  const canal = supabase.channel(`produccion-${sucursalId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'producciones', filter: `sucursal_id=eq.${sucursalId}` }, onChange)
    // BD-12: mermas is not in the remote supabase_realtime publication yet; backend task B4 adds it.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mermas', filter: `sucursal_id=eq.${sucursalId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_envases', filter: `sucursal_id=eq.${sucursalId}` }, onChange)
    .subscribe()
  return () => { void supabase.removeChannel(canal) }
}

export async function obtenerIncidencias(sucursalId: string): Promise<IncidenciaProduccion[]> {
  try {
    const { data, error } = await supabase.from('incidencias_produccion')
      .select('*').eq('sucursal_id' as never, sucursalId)
      .order('creado_en', { ascending: false }).limit(30).returns<IncidenciaProduccion[]>()
    if (error) throw new Error(mensajeErrorSupabase(error))
    return data ?? []
  } catch (error: unknown) {
    throw new Error(mensajeErrorSupabase(error), { cause: error })
  }
}

export async function registrarIncidencia(datos: NuevaIncidenciaProduccion): Promise<string | null> {
  try {
    const { error } = await supabase.from('incidencias_produccion').insert([datos] as never[])
    return error ? mensajeErrorSupabase(error) : null
  } catch (error: unknown) {
    return mensajeErrorSupabase(error)
  }
}
