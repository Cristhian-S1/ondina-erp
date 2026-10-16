import { describe, expect, it } from 'vitest'
import { rangoPagina, totalPaginas } from './paginacion'
describe('pagination bounds', () => {
  it('produces inclusive PostgREST ranges and protects invalid inputs', () => {
    expect(rangoPagina(1)).toEqual([0, 19])
    expect(rangoPagina(3, 25)).toEqual([50, 74])
    expect(rangoPagina(0, 0)).toEqual([0, 0])
    expect(rangoPagina(NaN, Infinity)).toEqual([0, 0])
  })
  it('retains one empty page and rounds up the final partial page', () => {
    expect(totalPaginas(0)).toBe(1)
    expect(totalPaginas(301)).toBe(16)
  })
})
