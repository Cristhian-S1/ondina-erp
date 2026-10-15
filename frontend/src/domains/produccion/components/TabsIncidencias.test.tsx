import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import TabsIncidencias from './TabsIncidencias'

it('C3-09 · al pasar a tablet reaparecen ambos formularios sin duplicar ni perder sus inputs', () => {
  let matches = true
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return matches },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  })))
  try {
    const { container, unmount } = render(<TabsIncidencias>
      <form><label>Descripción<input defaultValue="Turno" /></label></form>
      <form><label>Motivo<input defaultValue="Rotura" /></label></form>
    </TabsIncidencias>)
    const descripcion = screen.getByLabelText('Descripción')
    fireEvent.change(descripcion, { target: { value: 'Borrador' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Mermas' }))
    const motivo = screen.getByLabelText('Motivo')
    fireEvent.change(motivo, { target: { value: 'Bidón roto' } })
    act(() => { matches = false; listeners.forEach(listener => listener()) })
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Descripción')).toBeVisible()
    expect(screen.getByLabelText('Motivo')).toBeVisible()
    expect(screen.getByLabelText('Descripción')).toBe(descripcion)
    expect(screen.getByLabelText('Motivo')).toBe(motivo)
    expect(descripcion).toHaveValue('Borrador')
    expect(motivo).toHaveValue('Bidón roto')
    expect(container.querySelectorAll('input')).toHaveLength(2)
    act(() => { matches = true; listeners.forEach(listener => listener()) })
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Mermas')
    unmount()
    expect(listeners.size).toBe(0)
  } finally { vi.unstubAllGlobals() }
})
