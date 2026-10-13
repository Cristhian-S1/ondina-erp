// B5 / issue #43 — Recorrido 4: Administración global contra Supabase local.
// Cambia de sucursal con los servicios de producción y ventas, crea un cliente
// para un vendedor de la otra sucursal y corrige una devolución con motivo.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { supabaseProxy } = await import('./support/registry')
  return { supabase: supabaseProxy }
})

import { inject } from 'vitest'
import { crearCliente, obtenerClientesRuta } from '@/domains/ventas/api'
import { corregirDevolucion, crearDespacho, registrarDevolucion } from '@/domains/bodega/api'
import { obtenerProducciones, registrarProduccion } from '@/domains/produccion/api'
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

describe('Recorrido administración global · cambio de sucursal', () => {
  it('registra producción en cada sucursal y solo la ve en la sucursal seleccionada', async () => {
    const admin = await ctx.actAs('admin-global')
    const productoPol = productByName('Bidón POL')
    const observacionesA = `Producción global A ${ctx.fixtures.runId}`
    const observacionesB = `Producción global B ${ctx.fixtures.runId}`

    const errorA = await registrarProduccion({
      sucursal_id: ctx.fixtures.sucursales.A,
      producto_id: productoPol,
      cantidad: 1,
      observaciones: observacionesA,
      creado_por: admin.user.id,
    })
    expect(errorA).toBeNull()
    const errorB = await registrarProduccion({
      sucursal_id: ctx.fixtures.sucursales.B,
      producto_id: productoPol,
      cantidad: 1,
      observaciones: observacionesB,
      creado_por: admin.user.id,
    })
    expect(errorB).toBeNull()

    const produccionA = await obtenerProducciones(ctx.fixtures.sucursales.A)
    const idsA = produccionA.map((fila) => fila.observaciones)
    expect(idsA).toContain(observacionesA)
    expect(idsA).not.toContain(observacionesB)

    const produccionB = await obtenerProducciones(ctx.fixtures.sucursales.B)
    const idsB = produccionB.map((fila) => fila.observaciones)
    expect(idsB).toContain(observacionesB)
    expect(idsB).not.toContain(observacionesA)
  })

  it('crea un cliente para el vendedor de la sucursal B y lo ve al seleccionarla', async () => {
    const admin = await ctx.actAs('admin-global')
    const vendedorB = ctx.user('vendedor-b')
    const nombre = `Cliente global B ${ctx.fixtures.runId}`

    const { error } = await crearCliente({
      nombre,
      direccion: 'Pasaje Sintético 456',
      telefono: null,
      numero_local: null,
      tipo: 'mayorista',
      vendedor_id: vendedorB.id,
      sucursal_id: ctx.fixtures.sucursales.B,
      creado_por: admin.user.id,
    })
    expect(error).toBeNull()

    const carteraB = await obtenerClientesRuta(admin.perfil, ctx.fixtures.sucursales.B, vendedorB.id)
    const creado = carteraB.find((cliente) => cliente.nombre === nombre)
    expect(creado).toBeDefined()
    expect(creado?.id).toBeTruthy()

    const carteraA = await obtenerClientesRuta(
      admin.perfil,
      ctx.fixtures.sucursales.A,
      ctx.user('vendedor-a').id,
    )
    expect(carteraA.map((cliente) => cliente.id)).not.toContain(creado?.id)

    const { data: auditoriaFila } = await ctx.verifier
      .from('clientes')
      .select('sucursal_id, vendedor_id, creado_por')
      .eq('nombre', nombre)
      .single()
    expect(auditoriaFila).toMatchObject({
      sucursal_id: ctx.fixtures.sucursales.B,
      vendedor_id: vendedorB.id,
      creado_por: admin.user.id,
    })
  })
})

describe('Recorrido administración global · corrección de devolución con motivo', () => {
  it('anula la devolución anterior, registra la corregida y ajusta saldos', async () => {
    const admin = await ctx.actAs('admin-global')
    const productoPol = productByName('Bidón POL')
    const empaqueRetornable = empaqueByName('Bidón Policarbonato')
    const vendedorB = ctx.user('vendedor-b')

    const { error: despachoError } = await crearDespacho({
      idempotency_key: crypto.randomUUID(),
      sucursal_id: ctx.fixtures.sucursales.B,
      vendedor_id: vendedorB.id,
      despachador_id: admin.user.id,
      creado_por: admin.user.id,
      lineas: [{ producto_id: productoPol, cantidad: 4 }],
      envases: [],
    })
    expect(despachoError).toBeNull()

    const { data: despacho, error: despachoFilaError } = await ctx.verifier
      .from('despachos')
      .select('id')
      .eq('despachador_id', admin.user.id)
      .eq('sucursal_id', ctx.fixtures.sucursales.B)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()
    expect(despachoFilaError).toBeNull()

    const stockAntes = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.B, productoPol)
    const cargaAntes = await cargaVendedor(ctx.verifier, vendedorB.id, productoPol)
    const envasesAntes = await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.B, empaqueRetornable)

    const { error: devolucionError } = await registrarDevolucion({
      despacho_id: despacho?.id as string,
      creado_por: admin.user.id,
      lineas_producto: [{ producto_id: productoPol, cantidad: 2 }],
      lineas_envase: [{ tipo_empaque_id: empaqueRetornable, cantidad: 1, estado: 'bueno' }],
      idempotency_key: crypto.randomUUID(),
    })
    expect(devolucionError).toBeNull()
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.B, productoPol)).toBe(stockAntes + 2)
    expect(await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.B, empaqueRetornable)).toBe(envasesAntes + 1)

    const motivo = `Corrección B5 ${ctx.fixtures.runId}`
    const { error: correccionError } = await corregirDevolucion({
      idempotency_key: crypto.randomUUID(),
      despacho_id: despacho?.id as string,
      creado_por: admin.user.id,
      motivo,
      lineas_producto: [{ producto_id: productoPol, cantidad: 1 }],
      lineas_envase: [{ tipo_empaque_id: empaqueRetornable, cantidad: 2, estado: 'bueno' }],
    })
    expect(correccionError).toBeNull()

    // Saldos netos: producto 1 y envases 2.
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.B, productoPol)).toBe(stockAntes + 1)
    expect(await cargaVendedor(ctx.verifier, vendedorB.id, productoPol)).toBe(cargaAntes - 1)
    expect(await stockEmpaque(ctx.verifier, ctx.fixtures.sucursales.B, empaqueRetornable)).toBe(envasesAntes + 2)

    const { data: devolucionesProducto, error: devolucionesError } = await ctx.verifier
      .from('devoluciones_productos')
      .select('id, cantidad, anulado, motivo')
      .eq('despacho_id', despacho?.id)
      .order('creado_en')
    expect(devolucionesError).toBeNull()
    expect(devolucionesProducto).toEqual([
      expect.objectContaining({ cantidad: 2, anulado: true, motivo }),
      expect.objectContaining({ cantidad: 1, anulado: false, motivo }),
    ])

    const { data: devolucionesEnvase } = await ctx.verifier
      .from('devoluciones_envases')
      .select('cantidad, estado, anulado, motivo')
      .eq('despacho_id', despacho?.id)
      .order('creado_en')
    expect(devolucionesEnvase).toEqual([
      expect.objectContaining({ cantidad: 1, estado: 'bueno', anulado: true, motivo }),
      expect.objectContaining({ cantidad: 2, estado: 'bueno', anulado: false, motivo }),
    ])

    const idsDevoluciones = (devolucionesProducto ?? []).map((fila) => (fila as { id: string }).id)
    const { data: auditoria, error: auditoriaError } = await ctx.verifier
      .from('auditoria')
      .select('registro_id, accion, usuario_id, motivo')
      .eq('tabla', 'devoluciones_productos')
      .in('registro_id', idsDevoluciones)
    expect(auditoriaError).toBeNull()
    expect(auditoria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          registro_id: idsDevoluciones[0],
          accion: 'ANULACION',
          usuario_id: admin.user.id,
          motivo,
        }),
      ]),
    )
  })
})
