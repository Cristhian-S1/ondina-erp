import { MutationCache } from '@tanstack/react-query'

type Operacion = 'render' | 'mutacion' | 'desconocida'
export interface EventoError {
  operacionId: string
  version: string
  entorno: string
  operacion: Operacion
  tipo: string
}
type Adaptador = (evento: Readonly<EventoError>, dsn: string) => void | Promise<void>
let adaptador: Adaptador | null = null
const REDACTED = '[REDACTED]'

/** Fail closed: keep container structure, discard all field names and scalar values.
 * Pattern-only redaction cannot reliably identify opaque passwords or financial data.
 */
export function depurar(valor: unknown, profundidad = 0): unknown {
  if (profundidad >= 5 || valor === null || typeof valor !== 'object') return REDACTED
  try {
    const descriptors = Object.values(Object.getOwnPropertyDescriptors(valor)).slice(0, 20)
    const values = descriptors.map((descriptor) =>
      'value' in descriptor ? depurar(descriptor.value, profundidad + 1) : REDACTED)
    return Array.isArray(valor) ? values : Object.fromEntries(values.map((value, i) => [`campo_${i}`, value]))
  } catch {
    return REDACTED
  }
}

/** Registration alone does not enable delivery: VITE_ERROR_DSN is also required. */
export function configurarAdaptador(nuevo: Adaptador | null) { adaptador = nuevo }

function clasificar(error: unknown): string {
  try {
    // Do not read name/message/stack/cause or execute custom getters/toJSON.
    for (const constructor of [TypeError, RangeError, SyntaxError, ReferenceError, URIError, EvalError, Error]) {
      if (error instanceof constructor) return constructor.name
    }
  } catch { /* Hostile thrown values must not break error handling. */ }
  return 'UnknownError'
}

export function reportarError(error: unknown, contexto: { operacion: Operacion; [key: string]: unknown }): string {
  const operacionId = crypto.randomUUID()
  const evento: Readonly<EventoError> = Object.freeze({
    operacionId,
    // Build metadata only; never derived from the error or user input.
    version: __APP_VERSION__,
    entorno: import.meta.env.MODE,
    operacion: contexto.operacion === 'render' || contexto.operacion === 'mutacion' ? contexto.operacion : 'desconocida',
    tipo: clasificar(error),
  })
  console.error('ondina.error', evento)
  const dsn = import.meta.env.VITE_ERROR_DSN
  if (dsn && adaptador) {
    try { void Promise.resolve(adaptador(evento, dsn)).catch(() => {}) } catch { /* No recursive logging. */ }
  }
  return operacionId
}

// Only the latest reference lives in memory; no error, variables, user or storage.
let referencia: string | null = null
const listeners = new Set<() => void>()
export function obtenerReferenciaMutacion() { return referencia }
export function suscribirReferenciaMutacion(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function descartarReferenciaMutacion() {
  referencia = null
  listeners.forEach((listener) => listener())
}
export function crearMutationCacheObservable() {
  return new MutationCache({
    onError: (error) => {
      referencia = reportarError(error, { operacion: 'mutacion' })
      listeners.forEach((listener) => listener())
    },
  })
}
