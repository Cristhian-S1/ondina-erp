// Utilidades de color para la propuesta D1: oklch -> sRGB y contraste WCAG 2.x.
// Uso: import { hex, contraste } from './D1-colores-lib.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = resolve(aqui, '../../../../..')
const tema = readFileSync(resolve(raiz, 'frontend/node_modules/tailwindcss/theme.css'), 'utf8')
const indexCss = readFileSync(resolve(raiz, 'frontend/src/index.css'), 'utf8')

const clamp = (v) => Math.min(1, Math.max(0, v))
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
const aHex = (rgb) => '#' + rgb.map((c) => Math.round(clamp(gamma(clamp(c))) * 255).toString(16).padStart(2, '0')).join('')

export function oklchARgbLineal(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h), b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}
export function oklchAHex(L, C, h) { return aHex(oklchARgbLineal(L, C, h)) }

export function hexARgbLineal(hexStr) {
  const n = parseInt(hexStr.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
}
export function hexAOklch(hexStr) {
  const [r, g, b] = hexARgbLineal(hexStr)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  return { L, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 }
}

// Resuelve un token de Tailwind v4 (p. ej. 'slate-500', 'white') o un hex literal a '#rrggbb'.
export function hex(token) {
  if (token.startsWith('#')) return token.toLowerCase()
  if (token === 'white') return '#ffffff'
  if (token === 'black') return '#000000'
  const propio = indexCss.match(new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{6})`))
  if (propio) return propio[1].toLowerCase()
  const m = tema.match(new RegExp(`--color-${token}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`))
  if (!m) throw new Error(`Token sin resolver: ${token}`)
  return oklchAHex(parseFloat(m[1]) / 100, parseFloat(m[2]), parseFloat(m[3]))
}

export function luminancia(h) {
  const [r, g, b] = hexARgbLineal(h)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contraste(a, b) {
  const [x, y] = [luminancia(hex(a)), luminancia(hex(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
export const fmt = (n) => n.toFixed(2).replace('.', ',')
