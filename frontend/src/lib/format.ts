// Helpers de formato chileno: punto para miles, sin decimales
// 1000 -> "1.000", 1000000 -> "1.000.000"

export function formatMiles(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  if (Number.isNaN(n)) return '—'
  return Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 })
}

// Para display en tablas/columnas — 0 se muestra como "0"
export function formatCantidad(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  if (Number.isNaN(n)) return '—'
  return Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 })
}

// Parsea "1.000" -> 1000, "" -> 0, "1.000.000" -> 1000000
export function parseMiles(value: string): number {
  if (!value) return 0
  const soloDigitos = value.replace(/\./g, '').replace(/[^\d-]/g, '')
  if (!soloDigitos || soloDigitos === '-') return 0
  const num = Number(soloDigitos)
  return Number.isNaN(num) ? 0 : num
}

// Formatea mientras escribe: "1000" -> "1.000", "1a0b0c0" -> "1.000"
export function formatMilesInput(raw: string): string {
  if (!raw) return ''
  const digitos = raw.replace(/\D/g, '')
  if (!digitos) return ''
  // Evita octal, quita ceros a la izquierda pero deja "0" si es solo ceros
  const sinCeros = digitos.replace(/^0+(?=\d)/, '')
  const num = Number(sinCeros)
  if (Number.isNaN(num)) return ''
  return num.toLocaleString('es-CL', { maximumFractionDigits: 0 })
}

// Para inputs controlados: si valor numérico es 0 o undefined, muestra vacío
export function displayMilesInput(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return ''
  const num = typeof value === 'string' ? parseMiles(value) : Number(value)
  if (!num) return ''
  return formatMiles(num)
}
