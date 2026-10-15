import { describe, expect, it } from 'vitest'
import { btnDanger, btnDangerOutline, btnPrimary, btnSecondary, errorBlockCls, errorTextCls, inputCls, thCls } from './ui'

// Objetivo táctil mínimo de 44 px en tablet para inputs, selects y botones compartidos
describe('ui · objetivo táctil', () => {
  it.each([
    ['inputCls', inputCls],
    ['btnPrimary', btnPrimary],
    ['btnSecondary', btnSecondary],
    ['btnDanger', btnDanger],
    ['btnDangerOutline', btnDangerOutline],
  ])('%s declara min-h-11 (44 px)', (_nombre, clases) => {
    expect(clases.split(' ')).toContain('min-h-11')
  })
})

// A1-14: contraste WCAG AA (>=4,5:1) del encabezado de tabla sobre su fondo real (slate-50)
const SLATE: Record<string, string> = { 'slate-400': '94a3b8', 'slate-500': '64748b', 'slate-600': '475569', 'slate-50': 'f8fafc' }
function luminancia(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('ui · contraste de encabezados', () => {
  it('thCls usa un texto con contraste >= 4,5:1 sobre slate-50', () => {
    const color = /text-(slate-\d+)/.exec(thCls)![1]
    expect(contraste(SLATE[color], SLATE['slate-50'])).toBeGreaterThanOrEqual(4.5)
  })
})

// D2: errores en red-700 (red-600 medía 4,35:1 sobre el fondo de página) y "Quitar" outline accesible
describe('ui · color aprobado D2', () => {
  it('los textos de error usan red-700', () => {
    expect(errorTextCls).toContain('text-red-700')
    expect(errorBlockCls).toContain('text-red-700')
  })
  it('btnDangerOutline usa borde y texto red-700 sobre blanco, sin relleno sólido', () => {
    const clases = btnDangerOutline.split(' ')
    expect(clases).toEqual(expect.arrayContaining(['border-red-700', 'text-red-700', 'bg-white', 'hover:bg-red-50']))
    expect(clases).not.toContain('bg-red-600')
  })
})
