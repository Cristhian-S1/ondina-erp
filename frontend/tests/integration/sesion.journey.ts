// B5 / issue #43 — Recorrido 6 (issue #36): aislamiento de sesión en el mismo
// cliente. Inicia sesión como A, crea y lee datos propios, cierra sesión e
// inicia como B: no queda visible ningún dato del usuario anterior.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { supabaseProxy } = await import('./support/registry')
  return { supabase: supabaseProxy }
})

import { inject } from 'vitest'
import { crearCliente, obtenerClientesRuta } from '@/domains/ventas/api'
import { createAnonClient } from './support/clients'
import { setActiveClient } from './support/registry'
import { createJourneyContext, type JourneyContext } from './support/context'

let ctx: JourneyContext

beforeAll(() => {
  ctx = createJourneyContext(inject('recorridos'))
})

afterAll(async () => {
  await ctx.dispose()
})

describe('Recorrido sesión · cambio de usuario en el mismo cliente', () => {
  it('sign in A → datos A; sign out → sin datos; sign in B → solo datos B', async () => {
    const session = createAnonClient(ctx.fixtures)
    setActiveClient(session)

    const sellerA = ctx.user('vendedor-a')
    const sellerB = ctx.user('vendedor-b')
    const nombreA = `Cliente sesión A ${ctx.fixtures.runId}`
    const nombreB = `Cliente sesión B ${ctx.fixtures.runId}`

    const loginA = await session.auth.signInWithPassword({ email: sellerA.email, password: sellerA.password })
    expect(loginA.error).toBeNull()

    const creadoA = await crearCliente({
      nombre: nombreA,
      direccion: 'Calle Sesión A',
      telefono: null,
      numero_local: null,
      tipo: 'minorista',
      vendedor_id: sellerA.id,
      sucursal_id: ctx.fixtures.sucursales.A,
      creado_por: sellerA.id,
    })
    expect(creadoA.error).toBeNull()
    const { data: filaA } = await ctx.verifier.from('clientes').select('id').eq('nombre', nombreA).single()
    const idA = (filaA as { id: string }).id

    const carteraA = await obtenerClientesRuta(ctx.perfil('vendedor-a'))
    expect(carteraA.map((cliente) => cliente.id)).toContain(idA)

    const { data: filasA } = await session.from('clientes').select('id, vendedor_id, nombre')
    expect((filasA ?? []).map((fila) => fila.id)).toContain(idA)
    for (const fila of filasA ?? []) {
      expect(fila.vendedor_id).toBe(sellerA.id)
    }

    const logout = await session.auth.signOut()
    expect(logout.error).toBeNull()
    const { data: sesionCerrada } = await session.auth.getSession()
    expect(sesionCerrada.session).toBeNull()

    // Sin sesión el cliente queda como anónimo: sin filas visibles.
    const sinSesion = await session.from('clientes').select('id')
    expect(sinSesion.error).not.toBeNull()
    expect(sinSesion.data ?? []).toEqual([])

    const loginB = await session.auth.signInWithPassword({ email: sellerB.email, password: sellerB.password })
    expect(loginB.error).toBeNull()

    const creadoB = await crearCliente({
      nombre: nombreB,
      direccion: 'Calle Sesión B',
      telefono: null,
      numero_local: null,
      tipo: 'minorista',
      vendedor_id: sellerB.id,
      sucursal_id: ctx.fixtures.sucursales.B,
      creado_por: sellerB.id,
    })
    expect(creadoB.error).toBeNull()
    const { data: filaB } = await ctx.verifier.from('clientes').select('id').eq('nombre', nombreB).single()
    const idB = (filaB as { id: string }).id

    const carteraB = await obtenerClientesRuta(ctx.perfil('vendedor-b'))
    expect(carteraB.map((cliente) => cliente.id)).toContain(idB)
    expect(carteraB.map((cliente) => cliente.id)).not.toContain(idA)

    // Ningún dato de A visible: todas las filas pertenecen a B.
    const { data: filasB } = await session.from('clientes').select('id, vendedor_id')
    expect((filasB ?? []).map((fila) => fila.id)).toContain(idB)
    expect((filasB ?? []).map((fila) => fila.id)).not.toContain(idA)
    for (const fila of filasB ?? []) {
      expect(fila.vendedor_id).toBe(sellerB.id)
    }

    const logoutFinal = await session.auth.signOut()
    expect(logoutFinal.error).toBeNull()
  })
})
