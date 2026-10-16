import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import LineaDespacho from './LineaDespacho'
import SeccionDevolucion from './SeccionDevolucion'

it('FX5 R5-06 · reserva el ancho de cantidad y conserva un único juego de controles en despacho', () => {
  const { container } = render(<LineaDespacho indice={0} lineaId="linea" productoId="" cantidad="9999999" productos={[]} productosEnOtrasLineas={[]} disponible={() => 10}
    atributosProducto={{ id: 'producto' }} atributosCantidad={{ id: 'cantidad' }} onProducto={vi.fn()} onCantidad={vi.fn()} onQuitar={vi.fn()} />)
  expect(screen.getByTestId('linea-despacho')).toHaveClass('@container')
  expect(screen.getByLabelText('Cantidad').closest('.w-52')).toHaveClass('max-w-full')
  expect(container.querySelector('.grid')).toHaveClass('@sm:grid-cols-[minmax(0,1fr)_13rem]')
  expect(screen.getByLabelText('Cantidad')).toHaveValue('9.999.999')
  expect(container.querySelectorAll('input')).toHaveLength(1)
})

it('FX5 R5-06 · el conteo y estado del encabezado de devolución pueden envolver sin duplicar contenido', () => {
  render(<SeccionDevolucion tono="producto" titulo="Productos del despacho" lineas={2} yaDevueltos><p>Detalle</p></SeccionDevolucion>)
  const region = screen.getByRole('region', { name: 'Productos del despacho' })
  expect(region).toHaveClass('@container', 'min-w-0')
  expect(region.querySelector('header')).toHaveClass('flex-wrap')
  expect(within(region).getByText('2 líneas').parentElement).toHaveClass('basis-full', '@lg:basis-auto', 'flex-wrap')
  expect(within(region).getByText('Ya devueltos')).toBeInTheDocument()
})
