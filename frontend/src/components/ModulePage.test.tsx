import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ModulePage from './ModulePage'

describe('UX-03 · ModulePage próximamente', () => {
  it('indica claramente que la sección aún no está disponible y ofrece volver al inicio', () => {
    render(<MemoryRouter><ModulePage title="Reportes" description="Ventas por sucursal." /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
    expect(screen.getByText(/todavía no está disponible/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
  })
})
