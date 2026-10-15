import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CampoFormulario from './CampoFormulario'

describe('CampoFormulario', () => {
  it('conserva el contrato original sin props adicionales y el id al corregir el error', () => {
    const campo = (error?: string) => <CampoFormulario etiqueta="Nombre" error={error}>
      {atributos => <input {...atributos} />}
    </CampoFormulario>
    const { rerender } = render(campo())
    const input = screen.getByLabelText('Nombre')
    const id = input.id
    expect(id).not.toBe('')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(input).toHaveClass('min-h-11')
    rerender(campo('Completa el nombre.'))
    expect(input.id).toBe(id)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', `${id}-error`)
    const error = screen.getByText('Completa el nombre.')
    expect(error).toHaveAttribute('id', `${id}-error`)
    expect(error).not.toHaveAttribute('role')
    rerender(campo())
    expect(screen.getByLabelText('Nombre')).toBe(input)
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('acepta un id externo en label, control y error, sin perder foco al validar', () => {
    const campo = (error?: string) => <CampoFormulario id="cantidad-estable" etiqueta="Cantidad" error={error}>
      {atributos => <input {...atributos} />}
    </CampoFormulario>
    const { rerender } = render(campo())
    const input = screen.getByLabelText('Cantidad')
    expect(input).toHaveAttribute('id', 'cantidad-estable')
    expect(screen.getByText('Cantidad')).toHaveAttribute('for', 'cantidad-estable')
    input.focus()
    fireEvent.change(input, { target: { value: '10' } })
    rerender(campo('Cantidad excesiva.'))
    expect(input).toHaveFocus()
    expect(input).toHaveValue('10')
    expect(input).toHaveAttribute('aria-describedby', 'cantidad-estable-error')
    expect(screen.getByText('Cantidad excesiva.')).toHaveAttribute('id', 'cantidad-estable-error')
  })

  it('antepone la descripción adicional y conserva la ayuda al retirar el error', () => {
    const campo = (error?: string) => <><p id="ayuda-cantidad">Máximo disponible: 5.</p>
      <CampoFormulario id="cantidad" etiqueta="Cantidad" descripcionId="ayuda-cantidad" error={error}>
        {atributos => <input {...atributos} />}
      </CampoFormulario></>
    const { rerender } = render(campo('Excede lo disponible.'))
    const input = screen.getByLabelText('Cantidad')
    expect(input).toHaveAttribute('aria-describedby', 'ayuda-cantidad cantidad-error')
    expect(input).toHaveAccessibleDescription('Máximo disponible: 5. Excede lo disponible.')
    rerender(campo())
    expect(input).toHaveAttribute('aria-describedby', 'ayuda-cantidad')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input).toHaveAccessibleDescription('Máximo disponible: 5.')
  })

  it.each([false, true])('añade role alert sólo cuando alerta=%s', alerta => {
    render(<CampoFormulario etiqueta="Vendedor" error="Selecciona un vendedor." alerta={alerta}>
      {atributos => <select {...atributos}><option>Selecciona...</option></select>}
    </CampoFormulario>)
    const mensaje = screen.getByText('Selecciona un vendedor.')
    if (alerta) expect(mensaje).toHaveAttribute('role', 'alert')
    else expect(mensaje).not.toHaveAttribute('role')
    const campo = screen.getByLabelText('Vendedor')
    expect(campo).toHaveAttribute('aria-describedby', mensaje.id)
    expect(campo).toHaveAttribute('aria-invalid', 'true')
  })

})
