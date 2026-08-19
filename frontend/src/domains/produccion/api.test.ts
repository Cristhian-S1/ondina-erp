import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  obtenerEnvasesDisponibles,
  obtenerHistorialProduccion,
  obtenerMermas,
  obtenerIndicadoresProduccion,
  obtenerProducciones,
  registrarMerma,
  registrarProduccion,
} from './api'

const returnsMock = vi.fn()
const insertMock = vi.fn()
const gteMock = vi.fn()
const lteMock = vi.fn()
const isMock = vi.fn()
const notMock = vi.fn()

const queryMock = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  returns: returnsMock,
  insert: insertMock,
  gte: gteMock,
  lte: lteMock,
  is: isMock,
  not: notMock,
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => queryMock),
  },
}))

describe('obtenerProducciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    queryMock.select.mockReturnValue(queryMock)
    queryMock.eq.mockReturnValue(queryMock)
    queryMock.order.mockReturnValue(queryMock)
    queryMock.limit.mockReturnValue(queryMock)
  })

  it('devuelve las producciones obtenidas desde Supabase', async () => {
    const producciones = [
      {
        id: 'produccion-1',
        sucursal_id: 'sucursal-1',
        producto_id: 'producto-1',
        cantidad: 100,
        observaciones: null,
        anulado: false,
        creado_por: 'usuario-1',
        creado_en: '2026-08-12T12:00:00',
      },
    ]

    returnsMock.mockResolvedValue({
      data: producciones,
      error: null,
    })

    const resultado = await obtenerProducciones('sucursal-1')

    expect(resultado).toEqual(producciones)
  })

  it('devuelve un arreglo vacío cuando Supabase no retorna datos', async () => {
    returnsMock.mockResolvedValue({
      data: null,
      error: null,
    })

    const resultado = await obtenerProducciones('sucursal-1')

    expect(resultado).toEqual([])
  })

  it('lanza un error cuando Supabase falla', async () => {
    returnsMock.mockResolvedValue({
      data: null,
      error: { message: 'Error de base de datos' },
    })

    await expect(obtenerProducciones('sucursal-1')).rejects.toThrow(
      'Error de base de datos',
    )
  })
})

describe('registrarProduccion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registra una producción correctamente', async () => {
    insertMock.mockResolvedValue({
      error: null,
    })

    const resultado = await registrarProduccion({
      sucursal_id: 'sucursal-1',
      producto_id: 'producto-1',
      cantidad: 100,
      observaciones: null,
      creado_por: 'usuario-1',
    })

    expect(resultado).toBeNull()

    expect(insertMock).toHaveBeenCalledWith([
      {
        sucursal_id: 'sucursal-1',
        producto_id: 'producto-1',
        cantidad: 100,
        observaciones: null,
        creado_por: 'usuario-1',
      },
    ])
  })

  it('devuelve el mensaje de error cuando Supabase falla', async () => {
    insertMock.mockResolvedValue({
      error: { message: 'No hay stock suficiente' },
    })

    const resultado = await registrarProduccion({
      sucursal_id: 'sucursal-1',
      producto_id: 'producto-1',
      cantidad: 100,
      observaciones: null,
      creado_por: 'usuario-1',
    })

    expect(resultado).toBe('No hay stock suficiente')
  })
})

describe('registrarMerma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registra una merma correctamente', async () => {
    insertMock.mockResolvedValue({
      error: null,
    })

    const resultado = await registrarMerma({
      sucursal_id: 'sucursal-1',
      producto_id: 'producto-1',
      tipo_empaque_id: null,
      despacho_id: null,
      cantidad: 2,
      motivo: 'Producto dañado durante producción.',
      creado_por: 'usuario-1',
    })

    expect(resultado).toBeNull()

    expect(insertMock).toHaveBeenCalledWith([
      {
        sucursal_id: 'sucursal-1',
        producto_id: 'producto-1',
        tipo_empaque_id: null,
        despacho_id: null,
        cantidad: 2,
        motivo: 'Producto dañado durante producción.',
        creado_por: 'usuario-1',
      },
    ])
  })

  it('devuelve el mensaje de error cuando falla el registro', async () => {
    insertMock.mockResolvedValue({
      error: { message: 'Stock insuficiente' },
    })

    const resultado = await registrarMerma({
      sucursal_id: 'sucursal-1',
      producto_id: 'producto-1',
      tipo_empaque_id: null,
      despacho_id: null,
      cantidad: 2,
      motivo: 'Producto dañado.',
      creado_por: 'usuario-1',
    })

    expect(resultado).toBe('Stock insuficiente')
  })
})

describe('obtenerMermas', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    queryMock.select.mockReturnValue(queryMock)
    queryMock.eq.mockReturnValue(queryMock)
    isMock.mockReturnValue(queryMock)
    notMock.mockReturnValue(queryMock)
    queryMock.order.mockReturnValue(queryMock)
    queryMock.limit.mockReturnValue(queryMock)
  })

  it('devuelve las mermas obtenidas desde Supabase', async () => {
    const mermas = [
      {
        id: 'merma-1',
        sucursal_id: 'sucursal-1',
        producto_id: 'producto-1',
        tipo_empaque_id: null,
        despacho_id: null,
        cantidad: 2,
        motivo: 'Producto dañado.',
        anulado: false,
        creado_por: 'usuario-1',
        creado_en: '2026-08-19T12:00:00',
      },
    ]

    returnsMock.mockResolvedValue({
      data: mermas,
      error: null,
    })

    const resultado = await obtenerMermas('sucursal-1')

    expect(resultado).toEqual(mermas)

    expect(queryMock.eq).toHaveBeenCalledWith(
      'sucursal_id',
      'sucursal-1',
    )
  })

  it('devuelve un arreglo vacío cuando no existen mermas', async () => {
    returnsMock.mockResolvedValue({
      data: null,
      error: null,
    })

    const resultado = await obtenerMermas('sucursal-1')

    expect(resultado).toEqual([])
  })

  it('lanza un error cuando falla la consulta de mermas', async () => {
    returnsMock.mockResolvedValue({
      data: null,
      error: { message: 'Error al consultar mermas' },
    })

    await expect(
      obtenerMermas('sucursal-1'),
    ).rejects.toThrow('Error al consultar mermas')
  })
})

describe('obtenerHistorialProduccion', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    queryMock.select.mockReturnValue(queryMock)
    queryMock.eq.mockReturnValue(queryMock)
    queryMock.order.mockReturnValue(queryMock)
    queryMock.limit.mockReturnValue(queryMock)
    gteMock.mockReturnValue(queryMock)
    lteMock.mockReturnValue(queryMock)
  })

  it('obtiene historial aplicando filtros de producto y fechas', async () => {
    const producciones = [
      {
        id: 'produccion-1',
        sucursal_id: 'sucursal-1',
        producto_id: 'producto-1',
        cantidad: 50,
        observaciones: null,
        anulado: false,
        creado_por: 'usuario-1',
        creado_en: '2026-08-12T10:00:00',
      },
    ]

    returnsMock.mockResolvedValue({
      data: producciones,
      error: null,
    })

    const resultado = await obtenerHistorialProduccion({
      sucursalId: 'sucursal-1',
      productoId: 'producto-1',
      desde: '2026-08-01',
      hasta: '2026-08-12',
      limite: 100,
    })

    expect(resultado).toEqual(producciones)

    expect(queryMock.eq).toHaveBeenCalledWith(
      'producto_id',
      'producto-1',
    )

    expect(gteMock).toHaveBeenCalledWith(
      'creado_en',
      '2026-08-01T00:00:00',
    )

    expect(lteMock).toHaveBeenCalledWith(
      'creado_en',
      '2026-08-12T23:59:59.999',
    )

    expect(queryMock.limit).toHaveBeenCalledWith(100)
  })

  it('usa el límite por defecto cuando no se especifica uno', async () => {
    returnsMock.mockResolvedValue({
      data: [],
      error: null,
    })

    await obtenerHistorialProduccion({
      sucursalId: 'sucursal-1',
    })

    expect(queryMock.limit).toHaveBeenCalledWith(200)
  })

  it('lanza un error cuando falla la consulta del historial', async () => {
    returnsMock.mockResolvedValue({
      data: null,
      error: { message: 'Error al obtener historial' },
    })

    await expect(
      obtenerHistorialProduccion({
        sucursalId: 'sucursal-1',
      }),
    ).rejects.toThrow('Error al obtener historial')
  })
})

describe('obtenerIndicadoresProduccion', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    queryMock.select.mockReturnValue(queryMock)
    queryMock.eq.mockReturnValue(queryMock)
    gteMock.mockReturnValue(queryMock)
    lteMock.mockReturnValue(queryMock)
    queryMock.order.mockReturnValue(queryMock)
  })

  it('devuelve los indicadores de producción', async () => {
    const indicadores = [
      {
        sucursal_id: 'sucursal-1',
        producto_id: 'producto-1',
        fecha: '2026-08-12',
        cantidad: 120,
        registros: 3,
      },
    ]

    returnsMock.mockResolvedValue({
      data: indicadores,
      error: null,
    })

    const resultado = await obtenerIndicadoresProduccion(
      'sucursal-1',
      '2026-08-01',
      '2026-08-12',
    )

    expect(resultado).toEqual(indicadores)

    expect(queryMock.eq).toHaveBeenCalledWith(
      'sucursal_id',
      'sucursal-1',
    )

    expect(gteMock).toHaveBeenCalledWith(
      'fecha',
      '2026-08-01',
    )

    expect(lteMock).toHaveBeenCalledWith(
      'fecha',
      '2026-08-12',
    )
  })

  it('devuelve un arreglo vacío cuando no hay indicadores', async () => {
    returnsMock.mockResolvedValue({
      data: null,
      error: null,
    })

    const resultado = await obtenerIndicadoresProduccion(
      'sucursal-1',
      '2026-08-01',
      '2026-08-12',
    )

    expect(resultado).toEqual([])
  })

  it('lanza un error cuando falla la consulta de indicadores', async () => {
    returnsMock.mockResolvedValue({
      data: null,
      error: { message: 'Error al obtener indicadores' },
    })

    await expect(
      obtenerIndicadoresProduccion(
        'sucursal-1',
        '2026-08-01',
        '2026-08-12',
      ),
    ).rejects.toThrow('Error al obtener indicadores')
  })
})

describe('obtenerEnvasesDisponibles', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    queryMock.select.mockReturnValue(queryMock)
    queryMock.eq.mockReturnValue(queryMock)
  })

  it('devuelve solo los envases retornables disponibles', async () => {
    const stock = [
      {
        sucursal_id: 'sucursal-1',
        tipo_empaque_id: 'envase-20l',
        cantidad: 25,
        modificado_en: '2026-08-12T12:00:00',
      },
      {
        sucursal_id: 'sucursal-1',
        tipo_empaque_id: 'bolsa-hielo',
        cantidad: 100,
        modificado_en: '2026-08-12T12:00:00',
      },
    ]

    const empaques = [
      {
        id: 'envase-20l',
        nombre: 'Bidón 20 litros',
        categoria: 'retornable' as const,
        activo: true,
      },
      {
        id: 'bolsa-hielo',
        nombre: 'Bolsa de hielo',
        categoria: 'no_retornable' as const,
        activo: true,
      },
    ]

    returnsMock.mockResolvedValue({
      data: stock,
      error: null,
    })

    const resultado = await obtenerEnvasesDisponibles(
      'sucursal-1',
      empaques,
    )

    expect(resultado).toEqual([
      {
        tipo_empaque_id: 'envase-20l',
        nombre: 'Bidón 20 litros',
        cantidad: 25,
        modificado_en: '2026-08-12T12:00:00',
      },
    ])
  })

  it('devuelve un arreglo vacío cuando no hay stock', async () => {
    returnsMock.mockResolvedValue({
      data: null,
      error: null,
    })

    const resultado = await obtenerEnvasesDisponibles(
      'sucursal-1',
      [],
    )

    expect(resultado).toEqual([])
  })

  it('lanza un error cuando falla la consulta de envases', async () => {
    returnsMock.mockResolvedValue({
      data: null,
      error: { message: 'Error al obtener envases' },
    })

    await expect(
      obtenerEnvasesDisponibles('sucursal-1', []),
    ).rejects.toThrow('Error al obtener envases')
  })
})