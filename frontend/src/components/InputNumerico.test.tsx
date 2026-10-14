import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InputNumerico from './InputNumerico'

function Campo({ inicial = 0, min = 0, max = 2_000_000, conFlechas = true }: { inicial?: number; min?: number; max?: number; conFlechas?: boolean }) {
  const [valor, setValor] = useState<number | undefined>(inicial)
  return <InputNumerico aria-label="Cantidad" value={valor} onChange={setValor} min={min} max={max} conFlechas={conFlechas} />
}

describe('InputNumerico', () => {
  it('rechaza texto, signos y decimales por teclado; permite atajos', () => {
    render(<Campo />)
    const input = screen.getByRole('textbox')
    for (const key of ['a', '-', '+', '.', ',', 'e']) expect(fireEvent.keyDown(input, { key })).toBe(false)
    expect(fireEvent.keyDown(input, { key: '1' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'a', ctrlKey: true })).toBe(true)
    fireEvent.change(input, { target: { value: 'texto' } })
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('placeholder', '0')
    expect(input).toHaveAttribute('inputmode', 'numeric')
  })

  it('pega 1.2a3 como 123 y conserva el valor si el pegado no contiene dígitos', () => {
    render(<Campo />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.paste(input, { clipboardData: { getData: () => '1.2a3' } })
    expect(input).toHaveValue('123')
    input.setSelectionRange(0, 3)
    fireEvent.paste(input, { clipboardData: { getData: () => 'texto' } })
    expect(input).toHaveValue('123')
  })

  it('formatea millones y mantiene el cursor al editar en medio', () => {
    render(<Campo inicial={123456} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1000000', selectionStart: 7 } })
    expect(input).toHaveValue('1.000.000')
    expect(input.selectionStart).toBe(9)
    fireEvent.change(input, { target: { value: '1.020.000', selectionStart: 4 } })
    expect(input).toHaveValue('1.020.000')
    expect(input.selectionStart).toBe(4)
  })

  it('Backspace y Delete junto al separador borran una cifra sin trabar el cursor', () => {
    render(<Campo inicial={1234} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    input.setSelectionRange(2, 2)
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(input).toHaveValue('234')
    fireEvent.change(input, { target: { value: '1234' } })
    input.setSelectionRange(1, 1)
    fireEvent.keyDown(input, { key: 'Delete' })
    expect(input).toHaveValue('134')
  })

  it('suma y resta una unidad con botones y teclado respetando límites', () => {
    render(<Campo inicial={1} min={1} max={3} />)
    const input = screen.getByRole('textbox')
    const aumentar = screen.getByRole('button', { name: 'Aumentar' })
    const disminuir = screen.getByRole('button', { name: 'Disminuir' })
    expect(disminuir).toBeDisabled()
    fireEvent.click(aumentar)
    expect(input).toHaveValue('2')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toHaveValue('3')
    expect(aumentar).toBeDisabled()
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toHaveValue('3')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.click(disminuir)
    expect(input).toHaveValue('1')
    fireEvent.change(input, { target: { value: '999' } })
    expect(input).toHaveValue('3')
    fireEvent.change(input, { target: { value: '0' } })
    expect(input).toHaveValue('1')
  })

  it('enlaza el error debajo y combina descripciones externas', () => {
    const { rerender } = render(<InputNumerico aria-label="Cantidad" value={4} onChange={vi.fn()} error="Excede tu carga" aria-describedby="ayuda" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const ids = input.getAttribute('aria-describedby')!.split(' ')
    expect(ids).toContain('ayuda')
    expect(document.getElementById(ids.find(id => id !== 'ayuda')!)).toHaveTextContent('Excede tu carga')
    rerender(<InputNumerico aria-label="Cantidad" value={2} onChange={vi.fn()} />)
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('respeta disabled y readOnly, incluso con flechas', () => {
    const onChange = vi.fn()
    const { rerender } = render(<InputNumerico value={5} onChange={onChange} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    rerender(<InputNumerico value={5} onChange={onChange} readOnly />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowUp' })
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('oculta flechas cuando se solicita', () => {
    render(<Campo conFlechas={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('Controller recibe números y vacío undefined, conserva onBlur y ref para enfocar', async () => {
    const enviar = vi.fn()
    function Formulario() {
      const { control, handleSubmit, setFocus } = useForm<{ monto?: number }>({ defaultValues: { monto: undefined } })
      return <form onSubmit={handleSubmit(enviar)}><Controller control={control} name="monto" render={({ field }) => <InputNumerico {...field} aria-label="Monto" conFlechas={false} />} /><button type="submit">Guardar</button><button type="button" onClick={() => setFocus('monto')}>Enfocar</button></form>
    }
    render(<Formulario />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1234' } })
    fireEvent.click(screen.getByText('Enfocar'))
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() => expect(enviar.mock.calls[0]?.[0]).toEqual({ monto: 1234 }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() => expect(enviar.mock.calls[1]?.[0]).toEqual({ monto: undefined }))
  })
})
