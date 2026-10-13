// B5 / issue #43 — Recorrido 3: Producción contra Supabase local real.
// Producción suma stock (consumiendo envases retornables), la incidencia no
// toca saldos y la merma descuenta; la anulación compensa una sola vez.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { supabaseProxy } = await import('./support/registry')
  return { supabase: supabaseProxy }
})

import { inject } from 'vitest'
import {
  obtenerIncidencias,
  obtenerMermas,
  registrarIncidencia,
  registrarMerma,
  registrarProduccion,
} from '@/domains/produccion/api'
import { mensajeErrorSupabase } from '@/lib/errors'
import { createJourneyContext, stockEmpaque, stockProducto, type JourneyContext } from './support/context'

let ctx: JourneyContext

beforeAll(() => {
  ctx = createJourneyContext(inject('recorridos'))
})

afterAll(async () => {
  await ctx.dispose()
})

function productByName(nombre: string): string {
  const producto = ctx.fixtures.productos.find((item) => item.nombre === nombre)
  if (!producto) throw new Error(`Producto sintético no encontrado: ${nombre}`)
  return producto.id
}

function empaqueByName(nombre: string): string {
  const empaque = ctx.fixtures.empaques.find((item) => item.nombre === nombre)
  if (!empaque) throw new Error(`Empaque sintético no encontrado: ${nombre}`)
  return empaque.id
}

describe('Recorrido producción · registrar producción, incidencia y merma', () => {
  it('sube stock con la producción, consume envases y deja auditoría', async () => {
    const produccion = await ctx.actAs('produccion-a')
    const productoPol = productByName('Bidón POL')
    const empaqueRetornable = empaqueByName('Bidón Policarbonato')

    const stockAntes = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)
    const envasesAntes = await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.A, empaqueRetornable)

    const error = await registrarProduccion({
      sucursal_id: ctx.fixtures.sucursales.A,
      producto_id: productoPol,
      cantidad: 4,
      observaciones: `Producción B5 ${ctx.fixtures.runId}`,
      creado_por: produccion.user.id,
    })
    expect(error).toBeNull()

    const { data: produccionFila, error: produccionError } = await ctx.verifier
      .from('producciones')
      .select('id, sucursal_id, producto_id, cantidad, anulado, creado_por, empaque_consumido_id')
      .eq('creado_por', produccion.user.id)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()
    expect(produccionError).toBeNull()
    expect(produccionFila).toMatchObject({
      sucursal_id: ctx.fixtures.sucursales.A,
      producto_id: productoPol,
      cantidad: 4,
      anulado: false,
      creado_por: produccion.user.id,
      empaque_consumido_id: empaqueRetornable,
    })

    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntes + 4)
    expect(await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.A, empaqueRetornable)).toBe(envasesAntes - 4)

    const { data: auditoria, error: auditoriaError } = await ctx.verifier
      .from('auditoria')
      .select('accion, usuario_id')
      .eq('tabla', 'producciones')
      .eq('registro_id', produccionFila?.id)
    expect(auditoriaError).toBeNull()
    expect(auditoria).toEqual(
      expect.arrayContaining([expect.objectContaining({ accion: 'INSERT', usuario_id: produccion.user.id })]),
    )

    // La incidencia queda ligada a la producción y no mueve saldos.
    const stockAntesIncidencia = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)
    const descripcion = `Incidencia B5 ${ctx.fixtures.runId}`
    const incidenciaError = await registrarIncidencia({
      sucursal_id: ctx.fixtures.sucursales.A,
      produccion_id: produccionFila?.id as string,
      descripcion,
      creado_por: produccion.user.id,
    })
    expect(incidenciaError).toBeNull()
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntesIncidencia)

    const incidencias = await obtenerIncidencias(ctx.fixtures.sucursales.A)
    expect(incidencias.some((incidencia) => incidencia.descripcion === descripcion)).toBe(true)

    const { data: incidenciaFila } = await ctx.verifier
      .from('incidencias_produccion')
      .select('produccion_id, sucursal_id, creado_por')
      .eq('descripcion', descripcion)
      .single()
    expect(incidenciaFila).toMatchObject({
      produccion_id: produccionFila?.id,
      sucursal_id: ctx.fixtures.sucursales.A,
      creado_por: produccion.user.id,
    })

    // La merma de planta descuenta stock de bodega.
    const stockAntesMerma = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)
    const motivo = `Merma B5 ${ctx.fixtures.runId}`
    const mermaError = await registrarMerma({
      sucursal_id: ctx.fixtures.sucursales.A,
      producto_id: productoPol,
      tipo_empaque_id: null,
      despacho_id: null,
      cantidad: 2,
      motivo,
      creado_por: produccion.user.id,
    })
    expect(mermaError).toBeNull()
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntesMerma - 2)

    const mermas = await obtenerMermas(ctx.fixtures.sucursales.A)
    expect(mermas.some((merma) => merma.motivo === motivo)).toBe(true)
  })
})

describe('Recorrido producción · anulación de merma', () => {
  it('compensa el stock una sola vez y no permite reactivar', async () => {
    const productoPol = productByName('Bidón POL')
    const motivo = `Merma anulable B5 ${ctx.fixtures.runId}`

    const produccion = await ctx.actAs('produccion-a')
    const stockAntes = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)
    const mermaError = await registrarMerma({
      sucursal_id: ctx.fixtures.sucursales.A,
      producto_id: productoPol,
      tipo_empaque_id: null,
      despacho_id: null,
      cantidad: 3,
      motivo,
      creado_por: produccion.user.id,
    })
    expect(mermaError).toBeNull()
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntes - 3)

    const { data: merma, error: mermaFilaError } = await ctx.verifier
      .from('mermas')
      .select('id, anulado')
      .eq('motivo', motivo)
      .single()
    expect(mermaFilaError).toBeNull()

    // El contrato real solo permite anular mermas a administración: producción
    // no puede (la política RLS filtra la fila y no hay error de SQL).
    const intentoProduccion = await produccion.client
      .from('mermas')
      .update({ anulado: true })
      .eq('id', merma?.id)
      .select('id')
    expect(intentoProduccion.error).toBeNull()
    expect(intentoProduccion.data).toEqual([])
    const { data: trasIntento } = await ctx.verifier.from('mermas').select('anulado').eq('id', merma?.id).single()
    expect((trasIntento as { anulado: boolean }).anulado).toBe(false)
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntes - 3)

    // La anulación de administración compensa stock exactamente una vez.
    const admin = await ctx.actAs('admin-a')
    const anulacion = await admin.client.from('mermas').update({ anulado: true }).eq('id', merma?.id).select('id')
    expect(anulacion.error).toBeNull()
    expect(anulacion.data).toHaveLength(1)
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntes)

    const { data: auditoria } = await ctx.verifier
      .from('auditoria')
      .select('accion, usuario_id, motivo')
      .eq('tabla', 'mermas')
      .eq('registro_id', merma?.id)
    expect(auditoria).toEqual(
      expect.arrayContaining([expect.objectContaining({ accion: 'ANULACION', usuario_id: admin.user.id })]),
    )

    // Repetir la anulación no vuelve a compensar.
    const repetida = await admin.client.from('mermas').update({ anulado: true }).eq('id', merma?.id).select('id')
    expect(repetida.error).toBeNull()
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntes)

    // Reactivar un movimiento anulado está prohibido por integridad (B3).
    const reactivacion = await admin.client.from('mermas').update({ anulado: false }).eq('id', merma?.id)
    expect(reactivacion.error).not.toBeNull()
    expect(mensajeErrorSupabase(reactivacion.error)).toBe('No se puede reactivar un movimiento anulado.')
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntes)
  })
})
