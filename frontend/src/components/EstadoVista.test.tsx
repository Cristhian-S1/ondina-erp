import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import EstadoVista from './EstadoVista'

describe('UX-11 · EstadoVista', () => {
  it('cargando: anuncia con role=status y mensaje por defecto', () => {
    render(<EstadoVista variante="cargando" />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando...')
  })

  it('cargando: acepta mensaje propio', () => {
    render(<EstadoVista variante="cargando" mensaje="Cargando clientes..." />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando clientes...')
  })

  it('vacío: muestra mensaje y acción opcional', () => {
    const onClick = vi.fn()
    render(
      <EstadoVista
        variante="vacio"
        mensaje="Aún no hay clientes."
        accion={<button type="button" onClick={onClick}>Registrar cliente</button>}
      />,
    )
    expect(screen.getByText('Aún no hay clientes.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('vacío: sin acción no renderiza botones', () => {
    render(<EstadoVista variante="vacio" mensaje="Sin datos." />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('error: role=alert y botón Reintentar', () => {
    const onReintentar = vi.fn()
    render(<EstadoVista variante="error" mensaje="No se pudo cargar." onReintentar={onReintentar} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onReintentar).toHaveBeenCalledOnce()
  })

  it('error: sin onReintentar no muestra el botón', () => {
    render(<EstadoVista variante="error" mensaje="Falló." />)
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })
})
