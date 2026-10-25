// B5 / issue #43 — Recorrido 2: Bodega contra Supabase local real.
// Despacho, devolución atómica de productos y envases, topes y controles de
// sucursal/GPS con el cliente autenticado real. La expiración de la ventana de
// ajuste se prueba en pgTAP (007/008): la API no puede fabricar un despacho
// vencido porque el INSERT sella `creado_en` y los triggers blindan el historial.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { supabaseProxy } = await import('./support/registry')
  return { supabase: supabaseProxy }
})

import { inject } from 'vitest'
import { crearDespacho, obtenerDespachos, registrarDevolucion } from '@/domains/bodega/api'
import { cargaVendedor, createJourneyContext, stockEmpaque, stockProducto, type JourneyContext } from './support/context'

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

describe('Recorrido bodega · HU-06 crear despacho', () => {
  it('mueve stock a la carga del vendedor y deja auditoría', async () => {
    const bodega = await ctx.actAs('bodega-a')
    const productoPol = productByName('Bidón POL')
    const productoCubo = productByName('Hielo CUBO')
    const empaqueInterno = empaqueByName('Caja Interna Sintética')

    const stockPolAntes = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)
    const stockCuboAntes = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoCubo)
    const stockEmpaqueAntes = await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.A, empaqueInterno)
    const cargaPolAntes = await cargaVendedor(ctx.verifier, ctx.user('vendedor-a').id, productoPol)
    const cargaCuboAntes = await cargaVendedor(ctx.verifier, ctx.user('vendedor-a').id, productoCubo)

    const { error } = await crearDespacho({
      idempotency_key: crypto.randomUUID(),
      sucursal_id: ctx.fixtures.sucursales.A,
      vendedor_id: ctx.user('vendedor-a').id,
      despachador_id: bodega.user.id,
      creado_por: bodega.user.id,
      lineas: [
        { producto_id: productoPol, cantidad: 5 },
        { producto_id: productoCubo, cantidad: 3 },
      ],
      envases: [{ tipo_empaque_id: empaqueInterno, cantidad: 2 }],
    })
    expect(error).toBeNull()

    const { data: despacho, error: despachoError } = await ctx.verifier
      .from('despachos')
      .select('id, sucursal_id, vendedor_id, despachador_id, creado_por, anulado')
      .eq('sucursal_id', ctx.fixtures.sucursales.A)
      .eq('vendedor_id', ctx.user('vendedor-a').id)
      .eq('despachador_id', bodega.user.id)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()
    expect(despachoError).toBeNull()
    expect(despacho).toMatchObject({ anulado: false, creado_por: bodega.user.id })

    const { data: detalles, error: detallesError } = await ctx.verifier
      .from('despacho_detalles')
      .select('producto_id, cantidad')
      .eq('despacho_id', despacho?.id)
    expect(detallesError).toBeNull()
    expect(detalles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ producto_id: productoPol, cantidad: 5 }),
        expect.objectContaining({ producto_id: productoCubo, cantidad: 3 }),
      ]),
    )

    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockPolAntes - 5)
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoCubo)).toBe(stockCuboAntes - 3)
    expect(await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.A, empaqueInterno)).toBe(stockEmpaqueAntes - 2)
    expect(await cargaVendedor(ctx.verifier, ctx.user('vendedor-a').id, productoPol)).toBe(cargaPolAntes + 5)
    expect(await cargaVendedor(ctx.verifier, ctx.user('vendedor-a').id, productoCubo)).toBe(cargaCuboAntes + 3)

    const { data: auditoria, error: auditoriaError } = await ctx.verifier
      .from('auditoria')
      .select('accion, usuario_id')
      .eq('tabla', 'despachos')
      .eq('registro_id', despacho?.id)
    expect(auditoriaError).toBeNull()
    expect(auditoria).toEqual(
      expect.arrayContaining([expect.objectContaining({ accion: 'INSERT', usuario_id: bodega.user.id })]),
    )
  })
})

describe('Recorrido bodega · HU-33 devolución atómica de productos y envases', () => {
  it('devuelve productos y envases en una sola operación y no duplica con la misma clave', async () => {
    const bodega = await ctx.actAs('bodega-a')
    const productoPol = productByName('Bidón POL')
    const empaqueRetornable = empaqueByName('Bidón Policarbonato')

    const { data: despacho, error: despachoError } = await ctx.verifier
      .from('despachos')
      .select('id')
      .eq('despachador_id', bodega.user.id)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()
    expect(despachoError).toBeNull()

    const stockAntes = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)
    const cargaAntes = await cargaVendedor(ctx.verifier, ctx.user('vendedor-a').id, productoPol)
    const envasesAntes = await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.A, empaqueRetornable)
    const idempotencyKey = crypto.randomUUID()

    const { error } = await registrarDevolucion({
      despacho_id: despacho?.id as string,
      creado_por: bodega.user.id,
      lineas_producto: [{ producto_id: productoPol, cantidad: 2 }],
      lineas_envase: [{ tipo_empaque_id: empaqueRetornable, cantidad: 1, estado: 'bueno' }],
      idempotency_key: idempotencyKey,
    })
    expect(error).toBeNull()

    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntes + 2)
    expect(await cargaVendedor(ctx.verifier, ctx.user('vendedor-a').id, productoPol)).toBe(cargaAntes - 2)
    expect(await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.A, empaqueRetornable)).toBe(envasesAntes + 1)

    const { data: devolucionProducto, error: devolucionError } = await ctx.verifier
      .from('devoluciones_productos')
      .select('cantidad, creado_por, anulado, motivo')
      .eq('despacho_id', despacho?.id)
      .eq('producto_id', productoPol)
    expect(devolucionError).toBeNull()
    expect(devolucionProducto).toEqual([
      expect.objectContaining({ cantidad: 2, creado_por: bodega.user.id, anulado: false }),
    ])

    const { data: devolucionEnvase, error: envaseError } = await ctx.verifier
      .from('devoluciones_envases')
      .select('cantidad, estado, creado_por, anulado')
      .eq('despacho_id', despacho?.id)
      .eq('tipo_empaque_id', empaqueRetornable)
    expect(envaseError).toBeNull()
    expect(devolucionEnvase).toEqual([
      expect.objectContaining({ cantidad: 1, estado: 'bueno', creado_por: bodega.user.id, anulado: false }),
    ])

    // Reintento idempotente: misma clave, mismo resultado, sin doble movimiento.
    const reintento = await registrarDevolucion({
      despacho_id: despacho?.id as string,
      creado_por: bodega.user.id,
      lineas_producto: [{ producto_id: productoPol, cantidad: 2 }],
      lineas_envase: [{ tipo_empaque_id: empaqueRetornable, cantidad: 1, estado: 'bueno' }],
      idempotency_key: idempotencyKey,
    })
    expect(reintento.error).toBeNull()

    const { data: devolucionesPol } = await ctx.verifier
      .from('devoluciones_productos')
      .select('id')
      .eq('despacho_id', despacho?.id)
      .eq('producto_id', productoPol)
    expect(devolucionesPol).toHaveLength(1)
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntes + 2)
    expect(await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.A, empaqueRetornable)).toBe(envasesAntes + 1)
  })

  it('no permite devolver más de lo despachado y no altera la base', async () => {
    const bodega = await ctx.actAs('bodega-a')
    const productoPol = productByName('Bidón POL')

    const { data: despacho, error: despachoError } = await ctx.verifier
      .from('despachos')
      .select('id')
      .eq('despachador_id', bodega.user.id)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()
    expect(despachoError).toBeNull()

    const stockAntes = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)
    const cargaAntes = await cargaVendedor(ctx.verifier, ctx.user('vendedor-a').id, productoPol)
    const { data: devolucionesAntes } = await ctx.verifier
      .from('devoluciones_productos')
      .select('id')
      .eq('despacho_id', despacho?.id)

    // Despachado 5, devuelto 2: pedir 4 excede lo despachado.
    const { error } = await registrarDevolucion({
      despacho_id: despacho?.id as string,
      creado_por: bodega.user.id,
      lineas_producto: [{ producto_id: productoPol, cantidad: 4 }],
      lineas_envase: [],
      idempotency_key: crypto.randomUUID(),
    })
    expect(error).toBe('No se puede devolver más de lo despachado.')

    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoPol)).toBe(stockAntes)
    expect(await cargaVendedor(ctx.verifier, ctx.user('vendedor-a').id, productoPol)).toBe(cargaAntes)
    const { data: devolucionesDespues } = await ctx.verifier
      .from('devoluciones_productos')
      .select('id')
      .eq('despacho_id', despacho?.id)
    expect(devolucionesDespues).toHaveLength(devolucionesAntes?.length ?? 0)
  })
})

// La expiración de la ventana de ajuste se cubre en la base de datos con pgTAP:
// supabase/tests/007_hu26_ajustar_despacho.test.sql y
// supabase/tests/008_hu26_ventana_ajuste.test.sql prueban que el rechazo
// 'La ventana de ajuste del despacho expiró.' no altera stock ni líneas.
// Este recorrido no puede fabricar un despacho vencido por la API:
// trg_fecha_despacho_b2 sella `creado_en` en el INSERT y
// private.proteger_movimiento impide editarlo; además el CHECK 5..60 ya no
// admite forzar la ventana con un valor inválido.

describe('Recorrido bodega · límites de sucursal y GPS', () => {
  it('no ve despachos de otra sucursal ni puede crearlos allí', async () => {
    const bodega = await ctx.actAs('bodega-a')
    const despachosB = await obtenerDespachos(ctx.fixtures.sucursales.B)
    expect(despachosB).toEqual([])

    const { error } = await crearDespacho({
      idempotency_key: crypto.randomUUID(),
      sucursal_id: ctx.fixtures.sucursales.B,
      vendedor_id: ctx.user('vendedor-b').id,
      despachador_id: bodega.user.id,
      creado_por: bodega.user.id,
      lineas: [{ producto_id: productByName('Bidón POL'), cantidad: 1 }],
      envases: [],
    })
    expect(error).toBe('No tienes permisos para crear despachos en esta sucursal.')
  })

  it('no puede leer la ubicación GPS del vendedor', async () => {
    const seller = await ctx.actAs('vendedor-a')
    const { error: gpsInsertError } = await seller.client
      .from('ubicaciones_vendedores')
      .insert({ vendedor_id: seller.user.id, latitud: -33.45, longitud: -70.66 })
    expect(gpsInsertError).toBeNull()

    const bodega = await ctx.actAs('bodega-a')
    const { data, error } = await bodega.client.from('ubicaciones_vendedores').select('id, vendedor_id')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
