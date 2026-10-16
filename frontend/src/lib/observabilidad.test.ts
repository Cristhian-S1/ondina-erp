import { afterEach, describe, expect, it, vi } from 'vitest'
import { configurarAdaptador, depurar, reportarError } from './observabilidad'

afterEach(() => { configurarAdaptador(null); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('depurar', () => {
  it('redacts real-shaped credentials, contact data, Chilean identifiers and financial values', () => {
    const data = {
      password: 'clave-sin-patron', access_token: 'opaque-secret', refreshToken: 'refresh-secret',
      authorization: 'Bearer opaque-token', rut: '12.345.678-5', telefono: '+56 9 1234 5678',
      email: 'cliente@example.cl', monto: 15000, subtotal: '15.000',
      nested: ['JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature',
        'Contacto cliente@example.cl RUT 12345678-5 fono +56 9 1234 5678 total $15.000',
        'password=otra-clave token=abc-secreto', 'saldo 1.250,50 CLP', 500],
    }
    const result = JSON.stringify(depurar(data))
    for (const secret of ['clave-sin-patron', 'opaque-secret', 'refresh-secret', 'opaque-token',
      '12.345.678-5', '+56 9 1234 5678', 'cliente@example.cl', '15000', '15.000',
      'eyJhbGci', '12345678-5', 'otra-clave', 'abc-secreto', '1.250,50', '500']) {
      expect(result).not.toContain(secret)
    }
    expect(result).toContain('[REDACTED]')
  })

  it('fails closed on free text, unknown fields, circular objects and getters without executing them', () => {
    const getter = vi.fn(() => 'secret')
    const data: Record<string, unknown> = { arbitrary: 'secret-with-no-pattern' }
    data.self = data
    Object.defineProperty(data, 'password', { enumerable: true, get: getter })
    expect(JSON.stringify(depurar(data))).not.toContain('secret')
    expect(getter).not.toHaveBeenCalled()
  })
})

describe('reportarError', () => {
  it('logs only an allowlisted classification and correlation metadata, never raw errors or context', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = Object.assign(new TypeError('cliente@example.cl password=secret $15.000'), {
      name: 'unsafe@example.cl', details: '12.345.678-5', cause: { access_token: 'token-secret' },
    })
    const context = { operacion: 'mutacion' as const, variables: { password: 'variable-secret' } }
    const id = reportarError(error, context)
    expect(id).toMatch(/^[a-f0-9-]{36}$/)
    expect(log).toHaveBeenCalledWith('ondina.error', {
      operacionId: id, version: 'dev', entorno: 'test', operacion: 'mutacion', tipo: 'TypeError',
    })
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/cliente@|secret|15\.000|12\.345|unsafe@/)
  })

  it('handles arbitrary thrown values and ignores runtime-invalid operation labels', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    reportarError({ token: 'secret' }, { operacion: 'correo@example.cl' as 'mutacion' })
    expect(log.mock.calls[0][1]).toMatchObject({ tipo: 'UnknownError', operacion: 'desconocida' })
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret')
    expect(JSON.stringify(log.mock.calls)).not.toContain('correo@')
  })

  it('never invokes an optional adapter without a DSN', () => {
    vi.stubEnv('VITE_ERROR_DSN', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const adapter = vi.fn()
    configurarAdaptador(adapter)
    reportarError(new Error('secret'), { operacion: 'render' })
    expect(adapter).not.toHaveBeenCalled()
  })

  it('passes only the sanitized event to an explicitly registered DSN adapter and contains its failure', async () => {
    vi.stubEnv('VITE_ERROR_DSN', '/api/errors')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const adapter = vi.fn().mockRejectedValue(new Error('DSN private failure'))
    configurarAdaptador(adapter)
    const id = reportarError(new Error('secret'), { operacion: 'render' })
    await Promise.resolve()
    expect(adapter).toHaveBeenCalledWith(log.mock.calls[0][1], '/api/errors')
    expect(adapter.mock.calls[0][0].operacionId).toBe(id)
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(adapter.mock.calls[0][0])).not.toContain('secret')
  })
})

// Exercise the actual TanStack callback contract, including a domain onError.
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { crearMutationCacheObservable, descartarReferenciaMutacion, obtenerReferenciaMutacion, suscribirReferenciaMutacion } from './observabilidad'

describe('mutation correlation', () => {
  it('reports once, keeps the domain callback and publishes only the same support reference', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const listener = vi.fn()
    const unsubscribe = suscribirReferenciaMutacion(listener)
    const domainError = vi.fn()
    const client = new QueryClient({ mutationCache: crearMutationCacheObservable() })
    const error = new Error('RUT 12.345.678-5 cliente@example.cl $45.000')
    const observer = new MutationObserver(client, {
      mutationFn: async (variables: { password: string }) => {
        expect(variables.password).toBe('opaque-password')
        throw error
      },
      onError: domainError,
    })
    await expect(observer.mutate({ password: 'opaque-password' })).rejects.toBe(error)
    expect(domainError).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledTimes(1)
    expect(obtenerReferenciaMutacion()).toBe(log.mock.calls[0][1].operacionId)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/cliente@|45\.000|12\.345|opaque-password/)
    descartarReferenciaMutacion()
    expect(obtenerReferenciaMutacion()).toBeNull()
    unsubscribe()
    client.clear()
  })

  it('contains a synchronous adapter failure and never serializes custom error properties', () => {
    vi.stubEnv('VITE_ERROR_DSN', '/api/errors')
    const getter = vi.fn(() => 'private-token')
    const error = new Error('private-message')
    Object.defineProperty(error, 'name', { get: getter })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    configurarAdaptador(() => { throw new Error('adapter-secret') })
    expect(() => reportarError(error, { operacion: 'render' })).not.toThrow()
    expect(getter).not.toHaveBeenCalled()
    expect(JSON.stringify(log.mock.calls)).not.toContain('private')
  })
})
