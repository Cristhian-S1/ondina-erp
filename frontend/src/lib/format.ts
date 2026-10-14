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

// Fechas: es-CL, zona America/Santiago, dd-mm-aaaa y hh:mm (sin segundos).
// Única fuente de formato de fecha para la aplicación (UX-09).
const ZONA = 'America/Santiago'

const partesFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function partesFecha(valor: string | Date | null | undefined) {
  if (valor === null || valor === undefined || valor === '') return null
  const fecha = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(fecha.getTime())) return null
  const partes = Object.fromEntries(
    partesFormatter.formatToParts(fecha).map((p) => [p.type, p.value]),
  )
  return partes as Record<'day' | 'month' | 'year' | 'hour' | 'minute', string>
}

// Fecha civil "AAAA-MM-DD" (sin hora ni zona): es un día de calendario, no un
// instante; se formatea sin pasar por Date/zona para no desplazarla un día (R3-03).
function fechaCivil(valor: string | Date | null | undefined): string | null {
  if (typeof valor !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (!m) return null
  const [, anio, mes, dia] = m
  const d = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)))
  const valida = d.getUTCFullYear() === Number(anio) && d.getUTCMonth() === Number(mes) - 1 && d.getUTCDate() === Number(dia)
  return valida ? `${dia}-${mes}-${anio}` : '—'
}

// "2026-01-14T23:30:00-03:00" -> "14-01-2026"; "2026-01-15" -> "15-01-2026"; vacío/inválido -> "—"
export function fmtFecha(valor: string | Date | null | undefined): string {
  const civil = fechaCivil(valor)
  if (civil) return civil
  const p = partesFecha(valor)
  return p ? `${p.day}-${p.month}-${p.year}` : '—'
}

// -> "14-01-2026 23:30"; una fecha civil sin hora se devuelve sólo como fecha;
// vacío/inválido -> "—"
export function fmtFechaHora(valor: string | Date | null | undefined): string {
  const civil = fechaCivil(valor)
  if (civil) return civil
  const p = partesFecha(valor)
  return p ? `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}` : '—'
}
