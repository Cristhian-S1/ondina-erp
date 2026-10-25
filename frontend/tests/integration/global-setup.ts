// Global setup de los recorridos B5 (issue #43). Materializa cuentas
// sintéticas con contraseña (el seed no las tiene) usando la clave
// service_role SOLO para Auth admin, perfiles y normalización de saldos.
// Los recorridos nunca operan con service_role: actúan con cada usuario real.
//
// Las cuentas se eliminan en el teardown: la baja de Auth es *soft delete*
// porque los movimientos creados referencian los perfiles y los triggers de
// integridad (B3) prohíben borrar historial de movimientos; además los
// perfiles se desactivan para que no aparezcan en listados ni rankings.

import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveSupabaseEnv } from './support/env'
import {
  USER_DEFINITIONS,
  type EmpaqueFixture,
  type ProductoFixture,
  type RecorridosFixtures,
  type SessionUser,
  type SucursalKey,
  type UserKey,
} from './support/fixtures'

const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } } as const

const SUCURSALES: Record<SucursalKey, string> = {
  A: '10000000-0000-0000-0000-000000000001',
  B: '10000000-0000-0000-0000-000000000002',
}

// Estado inicial reproducible por corrida (el seed parte con 100/20).
const STOCK_INICIAL = 100
const CARGA_INICIAL = 20

interface GlobalSetupContext {
  provide: (key: 'recorridos', value: RecorridosFixtures) => void
}

async function createUsers(
  admin: SupabaseClient,
  runId: string,
): Promise<Record<UserKey, SessionUser>> {
  const users = {} as Record<UserKey, SessionUser>
  for (const definition of USER_DEFINITIONS) {
    const email = `b5-${runId}-${definition.key}@example.invalid`
    const password = `b5-local-${runId}-${definition.key}`
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error || !data.user) {
      throw new Error(`No fue posible crear el usuario ${definition.key}: ${error?.message ?? 'sin usuario'}`)
    }
    users[definition.key] = {
      ...definition,
      id: data.user.id,
      email,
      password,
      sucursalId: definition.sucursal ? SUCURSALES[definition.sucursal] : null,
    }
  }

  const { error: perfilesError } = await admin.from('perfiles').insert(
    Object.values(users).map((user) => ({
      id: user.id,
      sucursal_id: user.sucursalId,
      nombres: user.nombres,
      apellidos: user.apellidos,
      rol: user.rol,
      activo: user.activo,
    })),
  )
  if (perfilesError) {
    throw new Error(`No fue posible crear los perfiles sintéticos: ${perfilesError.message}`)
  }
  return users
}

async function loadCatalog(admin: SupabaseClient): Promise<{
  productos: ProductoFixture[]
  empaques: EmpaqueFixture[]
}> {
  const [{ data: productos, error: productosError }, { data: empaques, error: empaquesError }] =
    await Promise.all([
      admin.from('productos').select('id, nombre, tipo, precio_base').order('id'),
      admin.from('tipos_empaque').select('id, nombre, categoria').order('id'),
    ])
  if (productosError || !productos) {
    throw new Error(`No fue posible leer productos: ${productosError?.message ?? 'sin datos'}`)
  }
  if (empaquesError || !empaques) {
    throw new Error(`No fue posible leer tipos de empaque: ${empaquesError?.message ?? 'sin datos'}`)
  }
  return {
    productos: productos as ProductoFixture[],
    empaques: empaques as EmpaqueFixture[],
  }
}

// Normaliza los saldos de las sucursales sintéticas para que cada corrida
// parta del mismo estado aunque no se ejecute `supabase db reset`.
async function normalizeBalances(
  admin: SupabaseClient,
  productos: ProductoFixture[],
  empaques: EmpaqueFixture[],
  users: Record<UserKey, SessionUser>,
): Promise<void> {
  const sucursalIds = Object.values(SUCURSALES)
  const { error: stockError } = await admin.from('stock_bodega').upsert(
    sucursalIds.flatMap((sucursal_id) =>
      productos.map((producto) => ({ sucursal_id, producto_id: producto.id, cantidad: STOCK_INICIAL })),
    ),
    { onConflict: 'sucursal_id,producto_id' },
  )
  if (stockError) throw new Error(`No fue posible normalizar stock_bodega: ${stockError.message}`)

  const { error: envasesError } = await admin.from('stock_envases').upsert(
    sucursalIds.flatMap((sucursal_id) =>
      empaques.map((empaque) => ({ sucursal_id, tipo_empaque_id: empaque.id, cantidad: STOCK_INICIAL })),
    ),
    { onConflict: 'sucursal_id,tipo_empaque_id' },
  )
  if (envasesError) throw new Error(`No fue posible normalizar stock_envases: ${envasesError.message}`)

  const { error: cargaError } = await admin.from('carga_vendedor').upsert(
    (['vendedor-a', 'vendedor-b'] as const).flatMap((key) =>
      productos.map((producto) => ({ vendedor_id: users[key].id, producto_id: producto.id, cantidad: CARGA_INICIAL })),
    ),
    { onConflict: 'vendedor_id,producto_id' },
  )
  if (cargaError) throw new Error(`No fue posible normalizar carga_vendedor: ${cargaError.message}`)

  // Restaura la ventana de ajuste al valor por defecto por si una corrida
  // anterior dejó una configuración distinta; el recorrido ya no la modifica.
  const { error: ventanaError } = await admin
    .from('configuracion')
    .delete()
    .eq('clave', 'ventana_ajuste_minutos')
  if (ventanaError) throw new Error(`No fue posible normalizar ventana_ajuste_minutos: ${ventanaError.message}`)
}

async function deleteBestEffort(admin: SupabaseClient, table: string, column: string, values: string[]): Promise<void> {
  try {
    await admin.from(table).delete().in(column, values)
  } catch {
    // Limpieza auxiliar: un fallo no debe hacer fracasar la corrida.
  }
}

export default async function setup(context: GlobalSetupContext): Promise<() => Promise<void>> {
  const env = resolveSupabaseEnv()
  const admin = createClient(env.url, env.serviceRoleKey, CLIENT_OPTIONS)
  const runId = randomUUID().slice(0, 8)

  const users = await createUsers(admin, runId)
  const { productos, empaques } = await loadCatalog(admin)
  await normalizeBalances(admin, productos, empaques, users)

  const fixtures: RecorridosFixtures = {
    runId,
    url: env.url,
    anonKey: env.anonKey,
    serviceRoleKey: env.serviceRoleKey,
    sucursales: SUCURSALES,
    users,
    productos,
    empaques,
  }
  context.provide('recorridos', fixtures)

  return async function teardown(): Promise<void> {
    const userIds = Object.values(users).map((user) => user.id)
    await deleteBestEffort(admin, 'gastos_extras', 'creado_por', userIds)
    await deleteBestEffort(admin, 'incidencias_produccion', 'creado_por', userIds)
    await deleteBestEffort(admin, 'ubicaciones_vendedores', 'vendedor_id', userIds)

    // Desactivar primero: la baja de Auth es soft delete y el perfil sobrevive.
    const { error: deactivateError } = await admin
      .from('perfiles')
      .update({ activo: false })
      .in('id', userIds)
    if (deactivateError) {
      console.warn(`[B5] no fue posible desactivar perfiles sintéticos: ${deactivateError.message}`)
    }

    for (const user of Object.values(users)) {
      const { error } = await admin.auth.admin.deleteUser(user.id, true)
      if (error) {
        console.warn(`[B5] no fue posible eliminar (soft delete) a ${user.key}: ${error.message}`)
      }
    }
  }
}
