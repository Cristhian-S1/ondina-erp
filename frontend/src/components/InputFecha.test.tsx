import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InputFecha from './InputFecha'

describe('InputFecha', () => {
  it('abre el selector nativo desde el botón de calendario visible en pantallas táctiles', () => {
    render(<><label htmlFor="f">Desde</label><InputFecha id="f" etiquetaCalendario="Abrir calendario de Desde" value="" onChange={() => {}} /></>)
    const campo = screen.getByLabelText('Desde') as HTMLInputElement
    const showPicker = vi.fn()
    campo.showPicker = showPicker
    const boton = screen.getByRole('button', { name: 'Abrir calendario de Desde' })
    expect(boton.className).toContain('pointer-coarse:inline-flex')
    expect(boton.className).toContain('min-h-11')
    fireEvent.click(boton)
    expect(showPicker).toHaveBeenCalledTimes(1)
    expect(campo).toHaveFocus()
  })

  it('enfoca el campo cuando showPicker falla o no existe', () => {
    render(<InputFecha aria-label="Fecha" etiquetaCalendario="Abrir calendario" value="" onChange={() => {}} />)
    const campo = screen.getByLabelText('Fecha') as HTMLInputElement
    campo.showPicker = () => { throw new DOMException('NotAllowedError') }
    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }))
    expect(campo).toHaveFocus()
  })

  it('no abre el calendario de un campo deshabilitado', () => {
    render(<InputFecha aria-label="Fecha" etiquetaCalendario="Abrir calendario" disabled value="" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Abrir calendario' })).toBeDisabled()
  })
})
