import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Toast } from './Toast'

describe('FE-10 · Toast accesible', () => {
  it('anuncia un éxito de forma no intrusiva y permite cerrarlo', () => {
    const onClose = vi.fn()
    render(<Toast toast={{ tipo: 'exito', mensaje: 'Venta registrada.' }} onClose={onClose} />)
    expect(screen.getByRole('status')).toHaveTextContent('Venta registrada.')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('anuncia errores como alertas', () => {
    render(<Toast toast={{ tipo: 'error', mensaje: 'No se pudo registrar.' }} onClose={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo registrar.')
  })

  it('no anuncia nada si no hay notificación', () => {
    render(<Toast toast={null} onClose={() => {}} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
