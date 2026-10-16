import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EyeIcon, EyeOffIcon } from './icons-visibilidad'
import { BidonIcon, CalendarIcon, DollarIcon, HieloIcon, PercentIcon, ShoppingCartIcon, TrophyIcon } from './icons'

describe('iconos del menú de ventas', () => {
  it('renderiza SVG decorativos con aria-hidden y trazos distintos', () => {
    const formas = [ShoppingCartIcon, TrophyIcon, DollarIcon, PercentIcon, EyeIcon, EyeOffIcon, BidonIcon, HieloIcon, CalendarIcon].map(Icono => {
      const { container, unmount } = render(<Icono />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg).toHaveAttribute('stroke', 'currentColor')
      const html = svg!.innerHTML
      unmount()
      return html
    })
    expect(new Set(formas).size).toBe(formas.length)
  })
})
