import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import FiltrosProduccion from './FiltrosProduccion'

it('FX5 R5-06 · fechas en dos columnas con producto a ancho completo y sin duplicar campos', () => {
  const { container } = render(<FiltrosProduccion valores={{ productoId: '', desde: '', hasta: '' }} productos={[]} onChange={vi.fn()} />)
  expect(container.firstElementChild).toHaveClass('grid-cols-1', 'min-[360px]:grid-cols-2')
  expect(screen.getByLabelText('Producto').closest('label')).toHaveClass('min-[360px]:col-span-2')
  expect(container.querySelectorAll('input[type=date]')).toHaveLength(2)
  expect(screen.getByLabelText('Desde')).toHaveClass('min-w-0', 'max-w-full')
  expect(screen.getByLabelText('Hasta')).toHaveClass('min-w-0', 'max-w-full')
})
