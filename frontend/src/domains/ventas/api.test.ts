import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock del cliente Supabase compartido para los servicios del dominio.
const mock = vi.hoisted(() => {
  let insertResult: { error: { message: string } | null } = { error: null }
  let rpcResult: { data: unknown; error: { message: string } | null } = {
    data: 'venta-uuid',
    error: null,
  }
  const insertSpy = vi.fn()
  const rpcSpy = vi.fn()
  return {
    supabase: {
      from: vi.fn(() => ({
        insert: (payload: unknown) => {
          insertSpy(payload)
          return Promise.resolve(insertResult)
        },
      })),
      rpc: vi.fn((fn: string, args: unknown) => {
        rpcSpy(fn, args)
        return Promise.resolve(rpcResult)
      }),
    },
    insertSpy,
    rpcSpy,
    reset: () => {
      insertResult = { error: null }
      rpcResult = { data: 'venta-uuid', error: null }
      insertSpy.mockClear()
      rpcSpy.mockClear()
    },
    setInsertError: (msg: string) => {
      insertResult = { error: { message: msg } }
    },
    setRpcError: (msg: string) => {
      rpcResult = { data: null, error: { message: msg } }
    },
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: mock.supabase }))

import { crearCliente, crearGasto, registrarVenta } from './api'
import type { Perfil } from '@/types'

const perfil: Perfil = {
  id: 'user-1',
  sucursal_id: 'suc-1',
  nombres: 'Ana',
  apellidos: 'López',
  rut: null,
  telefono: null,
  rol: 'vendedor',
  activo: true,
  creado_en: '2026-01-01T00:00:00Z',
}

beforeEach(() => mock.reset())

describe('HU-02 · crearCliente', () => {
  it('inserta con vendedor_id igual al auth.uid() del vendedor', async () => {
    const res = await crearCliente({
      nombre: 'Doña María',
      direccion: 'Calle 1',
      telefono: null,
      numero_local: null,
      tipo: 'minorista',
      vendedor_id: perfil.id,
      sucursal_id: perfil.sucursal_id ?? '',
      creado_por: perfil.id,
    })
    expect(res.error).toBeNull()
    expect(mock.insertSpy).toHaveBeenCalledTimes(1)
    const payload = mock.insertSpy.mock.calls[0][0] as { vendedor_id: string }
    expect(payload.vendedor_id).toBe(perfil.id)
  })
})

describe('HU-07 · crearGasto', () => {
  it('inserta el gasto con tipo, monto y motivo', async () => {
    const res = await crearGasto({
      tipo: 'combustible',
      monto: 5000,
      motivo: 'Bencina',
      vendedor_id: perfil.id,
      sucursal_id: perfil.sucursal_id ?? '',
      creado_por: perfil.id,
    })
    expect(res.error).toBeNull()
    const payload = mock.insertSpy.mock.calls[0][0] as {
      tipo: string; monto: number; motivo: string; comprobante_url: string | null
    }
    expect(payload.tipo).toBe('combustible')
    expect(payload.monto).toBe(5000)
    expect(payload.comprobante_url).toBeNull()
  })
})

describe('HU-01 · registrarVenta', () => {
  it('devuelve el id de la venta creada', async () => {
    const res = await registrarVenta({
      p_cliente_id: 'cli-1',
      p_metodo_pago: 'efectivo',
      p_detalles: [{ producto_id: 'p-1', cantidad: 2, precio_unitario: 1000, envases_recibidos: 0 }],
      p_descuento: 0,
      p_observaciones: undefined,
    })
    expect(res.id).toBe('venta-uuid')
    expect(res.error).toBeNull()
    expect(mock.rpcSpy).toHaveBeenCalledWith('registrar_venta', expect.objectContaining({ p_cliente_id: 'cli-1' }))
  })

  it('traduce el error de carga insuficiente al español', async () => {
    mock.setRpcError('Carga insuficiente del vendedor para el producto p-1')
    const res = await registrarVenta({
      p_cliente_id: 'cli-1',
      p_metodo_pago: 'efectivo',
      p_detalles: [{ producto_id: 'p-1', cantidad: 99, precio_unitario: 1000, envases_recibidos: 0 }],
      p_descuento: 0,
      p_observaciones: undefined,
    })
    expect(res.id).toBeNull()
    expect(res.error).toBe('No tienes carga suficiente de uno de los productos.')
  })
})