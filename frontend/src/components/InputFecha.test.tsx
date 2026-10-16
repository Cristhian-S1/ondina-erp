import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InputFecha from './InputFecha'

describe('InputFecha', () => {
  it('abre el selector nativo desde el botón de calendario, visible con cualquier puntero', () => {
    render(<><label htmlFor="f">Desde</label><InputFecha id="f" etiquetaCalendario="Abrir calendario de Desde" value="" onChange={() => {}} /></>)
    const campo = screen.getByLabelText('Desde') as HTMLInputElement
    const showPicker = vi.fn()
    campo.showPicker = showPicker
    const boton = screen.getByRole('button', { name: 'Abrir calendario de Desde' })
    expect(boton).toBeVisible()
    expect(boton.className).not.toMatch(/(^|\s)hidden(\s|$)/)
    expect(boton.className).not.toContain('pointer-coarse:')
    expect(boton.className).toContain('inline-flex')
    expect(boton.className).toContain('w-11')
    // Inset 1px inside the input border, opaque so any native indicator stays hidden underneath.
    expect(boton.className).toMatch(/top-px right-px bottom-px/)
    expect(boton.className).toContain('bg-white')
    fireEvent.click(boton)
    expect(showPicker).toHaveBeenCalledTimes(1)
    expect(campo).toHaveFocus()
  })

  it('oculta el indicador nativo WebKit siempre y no desplaza el indicador con padding extra', () => {
    render(<InputFecha aria-label="Fecha" etiquetaCalendario="Abrir calendario" className="mt-1 min-h-11 px-3 max-w-full" value="" onChange={() => {}} />)
    const campo = screen.getByLabelText('Fecha')
    expect(campo.className).toContain('[&::-webkit-calendar-picker-indicator]:hidden')
    expect(campo.className).not.toContain('pointer-coarse:')
    expect(campo.className).not.toContain('pr-12')
    // Only the start padding shrinks, so the dd-mm-aaaa text clears the 44px button in the narrowest two-column filter.
    expect(campo.className).toContain('ps-2')
    // The margin moves to the wrapper so the button aligns with the input's border box.
    expect(campo.className).not.toMatch(/(^|\s)mt-1(\s|$)/)
    expect(campo.className).toContain('max-w-full')
    expect(campo.parentElement?.className).toMatch(/(^|\s)mt-1(\s|$)/)
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
    const campo = screen.getByLabelText('Fecha') as HTMLInputElement
    const showPicker = vi.fn()
    campo.showPicker = showPicker
    const boton = screen.getByRole('button', { name: 'Abrir calendario' })
    expect(boton).toBeDisabled()
    expect(boton.className).toContain('disabled:bg-slate-100')
    fireEvent.click(boton)
    expect(showPicker).not.toHaveBeenCalled()
  })
})
