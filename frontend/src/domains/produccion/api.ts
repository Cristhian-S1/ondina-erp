import { supabase } from '../../lib/supabase'
import type { TipoEmpaque } from '../../types'
import type { StockEnvases } from '../bodega/types'
import type {
  EnvaseDisponible,
  IncidenciaProduccion,
  NuevaIncidencia,
  NuevaProduccion,
  Produccion,
  FiltrosProduccion,
  IndicadorProduccionDiario,
} from './types'

function mensajeError(error: { message: string } | null, respaldo: string) {
  return error?.message ?? respaldo
}

export async function obtenerIndicadoresProduccion(
  sucursalId: string,
  desde: string,
  hasta: string,
): Promise<IndicadorProduccionDiario[]> {
  const { data, error } = await supabase
    .from('v_indicadores_produccion_diarios')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })
    .returns<IndicadorProduccionDiario[]>()
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function obtenerProducciones(sucursalId: string): Promise<Produccion[]> {
  const { data, error } = await supabase
    .from('producciones')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .eq('anulado', false)
    .order('creado_en', { ascending: false })
    .limit(30)
    .returns<Produccion[]>()
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function obtenerHistorialProduccion(filtros: FiltrosProduccion): Promise<Produccion[]> {
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
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function obtenerIncidencias(): Promise<IncidenciaProduccion[]> {
  const { data, error } = await supabase
    .from('incidencias_produccion')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(30)
    .returns<IncidenciaProduccion[]>()
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function obtenerEnvasesDisponibles(
  sucursalId: string,
  empaques: TipoEmpaque[],
): Promise<EnvaseDisponible[]> {
  const { data, error } = await supabase
    .from('stock_envases')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .returns<StockEnvases[]>()
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((fila) => ({
      tipo_empaque_id: fila.tipo_empaque_id,
      nombre: empaques.find((item) => item.id === fila.tipo_empaque_id)?.nombre ?? 'Envase',
      cantidad: fila.cantidad,
      modificado_en: fila.modificado_en,
    }))
    .filter((fila) => empaques.find((item) => item.id === fila.tipo_empaque_id)?.categoria === 'retornable')
}

export async function registrarProduccion(datos: NuevaProduccion): Promise<string | null> {
  const { error } = await supabase.from('producciones').insert([datos] as never[])
  return error ? mensajeError(error, 'No fue posible registrar la producción.') : null
}

export async function registrarIncidencia(datos: NuevaIncidencia): Promise<string | null> {
  const { error } = await supabase.from('incidencias_produccion').insert([datos] as never[])
  return error ? mensajeError(error, 'No fue posible registrar la incidencia.') : null
}
