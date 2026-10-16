import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock del cliente Supabase compartido para los servicios del dominio bodega.
const mock = vi.hoisted(() => {
  let readError: { message: string } | null = null
  let dataByTable: Record<string, unknown[]> = {}
  let lastQueryByTable: Record<string, Record<string, unknown>> = {}
  let insertResult: { error: { message: string; code?: string } | null } = { error: null }
  let rpcResult: { data: unknown; error: { message: string; code?: string } | null } = {
    data: null,
    error: null,
  }
  const insertSpy = vi.fn()
  const rpcSpy = vi.fn()

  function build(table: string) {
    const q: Record<string, unknown> = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      in: vi.fn(() => q),
      order: vi.fn(() => q),
      range: vi.fn(() => q),
      gte: vi.fn(() => q),
      lt: vi.fn(() => q),
      insert: (payload: unknown) => {
        insertSpy(payload)
        return Promise.resolve(insertResult)
      },
      returns: () => Promise.resolve({ data: dataByTable[table] ?? [], count: 301, error: readError }),
    }
    lastQueryByTable[table] = q
    return q
  }

  const supabaseMock = {
    from: vi.fn((table: string) => build(table)),
    rpc: vi.fn((fn: string, args: unknown) => {
      rpcSpy(fn, args)
      return Promise.resolve(rpcResult)
    }),
  }

  return {
    supabase: supabaseMock,
    insertSpy,
    rpcSpy,
    setReadError: () => { readError = { message: 'private SQL detail' } },
    reset: () => {
      readError = null
      dataByTable = {}
      lastQueryByTable = {}
      insertResult = { error: null }
      rpcResult = { data: null, error: null }
      insertSpy.mockClear()
      rpcSpy.mockClear()
      supabaseMock.from.mockClear()
    },
    setData: (table: string, rows: unknown[]) => {
      dataByTable[table] = rows
    },
    getQuery: (table: string) => lastQueryByTable[table] ?? {},
    setInsertError: (error: { message: string; code?: string }) => {
      insertResult = { error }
    },
    setRpcError: (error: { message: string; code?: string }) => {
      rpcResult = { data: null, error }
    },
    setRpcData: (data: unknown) => {
      rpcResult = { data, error: null }
    },
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: mock.supabase }))

import {
  corregirDevolucion,
  crearDespacho,
  obtenerCargaVendedores,
  obtenerDespachos,
  obtenerPaginaDespachos,
  obtenerDetallesDespacho,
  obtenerDevolucionesEnvase,
  obtenerDevolucionesProducto,
  obtenerEnvasesDespacho,
  obtenerStockBodega,
  obtenerStockEnvases,
  obtenerVendedores,
  registrarDevolucion,
  registrarDevolucionEnvases,
  registrarDevolucionProductos,
} from './api'

beforeEach(() => mock.reset())

describe('HU-13 · obtenerVendedores', () => {
  it('retorna lista vacía sin sucursal y no consulta la BD', async () => {
    const res = await obtenerVendedores(undefined)
    expect(res).toEqual([])
    expect(mock.supabase.from).not.toHaveBeenCalled()
  })

  it('lista vendedores activos de la sucursal por el RPC acotado, sin leer perfiles', async () => {
    mock.setRpcData([{ id: 'u-1', nombres: 'Ana', apellidos: 'Pérez' }])
    const res = await obtenerVendedores('suc-1')
    expect(res).toEqual([{ id: 'u-1', nombres: 'Ana', apellidos: 'Pérez' }])
    expect(mock.rpcSpy).toHaveBeenCalledWith('vendedores_sucursal', { p_sucursal_id: 'suc-1' })
    expect(mock.supabase.from).not.toHaveBeenCalledWith('perfiles')
  })

  it('traduce el error de lectura de vendedores sin revelar el detalle', async () => {
    mock.setRpcError({ message: 'private SQL detail' })
    await expect(obtenerVendedores('suc-1')).rejects.toThrow('No fue posible cargar los vendedores. Inténtalo de nuevo.')
    await expect(obtenerVendedores('suc-1')).rejects.not.toThrow('private SQL detail')
  })
})

describe('HU-13 · obtenerDespachos', () => {
  it('retorna lista vacía sin sucursal', async () => {
    const res = await obtenerDespachos(undefined)
    expect(res).toEqual([])
  })

  it('filtra por sucursal y ordena por fecha descendente', async () => {
    mock.setData('despachos', [{ id: 'd-1' }])
    const res = await obtenerDespachos('suc-1')
    expect(res).toEqual([{ id: 'd-1' }])
    const q = mock.getQuery('despachos')
    expect(q.eq).toHaveBeenCalledWith('sucursal_id', 'suc-1')
    expect(q.order).toHaveBeenCalledWith('creado_en', { ascending: false })
  })
})

describe('HU-13 · obtenerDetallesDespacho', () => {
  it('retorna lista vacía sin ids y no consulta la BD', async () => {
    const res = await obtenerDetallesDespacho([])
    expect(res).toEqual([])
    expect(mock.supabase.from).not.toHaveBeenCalled()
  })

  it('consulta los detalles de los despachos indicados', async () => {
    mock.setData('despacho_detalles', [{ id: 'dd-1' }])
    const res = await obtenerDetallesDespacho(['d-1', 'd-2'])
    expect(res).toEqual([{ id: 'dd-1' }])
    const q = mock.getQuery('despacho_detalles')
    expect(q.in).toHaveBeenCalledWith('despacho_id', ['d-1', 'd-2'])
  })
})

describe('HU-13 · obtenerEnvasesDespacho', () => {
  it('retorna lista vacía sin ids y no consulta la BD', async () => {
    const res = await obtenerEnvasesDespacho([])
    expect(res).toEqual([])
    expect(mock.supabase.from).not.toHaveBeenCalled()
  })

  it('consulta los envases de los despachos indicados', async () => {
    mock.setData('despacho_envases', [{ id: 'de-1' }])
    const res = await obtenerEnvasesDespacho(['d-1', 'd-2'])
    expect(res).toEqual([{ id: 'de-1' }])
    const q = mock.getQuery('despacho_envases')
    expect(q.in).toHaveBeenCalledWith('despacho_id', ['d-1', 'd-2'])
  })
})

describe('HU-13 · obtenerDevolucionesProducto', () => {
  it('solo trae devoluciones no anuladas', async () => {
    mock.setData('devoluciones_productos', [{ id: 'dp-1' }])
    const res = await obtenerDevolucionesProducto(['d-1'])
    expect(res).toEqual([{ id: 'dp-1' }])
    const q = mock.getQuery('devoluciones_productos')
    expect(q.in).toHaveBeenCalledWith('despacho_id', ['d-1'])
    expect(q.eq).toHaveBeenCalledWith('anulado', false)
  })
})

describe('HU-13 · obtenerDevolucionesEnvase', () => {
  it('solo trae devoluciones de envases no anuladas', async () => {
    mock.setData('devoluciones_envases', [{ id: 'de-1' }])
    const res = await obtenerDevolucionesEnvase(['d-1'])
    expect(res).toEqual([{ id: 'de-1' }])
    const q = mock.getQuery('devoluciones_envases')
    expect(q.in).toHaveBeenCalledWith('despacho_id', ['d-1'])
    expect(q.eq).toHaveBeenCalledWith('anulado', false)
  })
})

describe('HU-13 · obtenerStockBodega', () => {
  it('retorna lista vacía sin sucursal', async () => {
    const res = await obtenerStockBodega('')
    expect(res).toEqual([])
  })

  it('filtra el stock de bodega por sucursal', async () => {
    mock.setData('stock_bodega', [{ producto_id: 'p-1', cantidad: 20 }])
    const res = await obtenerStockBodega('suc-1')
    expect(res).toEqual([{ producto_id: 'p-1', cantidad: 20 }])
    const q = mock.getQuery('stock_bodega')
    expect(q.eq).toHaveBeenCalledWith('sucursal_id', 'suc-1')
  })
})

describe('HU-13 · obtenerStockEnvases', () => {
  it('filtra el stock de envases por sucursal', async () => {
    mock.setData('stock_envases', [{ tipo_empaque_id: 'te-1', cantidad: 8 }])
    const res = await obtenerStockEnvases('suc-1')
    expect(res).toEqual([{ tipo_empaque_id: 'te-1', cantidad: 8 }])
    const q = mock.getQuery('stock_envases')
    expect(q.eq).toHaveBeenCalledWith('sucursal_id', 'suc-1')
  })
})

describe('HU-13 · obtenerCargaVendedores', () => {
  it('retorna lista vacía sin vendedores', async () => {
    const res = await obtenerCargaVendedores([])
    expect(res).toEqual([])
    expect(mock.supabase.from).not.toHaveBeenCalled()
  })

  it('consulta la carga de los vendedores indicados', async () => {
    mock.setData('carga_vendedor', [{ vendedor_id: 'u-1', cantidad: 5 }])
    const res = await obtenerCargaVendedores(['u-1'])
    expect(res).toEqual([{ vendedor_id: 'u-1', cantidad: 5 }])
    const q = mock.getQuery('carga_vendedor')
    expect(q.in).toHaveBeenCalledWith('vendedor_id', ['u-1'])
  })
})

describe('HU-13 · crearDespacho', () => {
  const payload = {
    idempotency_key: 'key-despacho',
    sucursal_id: 'suc-1',
    vendedor_id: 'u-1',
    despachador_id: 'u-2',
    creado_por: 'u-2',
    lineas: [{ producto_id: 'p-1', cantidad: 5 }],
    envases: [{ tipo_empaque_id: 'te-1', cantidad: 2 }],
  }

  it('invoca el RPC crear_despacho con las líneas, envases y la clave recibida', async () => {
    const res = await crearDespacho(payload)
    expect(res.error).toBeNull()
    expect(mock.rpcSpy).toHaveBeenCalledWith(
      'crear_despacho',
      expect.objectContaining({
        p_sucursal_id: 'suc-1',
        p_vendedor_id: 'u-1',
        p_despachador_id: 'u-2',
        p_creado_por: 'u-2',
        p_lineas: payload.lineas,
        p_envases: payload.envases,
        p_idempotency_key: 'key-despacho',
      }),
    )
  })

  it('traduce el error de stock insuficiente (P0001) al español', async () => {
    mock.setRpcError({ code: 'P0001', message: 'Stock insuficiente de envases para el tipo X' })
    const res = await crearDespacho(payload)
    expect(res.error).toBe('No hay stock suficiente de envases.')
  })
})

describe('B3 · atomic returns', () => {
  it('sends both sets and one stable key to one RPC with no direct INSERT', async () => {
    const payload = { despacho_id: 'd1', creado_por: 'u1', idempotency_key: 'key-1',
      lineas_producto: [{ producto_id: 'p1', cantidad: 4 }],
      lineas_envase: [{ tipo_empaque_id: 'e1', cantidad: 2, estado: 'bueno' as const }] }
    await registrarDevolucion(payload)
    await registrarDevolucion(payload)
    expect(mock.rpcSpy).toHaveBeenCalledTimes(2)
    expect(mock.rpcSpy).toHaveBeenLastCalledWith('registrar_devolucion', {
      p_despacho_id: 'd1', p_productos: payload.lineas_producto, p_envases: payload.lineas_envase, p_idempotency_key: 'key-1',
    })
    expect(mock.insertSpy).not.toHaveBeenCalled()
  })
  it('routes legacy single-set services through the atomic RPC', async () => {
    await registrarDevolucionProductos({ idempotency_key: 'key-p', despacho_id: 'd1', creado_por: 'u1', lineas: [{ producto_id: 'p1', cantidad: 1 }] })
    await registrarDevolucionEnvases({ idempotency_key: 'key-e', despacho_id: 'd1', creado_por: 'u1', lineas: [{ tipo_empaque_id: 'e1', cantidad: 1, estado: 'malo' }] })
    expect(mock.rpcSpy).toHaveBeenNthCalledWith(1, 'registrar_devolucion', expect.objectContaining({ p_envases: [] }))
    expect(mock.rpcSpy).toHaveBeenNthCalledWith(2, 'registrar_devolucion', expect.objectContaining({ p_productos: [] }))
    expect(mock.insertSpy).not.toHaveBeenCalled()
  })
  it('returns the safe rejection from the joint operation', async () => {
    mock.setRpcError({ code: 'P0001', message: 'No se puede devolver más de lo despachado.' })
    expect(await registrarDevolucion({ despacho_id: 'd1', creado_por: 'u1', lineas_producto: [], lineas_envase: [], idempotency_key: 'key' })).toEqual({ error: 'No se puede devolver más de lo despachado.' })
  })
})

describe('HU-13 · corregirDevolucion', () => {
  const payload = {
    idempotency_key: 'key-c',
    despacho_id: 'd-1',
    creado_por: 'u-2',
    motivo: 'Conteo',
    lineas_producto: [{ producto_id: 'p-1', cantidad: 2 }],
    lineas_envase: [{ tipo_empaque_id: 'te-1', cantidad: 1, estado: 'bueno' as const }],
  }

  it('invoca el RPC corregir_devolucion con líneas de producto y envase', async () => {
    const res = await corregirDevolucion(payload)
    expect(res.error).toBeNull()
    expect(mock.rpcSpy).toHaveBeenCalledWith(
      'corregir_devolucion',
      expect.objectContaining({
        p_despacho_id: 'd-1',
        p_creado_por: 'u-2',
        p_productos: [{ producto_id: 'p-1', cantidad: 2 }],
        p_envases: [{ tipo_empaque_id: 'te-1', cantidad: 1, estado: 'bueno' }],
      }),
    )
  })

  it('reenvía la misma clave en cada reintento del mismo envío', async () => {
    await corregirDevolucion(payload)
    await corregirDevolucion(payload)
    expect(mock.rpcSpy).toHaveBeenNthCalledWith(1, 'corregir_devolucion', expect.objectContaining({ p_idempotency_key: 'key-c' }))
    expect(mock.rpcSpy).toHaveBeenNthCalledWith(2, 'corregir_devolucion', expect.objectContaining({ p_idempotency_key: 'key-c' }))
  })
})


describe('FE-05 · errores de lectura', () => {
  it.each([
    ['despachos', () => obtenerDespachos('suc-1')],
    ['detalles', () => obtenerDetallesDespacho(['d-1'])],
    ['envases', () => obtenerEnvasesDespacho(['d-1'])],
    ['devoluciones de productos', () => obtenerDevolucionesProducto(['d-1'])],
    ['devoluciones de envases', () => obtenerDevolucionesEnvase(['d-1'])],
    ['stock de productos', () => obtenerStockBodega('suc-1')],
    ['stock de envases', () => obtenerStockEnvases('suc-1')],
    ['carga de vendedores', () => obtenerCargaVendedores(['u-1'])],
  ])('rechaza errores al leer %s con un mensaje seguro', async (_nombre, leer) => {
    mock.setReadError()
    await expect(leer()).rejects.toThrow(/^No fue posible cargar .* Inténtalo de nuevo\.$/)
    await expect(leer()).rejects.not.toThrow('private SQL detail')
  })
})

 describe('server pagination', () => {
  it('combines exact count, deterministic order, range and filters', async () => {
    mock.setData('despachos', [{ id: 'visible' }])
    expect(await obtenerPaginaDespachos('suc-1', { pagina: 3, tamanoPagina: 20, vendedorId: 'v-1', desde: '2026-10-14T03:00:00Z', hasta: '2026-10-15T03:00:00Z' })).toEqual({ filas: [{ id: 'visible' }], total: 301 })
    const q = mock.getQuery('despachos')
    expect(q.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(q.eq).toHaveBeenCalledWith('sucursal_id', 'suc-1')
    expect(q.eq).toHaveBeenCalledWith('vendedor_id', 'v-1')
    expect(q.gte).toHaveBeenCalledWith('creado_en', '2026-10-14T03:00:00Z')
    expect(q.lt).toHaveBeenCalledWith('creado_en', '2026-10-15T03:00:00Z')
    expect(q.order).toHaveBeenCalledWith('id', { ascending: false })
    expect(q.range).toHaveBeenCalledWith(40, 59)
  })
  it('does not read without a branch and surfaces safe read errors', async () => {
    expect(await obtenerPaginaDespachos('', { pagina: 1 })).toEqual({ filas: [], total: 0 })
    expect(mock.supabase.from).not.toHaveBeenCalled()
    mock.setReadError()
    await expect(obtenerPaginaDespachos('s', { pagina: 1 })).rejects.toThrow('No fue posible cargar los despachos.')
  })
})
