import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import TablaProduccionResponsive from './TablaProduccionResponsive'

it('FX5 R5-07 · distribuye todas las métricas por orden aunque el título no sea la primera columna', () => {
  render(<TablaProduccionResponsive resumenNumerico columnas={[
    { titulo: 'Unidades', numerica: true }, { titulo: 'Producto', destacada: true },
    { titulo: 'Registros', numerica: true }, { titulo: 'Merma', numerica: true }, { titulo: 'Envases', numerica: true },
  ]} filas={[{ id: 'fila', celdas: [10, 'Bidón', 2, 1, 9] }]} />)
  const celdas = within(screen.getByTestId('tarjeta-registro')).getAllByRole('cell')
  expect(celdas[0]).toHaveStyle({ gridColumnStart: '1', gridRowStart: '2' })
  expect(celdas[1]).toHaveClass('col-span-2', 'row-start-1')
  expect(celdas[2]).toHaveStyle({ gridColumnStart: '2', gridRowStart: '2' })
  expect(celdas[3]).toHaveStyle({ gridColumnStart: '1', gridRowStart: '3' })
  expect(celdas[4]).toHaveStyle({ gridColumnStart: '2', gridRowStart: '3' })
  expect(screen.getAllByRole('columnheader')).toHaveLength(5)
})

it('FX5 R5-06/07 · tarjeta compacta mantiene rótulos visibles para fecha y observaciones y un único árbol', () => {
  const { container } = render(<TablaProduccionResponsive columnas={[
    { titulo: 'Fecha', insignia: true }, { titulo: 'Producto', destacada: true },
    { titulo: 'Cantidad', cantidad: true, numerica: true }, { titulo: 'Observaciones' },
  ]} filas={[{ id: 'fila', celdas: ['15-10-2026', 'Bidón', 20, 'Turno mañana'] }]} />)
  const tarjeta = screen.getByTestId('tarjeta-registro')
  expect(tarjeta).toHaveClass('grid', 'sm:table-row')
  const celdas = within(tarjeta).getAllByRole('cell')
  expect(celdas[1]).toHaveClass('col-start-1', 'row-start-1')
  expect(celdas[2]).toHaveClass('col-start-2', 'row-start-1')
  expect(within(celdas[0]).getByText('Fecha')).not.toHaveClass('sr-only')
  expect(within(celdas[3]).getByText('Observaciones')).not.toHaveClass('sr-only')
  expect(container.querySelectorAll('table')).toHaveLength(1)
  expect(within(tarjeta).getByText('Turno mañana')).toBeInTheDocument()
})
