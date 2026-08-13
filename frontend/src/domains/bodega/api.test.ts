import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock del cliente Supabase compartido para los servicios del dominio bodega.
const mock = vi.hoisted(() => {
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
      insert: (payload: unknown) => {
        insertSpy(payload)
        return Promise.resolve(insertResult)
      },
      returns: () => Promise.resolve({ data: dataByTable[table] ?? [] }),
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
    reset: () => {
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
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: mock.supabase }))

import {
  corregirDevolucion,
  crearDespacho,
  obtenerCargaVendedores,
  obtenerDespachos,
  obtenerDetallesDespacho,
  obtenerDevolucionesEnvase,
  obtenerDevolucionesProducto,
  obtenerEnvasesDespacho,
  obtenerStockBodega,
  obtenerStockEnvases,
  obtenerVendedores,
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

  it('consulta perfiles vendedores activos de la sucursal', async () => {
    mock.setData('perfiles', [{ id: 'u-1' }])
    const res = await obtenerVendedores('suc-1')
    expect(res).toEqual([{ id: 'u-1' }])
    const q = mock.getQuery('perfiles')
    expect(q.eq).toHaveBeenCalledWith('sucursal_id', 'suc-1')
    expect(q.eq).toHaveBeenCalledWith('rol', 'vendedor')
    expect(q.eq).toHaveBeenCalledWith('activo', true)
    expect(q.order).toHaveBeenCalledWith('nombres')
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
    sucursal_id: 'suc-1',
    vendedor_id: 'u-1',
    despachador_id: 'u-2',
    creado_por: 'u-2',
    lineas: [{ producto_id: 'p-1', cantidad: 5 }],
    envases: [{ tipo_empaque_id: 'te-1', cantidad: 2 }],
  }

  it('invoca el RPC crear_despacho con las líneas y envases', async () => {
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
      }),
    )
  })

  it('traduce el error de stock insuficiente (P0001) al español', async () => {
    mock.setRpcError({ code: 'P0001', message: 'Stock insuficiente de envases para el tipo X' })
    const res = await crearDespacho(payload)
    expect(res.error).toBe('Stock insuficiente de envases para el tipo X')
  })
})

describe('HU-13 · registrarDevolucionProductos', () => {
  it('inserta cada línea con despacho y usuario', async () => {
    const res = await registrarDevolucionProductos({
      despacho_id: 'd-1',
      creado_por: 'u-2',
      lineas: [
        { producto_id: 'p-1', cantidad: 3 },
        { producto_id: 'p-2', cantidad: 1 },
      ],
    })
    expect(res.error).toBeNull()
    expect(mock.insertSpy).toHaveBeenCalledTimes(1)
    const payload = mock.insertSpy.mock.calls[0][0] as Record<string, unknown>[]
    expect(payload).toEqual([
      { despacho_id: 'd-1', producto_id: 'p-1', cantidad: 3, creado_por: 'u-2' },
      { despacho_id: 'd-1', producto_id: 'p-2', cantidad: 1, creado_por: 'u-2' },
    ])
  })

  it('expone el error de la BD sin traducir si no tiene código', async () => {
    mock.setInsertError({ message: 'Carga insuficiente del vendedor para devolver el producto' })
    const res = await registrarDevolucionProductos({
      despacho_id: 'd-1',
      creado_por: 'u-2',
      lineas: [{ producto_id: 'p-1', cantidad: 99 }],
    })
    expect(res.error).toBe('Carga insuficiente del vendedor para devolver el producto')
  })
})

describe('HU-13 · registrarDevolucionEnvases', () => {
  it('inserta cada envase con su estado (bueno o malo)', async () => {
    const res = await registrarDevolucionEnvases({
      despacho_id: 'd-1',
      creado_por: 'u-2',
      lineas: [
        { tipo_empaque_id: 'te-1', cantidad: 4, estado: 'bueno' },
        { tipo_empaque_id: 'te-2', cantidad: 2, estado: 'malo' },
      ],
    })
    expect(res.error).toBeNull()
    const payload = mock.insertSpy.mock.calls[0][0] as Record<string, unknown>[]
    expect(payload).toEqual([
      { despacho_id: 'd-1', tipo_empaque_id: 'te-1', cantidad: 4, estado: 'bueno', creado_por: 'u-2' },
      { despacho_id: 'd-1', tipo_empaque_id: 'te-2', cantidad: 2, estado: 'malo', creado_por: 'u-2' },
    ])
  })
})

describe('HU-13 · corregirDevolucion', () => {
  it('invoca el RPC corregir_devolucion con líneas de producto y envase', async () => {
    const res = await corregirDevolucion({
      despacho_id: 'd-1',
      creado_por: 'u-2',
      lineas_producto: [{ producto_id: 'p-1', cantidad: 2 }],
      lineas_envase: [{ tipo_empaque_id: 'te-1', cantidad: 1, estado: 'bueno' }],
    })
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
})
