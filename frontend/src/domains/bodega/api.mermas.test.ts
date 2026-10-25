import { beforeEach, describe, expect, it, vi } from 'vitest'
import { anularMermaBodega, mensajeErrorMerma, obtenerCuadreDiario, obtenerPaginaMermas, registrarMermaBodega } from './api'
import type { NuevaMerma } from './api'

const mock = vi.hoisted(() => {
  let rpcResult: { data: unknown; error: unknown } = { data: null, error: null }
  let rechazo: unknown = null
  let lecturaError: unknown = null
  const rpc = vi.fn()
  const llamadas: [string, unknown[]][] = []
  const query: Record<string, unknown> = {}
  for (const metodo of ['select', 'eq', 'is', 'not', 'order', 'range']) {
    query[metodo] = vi.fn((...args: unknown[]) => { llamadas.push([metodo, args]); return query })
  }
  query.returns = () => Promise.resolve({ data: [{ id: 'm-1' }], count: 41, error: lecturaError })
  rpc.mockImplementation(() => rechazo ? Promise.reject(rechazo) : Promise.resolve(rpcResult))
  return {
    supabase: { rpc, from: vi.fn(() => query) },
    llamadas,
    responder: (data: unknown, error: unknown = null) => { rpcResult = { data, error } },
    rechazar: (causa: unknown) => { rechazo = causa },
    fallarLectura: (causa: unknown) => { lecturaError = causa },
    reset: () => {
      rpcResult = { data: null, error: null }; rechazo = null; lecturaError = null
      rpc.mockClear(); llamadas.length = 0
    },
  }
})
vi.mock('../../lib/supabase', () => ({ supabase: mock.supabase }))
beforeEach(() => mock.reset())

const mermaBodega: NuevaMerma = {
  sucursal_id: 's-1', origen: 'bodega', despacho_id: null, producto_id: 'p-1', tipo_empaque_id: null,
  cantidad: 3, motivo: 'Se rompió',
}

describe('HU-29 · registrarMermaBodega', () => {
  it('invoca la RPC con los ocho argumentos exactos y null explícito en los ids sin uso', async () => {
    mock.responder('merma-1')
    const res = await registrarMermaBodega(mermaBodega, 'clave-1')
    expect(res).toEqual({ error: null, mermaId: 'merma-1' })
    expect(mock.supabase.rpc).toHaveBeenCalledWith('registrar_merma_bodega', {
      p_sucursal_id: 's-1', p_origen: 'bodega', p_despacho_id: null, p_producto_id: 'p-1',
      p_tipo_empaque_id: null, p_cantidad: 3, p_motivo: 'Se rompió', p_idempotency_key: 'clave-1',
    })
    const args = mock.supabase.rpc.mock.calls[0][1] as Record<string, unknown>
    expect(Object.keys(args)).toHaveLength(8)
    expect(args).toHaveProperty('p_despacho_id', null)
    expect(args).toHaveProperty('p_tipo_empaque_id', null)
  })

  it('envía el despacho y deja el envase en null para el origen despacho', async () => {
    mock.responder('merma-2')
    await registrarMermaBodega({ ...mermaBodega, origen: 'despacho', despacho_id: 'd-1' }, 'clave-2')
    expect(mock.supabase.rpc).toHaveBeenCalledWith('registrar_merma_bodega', expect.objectContaining({
      p_origen: 'despacho', p_despacho_id: 'd-1', p_producto_id: 'p-1', p_tipo_empaque_id: null,
    }))
  })

  it('envía el envase con producto null', async () => {
    mock.responder('merma-3')
    await registrarMermaBodega({ ...mermaBodega, producto_id: null, tipo_empaque_id: 'e-1' }, 'clave-3')
    expect(mock.supabase.rpc).toHaveBeenCalledWith('registrar_merma_bodega', expect.objectContaining({
      p_producto_id: null, p_tipo_empaque_id: 'e-1',
    }))
  })

  it('no inventa un id cuando la respuesta no es un UUID', async () => {
    mock.responder(null)
    expect(await registrarMermaBodega(mermaBodega, 'clave-1')).toEqual({ error: null, mermaId: null })
  })

  it.each([
    ['P0001', 'Indica el motivo de la merma.', 'Indica el motivo de la merma.'],
    ['P0001', 'Registra los envases dañados del despacho como devolución en estado malo.', 'Registra los envases dañados del despacho como devolución en estado malo.'],
    ['P0001', 'El producto no existe o está desactivado', 'El producto no existe o está desactivado.'],
    ['P0001', 'La clave de reintento pertenece a otra operación.', 'Este reintento pertenece a otra operación. Recarga la página e inténtalo de nuevo.'],
    ['P0001', 'Cantidad de merma superior al stock disponible. Disponible: 2', 'La cantidad de merma supera el stock disponible.'],
    ['P0001', 'La merma supera lo despachado pendiente de ese producto.', 'La merma supera lo despachado pendiente de ese producto.'],
    ['P0001', 'Stock o carga insuficiente para completar la operación.', 'No hay stock o carga suficiente para registrar la merma.'],
    ['42501', 'No tienes permisos para registrar mermas en esta sucursal.', 'No tienes permisos para registrar mermas en esta sucursal.'],
    ['22P02', 'invalid input syntax for type uuid: "x"', 'Revisa la cantidad, el producto y los datos ingresados.'],
    ['22003', 'value "99999999999" is out of range for type integer', 'Revisa la cantidad, el producto y los datos ingresados.'],
    ['P0001', 'detalle interno de SQL', 'No fue posible completar la operación. Inténtalo de nuevo.'],
    ['XX000', 'private detail', 'No fue posible completar la operación. Inténtalo de nuevo.'],
  ])('traduce %s «%s»', async (code, message, esperado) => {
    mock.responder(null, { code, message })
    expect((await registrarMermaBodega(mermaBodega, 'clave-1')).error).toBe(esperado)
  })

  it('traduce un rechazo de red sin filtrar detalles', async () => {
    mock.rechazar(new TypeError('Failed to fetch: https://privado'))
    expect(await registrarMermaBodega(mermaBodega, 'clave-1'))
      .toEqual({ error: 'No fue posible completar la operación. Inténtalo de nuevo.', mermaId: null })
  })
})

describe('HU-29 · anularMermaBodega', () => {
  it('invoca la RPC por id de merma sin clave de reintento', async () => {
    mock.responder('merma-1')
    expect(await anularMermaBodega('merma-1', 'Error de conteo')).toEqual({ error: null })
    expect(mock.supabase.rpc).toHaveBeenCalledWith('anular_merma_bodega', { p_merma_id: 'merma-1', p_motivo: 'Error de conteo' })
  })

  it.each([
    ['42501', 'Solo administración puede anular mermas.', 'Solo administración puede anular mermas.'],
    ['42501', 'No tienes permisos para anular esta merma.', 'No tienes permisos para anular esta merma.'],
    ['P0001', 'Indica el motivo de la anulación.', 'Indica el motivo de la anulación.'],
    ['P0001', 'La merma no existe.', 'La merma no existe.'],
  ])('traduce %s «%s»', async (code, message, esperado) => {
    mock.responder(null, { code, message })
    expect((await anularMermaBodega('merma-1', 'x')).error).toBe(esperado)
  })
})

describe('HU-29 · obtenerPaginaMermas', () => {
  it('lee las mermas de la sucursal, más recientes primero y paginadas', async () => {
    const pagina = await obtenerPaginaMermas('s-1', { pagina: 2, tamanoPagina: 20 })
    expect(pagina).toEqual({ filas: [{ id: 'm-1' }], total: 41 })
    expect(mock.supabase.from).toHaveBeenCalledWith('mermas')
    expect(mock.llamadas).toContainEqual(['eq', ['sucursal_id', 's-1']])
    expect(mock.llamadas).toContainEqual(['order', ['creado_en', { ascending: false }]])
    expect(mock.llamadas).toContainEqual(['range', [20, 39]])
  })

  it('filtra por origen y estado', async () => {
    await obtenerPaginaMermas('s-1', { pagina: 1, origen: 'bodega', anuladas: false })
    expect(mock.llamadas).toContainEqual(['is', ['despacho_id', null]])
    expect(mock.llamadas).toContainEqual(['eq', ['anulado', false]])
    mock.llamadas.length = 0
    await obtenerPaginaMermas('s-1', { pagina: 1, origen: 'despacho', anuladas: true })
    expect(mock.llamadas).toContainEqual(['not', ['despacho_id', 'is', null]])
    expect(mock.llamadas).toContainEqual(['eq', ['anulado', true]])
  })

  it('no consulta sin sucursal y traduce un fallo de lectura', async () => {
    expect(await obtenerPaginaMermas('', { pagina: 1 })).toEqual({ filas: [], total: 0 })
    expect(mock.supabase.from).not.toHaveBeenCalled()
    mock.fallarLectura({ message: 'private SQL detail' })
    await expect(obtenerPaginaMermas('s-1', { pagina: 1 })).rejects.toThrow('No fue posible completar la operación. Inténtalo de nuevo.')
  })
})

const filaBase = {
  sucursal_id: 's-1', vendedor_id: 'v-1', fecha: '2026-10-25', producto_id: 'p-1',
  despachado: 10, vendido: 4, devuelto: 2, mermas: 1, esperado_en_carga: 3,
  saldo_inicial: null, carga_actual: null, diferencia_carga: null, comparacion_disponible: false,
}

describe('HU-29 · obtenerCuadreDiario', () => {
  it('invoca la RPC con los argumentos exactos y p_vendedor_id null explícito', async () => {
    mock.responder([filaBase])
    const filas = await obtenerCuadreDiario('s-1', '2026-10-24', '2026-10-25', null)
    expect(mock.supabase.rpc).toHaveBeenCalledWith('cuadre_diario_bodega', {
      p_sucursal_id: 's-1', p_desde: '2026-10-24', p_hasta: '2026-10-25', p_vendedor_id: null,
    })
    expect(filas).toEqual([filaBase])
  })

  it('envía el vendedor cuando se filtra', async () => {
    mock.responder([])
    expect(await obtenerCuadreDiario('s-1', '2026-10-25', '2026-10-25', 'v-1')).toEqual([])
    expect(mock.supabase.rpc).toHaveBeenCalledWith('cuadre_diario_bodega', expect.objectContaining({ p_vendedor_id: 'v-1' }))
  })

  it('conserva las columnas de comparación cuando están disponibles y acepta bigint como texto', async () => {
    mock.responder([{ ...filaBase, despachado: '10', saldo_inicial: 7, carga_actual: '10', diferencia_carga: 0, comparacion_disponible: true }])
    const [fila] = await obtenerCuadreDiario('s-1', '2026-10-25', '2026-10-25', null)
    expect(fila).toMatchObject({ despachado: 10, saldo_inicial: 7, carga_actual: 10, diferencia_carga: 0, comparacion_disponible: true })
  })

  it.each([
    ['fuera del rango seguro', { despachado: 2 ** 53 }],
    ['texto fuera del rango seguro', { vendido: '9007199254740993' }],
    ['fraccionaria', { devuelto: 1.5 }],
    ['no numérica', { mermas: 'muchas' }],
    ['nula en una columna obligatoria', { esperado_en_carga: null }],
  ])('rechaza una cantidad %s', async (_nombre, cambio) => {
    mock.responder([{ ...filaBase, ...cambio }])
    await expect(obtenerCuadreDiario('s-1', '2026-10-25', '2026-10-25', null)).rejects.toThrow(/El cuadre trae una cantidad no válida/)
  })

  it('rechaza una fila con formato inesperado', async () => {
    mock.responder([{ ...filaBase, comparacion_disponible: 'si' }])
    await expect(obtenerCuadreDiario('s-1', '2026-10-25', '2026-10-25', null)).rejects.toThrow('El cuadre trae una fila con un formato inesperado.')
  })

  it.each([
    ['No tienes permisos para consultar este cuadre.', '42501'],
    ['Indica un rango válido de hasta 31 días, sin fechas futuras.', 'P0001'],
    ['El vendedor no pertenece a esta sucursal.', 'P0001'],
  ])('traduce «%s»', async (message, code) => {
    mock.responder(null, { code, message })
    await expect(obtenerCuadreDiario('s-1', '2026-10-25', '2026-10-25', null)).rejects.toThrow(message)
  })

  it('no filtra detalles internos', async () => {
    mock.responder(null, { code: 'XX000', message: 'private detail' })
    await expect(obtenerCuadreDiario('s-1', '2026-10-25', '2026-10-25', null)).rejects.toThrow('No fue posible completar la operación. Inténtalo de nuevo.')
  })
})

describe('HU-29 · mensajeErrorMerma', () => {
  it('devuelve el mensaje genérico para valores que no son errores', () => {
    expect(mensajeErrorMerma(undefined)).toBe('No fue posible completar la operación. Inténtalo de nuevo.')
    expect(mensajeErrorMerma('boom')).toBe('No fue posible completar la operación. Inténtalo de nuevo.')
  })
})
