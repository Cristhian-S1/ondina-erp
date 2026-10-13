// B5 / issue #43 — Recorrido 5: controles negativos contra Supabase local.
// Perfiles inactivos, anónimos y roles ajenos no obtienen datos ni escrituras;
// los mensajes en español salen del catálogo real de `@/lib/errors`.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { supabaseProxy } = await import('./support/registry')
  return { supabase: supabaseProxy }
})

import { inject } from 'vitest'
import { crearGasto, obtenerClientesRuta, registrarVenta } from '@/domains/ventas/api'
import { corregirDevolucion, crearDespacho, registrarDevolucion } from '@/domains/bodega/api'
import { createAnonClient } from './support/clients'
import { createJourneyContext, type JourneyContext } from './support/context'

let ctx: JourneyContext

beforeAll(() => {
  ctx = createJourneyContext(inject('recorridos'))
})

afterAll(async () => {
  await ctx.dispose()
})

describe('Controles negativos · perfil inactivo', () => {
  it('no lee datos ni puede escribir, aunque su sesión de Auth exista', async () => {
    const inactivo = await ctx.actAs('vendedor-inactivo-a')

    const cartera = await obtenerClientesRuta(inactivo.perfil)
    expect(cartera).toEqual([])

    const motivo = `Gasto inactivo B5 ${ctx.fixtures.runId}`
    const gasto = await crearGasto({
      tipo: 'otra',
      monto: 1000,
      motivo,
      vendedor_id: inactivo.user.id,
      sucursal_id: ctx.fixtures.sucursales.A,
      creado_por: inactivo.user.id,
    })
    expect(gasto.error).toBe('No tienes permisos para realizar esta acción.')

    const venta = await registrarVenta({
      p_cliente_id: '50000000-0000-0000-0000-000000000001',
      p_metodo_pago: 'efectivo',
      p_detalles: [
        { producto_id: ctx.fixtures.productos[0].id, cantidad: 1, precio_unitario: 1000, envases_recibidos: 0 },
      ],
      p_descuento: 0,
      p_observaciones: undefined,
      p_idempotency_key: crypto.randomUUID(),
    })
    expect(venta.id).toBeNull()
    expect(venta.error).toBe('No tienes permisos para registrar ventas.')

    const { data: gastosCreados } = await ctx.verifier.from('gastos_extras').select('id').eq('motivo', motivo)
    expect(gastosCreados).toEqual([])
  })
})

describe('Controles negativos · anónimo', () => {
  it('no obtiene datos ni escrituras y los RPC están revocados', async () => {
    const anon = createAnonClient(ctx.fixtures)

    const lectura = await anon.from('clientes').select('id')
    expect(lectura.error).not.toBeNull()
    expect(lectura.data).toBeNull()

    const vista = await anon.from('v_ranking_vendedores').select('*')
    expect(vista.error).not.toBeNull()

    const escritura = await anon.from('clientes').insert({
      nombre: 'Cliente anónimo B5',
      direccion: 'Calle Anónima',
      tipo: 'minorista',
      vendedor_id: ctx.user('vendedor-a').id,
      sucursal_id: ctx.fixtures.sucursales.A,
      creado_por: ctx.user('vendedor-a').id,
      activo: true,
    })
    expect(escritura.error).not.toBeNull()

    const rpc = await anon.rpc('registrar_venta', {
      p_cliente_id: '50000000-0000-0000-0000-000000000001',
      p_metodo_pago: 'efectivo',
      p_detalles: [],
      p_descuento: 0,
      p_observaciones: null,
      p_idempotency_key: crypto.randomUUID(),
    })
    expect(rpc.error).not.toBeNull()
  })
})

describe('Controles negativos · vendedor llamando RPC de bodega', () => {
  it('recibe los mensajes en español del catálogo de errores', async () => {
    const seller = await ctx.actAs('vendedor-a')
    const productoPol = ctx.fixtures.productos.find((item) => item.nombre === 'Bidón POL')?.id as string

    const despacho = await crearDespacho({
      idempotency_key: crypto.randomUUID(),
      sucursal_id: ctx.fixtures.sucursales.A,
      vendedor_id: seller.user.id,
      despachador_id: seller.user.id,
      creado_por: seller.user.id,
      lineas: [{ producto_id: productoPol, cantidad: 1 }],
      envases: [],
    })
    expect(despacho.error).toBe('No tienes permisos para crear despachos en esta sucursal.')

    const devolucion = await registrarDevolucion({
      despacho_id: crypto.randomUUID(),
      creado_por: seller.user.id,
      lineas_producto: [{ producto_id: productoPol, cantidad: 1 }],
      lineas_envase: [],
      idempotency_key: crypto.randomUUID(),
    })
    expect(devolucion.error).toBe('No tienes permisos para registrar devoluciones.')

    const correccion = await corregirDevolucion({
      despacho_id: crypto.randomUUID(),
      creado_por: seller.user.id,
      motivo: 'Intento de vendedor',
      lineas_producto: [],
      lineas_envase: [],
    })
    expect(correccion.error).toBe('Solo administración puede corregir devoluciones.')
  })

  it('el administrador de otra sucursal no crea despachos ni corrige allá', async () => {
    const adminA = await ctx.actAs('admin-a')
    const productoPol = ctx.fixtures.productos.find((item) => item.nombre === 'Bidón POL')?.id as string

    // Despacho y devolución reales en A para probar la corrección ajena.
    const { error: despachoError } = await crearDespacho({
      idempotency_key: crypto.randomUUID(),
      sucursal_id: ctx.fixtures.sucursales.A,
      vendedor_id: ctx.user('vendedor-a').id,
      despachador_id: adminA.user.id,
      creado_por: adminA.user.id,
      lineas: [{ producto_id: productoPol, cantidad: 2 }],
      envases: [],
    })
    expect(despachoError).toBeNull()
    const { data: despacho } = await ctx.verifier
      .from('despachos')
      .select('id')
      .eq('despachador_id', adminA.user.id)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()
    const { error: devolucionError } = await registrarDevolucion({
      despacho_id: despacho?.id as string,
      creado_por: adminA.user.id,
      lineas_producto: [{ producto_id: productoPol, cantidad: 1 }],
      lineas_envase: [],
      idempotency_key: crypto.randomUUID(),
    })
    expect(devolucionError).toBeNull()

    const adminB = await ctx.actAs('admin-b')
    const crear = await crearDespacho({
      idempotency_key: crypto.randomUUID(),
      sucursal_id: ctx.fixtures.sucursales.A,
      vendedor_id: ctx.user('vendedor-a').id,
      despachador_id: adminB.user.id,
      creado_por: adminB.user.id,
      lineas: [{ producto_id: productoPol, cantidad: 1 }],
      envases: [],
    })
    expect(crear.error).toBe('No tienes permisos para crear despachos en esta sucursal.')

    const { data: devolucionesAntes } = await ctx.verifier
      .from('devoluciones_productos')
      .select('id, anulado, cantidad')
      .eq('despacho_id', despacho?.id)
    const corregir = await corregirDevolucion({
      despacho_id: despacho?.id as string,
      creado_por: adminB.user.id,
      motivo: 'Corrección ajena',
      lineas_producto: [{ producto_id: productoPol, cantidad: 2 }],
      lineas_envase: [],
    })
    expect(corregir.error).toBe('No tienes permisos para corregir devoluciones de esta sucursal.')

    const { data: devolucionesDespues } = await ctx.verifier
      .from('devoluciones_productos')
      .select('id, anulado, cantidad')
      .eq('despacho_id', despacho?.id)
    expect(devolucionesDespues).toEqual(devolucionesAntes)
  })
})
