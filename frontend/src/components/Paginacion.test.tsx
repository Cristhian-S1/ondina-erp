import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Paginacion from './Paginacion'

describe('Paginacion', () => {
  it('disables previous on first page and requests the next page', () => {
    const onCambiar = vi.fn()
    render(<Paginacion pagina={1} total={45} tamanoPagina={20} onCambiar={onCambiar} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(onCambiar).toHaveBeenCalledWith(2)
    expect(screen.getByRole('status')).toHaveTextContent('Página 1 de 3')
    expect(screen.getByRole('status')).toHaveTextContent('45 registros')
  })
  it('announces the last page and disables next', () => {
    const props = { total: 45, tamanoPagina: 20, onCambiar: vi.fn() }
    const { rerender } = render(<Paginacion {...props} pagina={2} />)
    rerender(<Paginacion {...props} pagina={3} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toHaveTextContent('Página 3 de 3')
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(props.onCambiar).toHaveBeenCalledWith(2)
  })
  it('keeps both buttons disabled for an empty result and while loading', () => {
    const { rerender } = render(<Paginacion pagina={1} total={0} tamanoPagina={20} onCambiar={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('0 registros')
    expect(screen.getAllByRole('button').every(button => button.hasAttribute('disabled'))).toBe(true)
    rerender(<Paginacion pagina={2} total={45} tamanoPagina={20} onCambiar={vi.fn()} cargando />)
    expect(screen.getAllByRole('button').every(button => button.hasAttribute('disabled'))).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent('Actualizando')
  })
})
