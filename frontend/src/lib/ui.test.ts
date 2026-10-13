import { describe, expect, it } from 'vitest'
import { btnDanger, btnPrimary, btnSecondary, inputCls } from './ui'

// Objetivo táctil mínimo de 44 px en tablet para inputs, selects y botones compartidos
describe('ui · objetivo táctil', () => {
  it.each([
    ['inputCls', inputCls],
    ['btnPrimary', btnPrimary],
    ['btnSecondary', btnSecondary],
    ['btnDanger', btnDanger],
  ])('%s declara min-h-11 (44 px)', (_nombre, clases) => {
    expect(clases.split(' ')).toContain('min-h-11')
  })
})
