// B5 / issue #43 — Recorrido 1: Vendedor contra Supabase local real.
// Ejerce los servicios reales de `@/domains/ventas/api` autenticado como el
// usuario sintético del setup; afirma el estado con el cliente verificador.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { supabaseProxy } = await import('./support/registry')
  return { supabase: supabaseProxy }
})

import { inject } from 'vitest'
import {
  crearCliente,
  crearGasto,
  obtenerCantidadVentasJornada,
  obtenerCargaVendedor,
  obtenerClientesRuta,
  obtenerGastosHoy,
  obtenerMiComision,
  obtenerRankingVendedores,
  registrarVenta,
} from '@/domains/ventas/api'
import { cargaVendedor, createJourneyContext, stockProducto, type JourneyContext } from './support/context'

const ID_CLIENTE_SEED_B = '50000000-0000-0000-0000-000000000002'

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

function jornadaSantiago(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())
}

describe('Recorrido vendedor · HU-02 registrar cliente', () => {
  it('crea el cliente para el propio vendedor y lo ve en su cartera', async () => {
    const seller = await ctx.actAs('vendedor-a')
    const nombre = `Cliente B5 ${ctx.fixtures.runId} ruta`
    const { error } = await crearCliente({
      nombre,
      direccion: 'Calle Sintética 123',
      telefono: '+56900000000',
      numero_local: '12',
      tipo: 'minorista',
      vendedor_id: seller.user.id,
      sucursal_id: ctx.fixtures.sucursales.A,
      creado_por: seller.user.id,
    })
    expect(error).toBeNull()

    const { data: fila, error: filaError } = await ctx.verifier
      .from('clientes')
      .select('id, vendedor_id, sucursal_id, creado_por, activo, nombre')
      .eq('nombre', nombre)
      .single()
    expect(filaError).toBeNull()
    expect(fila).toMatchObject({
      vendedor_id: seller.user.id,
      sucursal_id: ctx.fixtures.sucursales.A,
      creado_por: seller.user.id,
      activo: true,
    })

    const cartera = await obtenerClientesRuta(seller.perfil)
    expect(cartera.map((cliente) => cliente.id)).toContain(fila?.id)
    expect(cartera.map((cliente) => cliente.id)).not.toContain(ID_CLIENTE_SEED_B)
  })
})

describe('Recorrido vendedor · HU-01 registrar venta', () => {
  it('descuenta carga, guarda total y deja auditoría; el reintento no duplica', async () => {
    const seller = await ctx.actAs('vendedor-a')
    const productoId = productByName('Bidón POL')

    const { data: cliente, error: clienteError } = await ctx.verifier
      .from('clientes')
      .select('id')
      .eq('vendedor_id', seller.user.id)
      .eq('nombre', `Cliente B5 ${ctx.fixtures.runId} ruta`)
      .single()
    expect(clienteError).toBeNull()

    const cargaAntes = await cargaVendedor(ctx.verifier, seller.user.id, productoId)
    const stockAntes = await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoId)
    const idempotencyKey = crypto.randomUUID()

    const venta = await registrarVenta({
      p_cliente_id: cliente?.id as string,
      p_metodo_pago: 'efectivo',
      p_detalles: [{ producto_id: productoId, cantidad: 2, precio_unitario: 1000, envases_recibidos: 0 }],
      p_descuento: 100,
      p_observaciones: 'Venta B5',
      p_idempotency_key: idempotencyKey,
    })
    expect(venta.error).toBeNull()
    expect(venta.id).toBeTruthy()

    const { data: ventaFila, error: ventaError } = await ctx.verifier
      .from('ventas')
      .select('id, sucursal_id, vendedor_id, cliente_id, metodo_pago, descuento, total, creado_por, anulado')
      .eq('id', venta.id)
      .single()
    expect(ventaError).toBeNull()
    expect(ventaFila).toMatchObject({
      sucursal_id: ctx.fixtures.sucursales.A,
      vendedor_id: seller.user.id,
      cliente_id: cliente?.id,
      metodo_pago: 'efectivo',
      anulado: false,
      creado_por: seller.user.id,
    })
    expect(Number((ventaFila as { descuento: number }).descuento)).toBe(100)
    expect(Number((ventaFila as { total: number }).total)).toBe(1900)

    const { data: detalle, error: detalleError } = await ctx.verifier
      .from('venta_detalles')
      .select('cantidad, precio_unitario, subtotal, envases_recibidos')
      .eq('venta_id', venta.id)
      .single()
    expect(detalleError).toBeNull()
    expect(detalle).toMatchObject({ cantidad: 2, envases_recibidos: 0 })
    expect(Number((detalle as { subtotal: number }).subtotal)).toBe(2000)

    expect(await cargaVendedor(ctx.verifier, seller.user.id, productoId)).toBe(cargaAntes - 2)
    expect(await stockProducto(ctx.verifier, ctx.fixtures.sucursales.A, productoId)).toBe(stockAntes)

    const { data: auditoria, error: auditoriaError } = await ctx.verifier
      .from('auditoria')
      .select('accion, usuario_id')
      .eq('tabla', 'ventas')
      .eq('registro_id', venta.id)
    expect(auditoriaError).toBeNull()
    expect(auditoria).toEqual(
      expect.arrayContaining([expect.objectContaining({ accion: 'INSERT', usuario_id: seller.user.id })]),
    )

    // Reintento con la misma clave: mismo id, una sola venta y sin nuevo movimiento.
    const reintento = await registrarVenta({
      p_cliente_id: cliente?.id as string,
      p_metodo_pago: 'efectivo',
      p_detalles: [{ producto_id: productoId, cantidad: 2, precio_unitario: 1000, envases_recibidos: 0 }],
      p_descuento: 100,
      p_observaciones: 'Venta B5',
      p_idempotency_key: idempotencyKey,
    })
    expect(reintento.error).toBeNull()
    expect(reintento.id).toBe(venta.id)

    const { data: ventasConClave, error: conteoError } = await ctx.verifier
      .from('ventas')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
    expect(conteoError).toBeNull()
    expect(ventasConClave).toHaveLength(1)
    expect(await cargaVendedor(ctx.verifier, seller.user.id, productoId)).toBe(cargaAntes - 2)
  })

  it('rechaza vender a un cliente que no pertenece a su cartera', async () => {
    await ctx.actAs('vendedor-a')
    const productoId = productByName('Bidón POL')
    const resultado = await registrarVenta({
      p_cliente_id: ID_CLIENTE_SEED_B,
      p_metodo_pago: 'efectivo',
      p_detalles: [{ producto_id: productoId, cantidad: 1, precio_unitario: 1000, envases_recibidos: 0 }],
      p_descuento: 0,
      p_observaciones: undefined,
      p_idempotency_key: crypto.randomUUID(),
    })
    expect(resultado.id).toBeNull()
    expect(resultado.error).toBe('El cliente no pertenece a tu cartera o sucursal.')
  })
})

describe('Recorrido vendedor · HU-07 gasto del día', () => {
  it('registra el gasto y aparece en los gastos de hoy', async () => {
    const seller = await ctx.actAs('vendedor-a')
    const motivo = `Peaje B5 ${ctx.fixtures.runId}`
    const { error } = await crearGasto({
      tipo: 'combustible',
      monto: 5000,
      motivo,
      vendedor_id: seller.user.id,
      sucursal_id: ctx.fixtures.sucursales.A,
      creado_por: seller.user.id,
    })
    expect(error).toBeNull()

    const { data: gasto, error: gastoError } = await ctx.verifier
      .from('gastos_extras')
      .select('id, monto, tipo, motivo, vendedor_id, creado_por, anulado')
      .eq('motivo', motivo)
      .single()
    expect(gastoError).toBeNull()
    expect(Number((gasto as { monto: number }).monto)).toBe(5000)
    expect(gasto).toMatchObject({
      tipo: 'combustible',
      vendedor_id: seller.user.id,
      creado_por: seller.user.id,
      anulado: false,
    })

    const gastosHoy = await obtenerGastosHoy(seller.perfil)
    expect(gastosHoy.map((item) => item.id)).toContain(gasto?.id)
  })
})

describe('Recorrido vendedor · HU-09 comisión y HU-08 ranking (jornada Santiago)', () => {
  it('lee la carga, la comisión de la jornada y el ranking del mes', async () => {
    const seller = await ctx.actAs('vendedor-a')
    const productoId = productByName('Bidón POL')

    const carga = await obtenerCargaVendedor(seller.perfil)
    const filaCarga = carga.find((item) => item.producto_id === productoId)
    expect(filaCarga).toBeDefined()
    expect(filaCarga?.producto?.nombre).toBe('Bidón POL')

    const comisiones = await obtenerMiComision(seller.user.id)
    const agua = comisiones.find((item) => item.jornada === jornadaSantiago() && item.tipo === 'agua')
    expect(agua).toBeDefined()
    expect(Number(agua?.base_comision)).toBe(1900)
    expect(Number(agua?.ventas_del_tipo)).toBe(1)
    expect(Number(agua?.comision)).toBe(0)

    expect(await obtenerCantidadVentasJornada(seller.user.id)).toBe(1)

    const mes = jornadaSantiago().slice(0, 7)
    const ranking = await obtenerRankingVendedores(mes)
    const fila = ranking.find((item) => item.vendedor_id === seller.user.id)
    expect(fila).toBeDefined()
    expect(Number(fila?.cantidad_ventas)).toBe(1)
    expect(Number(fila?.total_vendido)).toBe(1900)
  })
})

describe('Recorrido vendedor · aislamiento por vendedor y sucursal', () => {
  it('no ve clientes, ventas ni carga de otro vendedor ni de otra sucursal', async () => {
    const seller = await ctx.actAs('vendedor-a')
    const vendedorB = ctx.user('vendedor-b')

    const { data: clientesAjenos, error: clientesError } = await seller.client
      .from('clientes')
      .select('id')
      .eq('vendedor_id', vendedorB.id)
    expect(clientesError).toBeNull()
    expect(clientesAjenos).toEqual([])

    const { data: clientesOtraSucursal, error: otraSucursalError } = await seller.client
      .from('clientes')
      .select('id')
      .eq('sucursal_id', ctx.fixtures.sucursales.B)
    expect(otraSucursalError).toBeNull()
    expect(clientesOtraSucursal).toEqual([])

    const { data: cargaAjena } = await seller.client
      .from('carga_vendedor')
      .select('vendedor_id')
      .eq('vendedor_id', vendedorB.id)
    expect(cargaAjena).toEqual([])

    const { data: ventas } = await seller.client.from('ventas').select('vendedor_id')
    for (const venta of ventas ?? []) {
      expect(venta.vendedor_id).toBe(seller.user.id)
    }
  })
})
