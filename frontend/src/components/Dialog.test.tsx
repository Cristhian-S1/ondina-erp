import { StrictMode, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Dialog from './Dialog'

function Example({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return <>
    <button onClick={() => setOpen(true)}>Abrir</button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Nuevo despacho" description="Completa los datos.">
      <input aria-label="Cantidad" />
      <button onClick={() => setOpen(false)}>Cancelar</button>
    </Dialog>
  </>
}

describe('Dialog', () => {
  it('opens modally with a name, description and focus inside; Escape restores the opener', () => {
    render(<Example />)
    const opener = screen.getByRole('button', { name: 'Abrir' })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Nuevo despacho' })
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveAccessibleDescription('Completa los datos.')
    expect(dialog.contains(document.activeElement)).toBe(true)
    // Browsers translate Escape into the native cancel event.
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(dialog).not.toHaveAttribute('open')
    expect(opener).toHaveFocus()
  })

  it.each(['Cerrar', 'Cancelar'])('restores focus after %s', (name) => {
    render(<Example />)
    const opener = screen.getByRole('button', { name: 'Abrir' })
    opener.focus()
    fireEvent.click(opener)
    fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('stays open when mounted open under StrictMode', () => {
    render(<StrictMode><Example initialOpen /></StrictMode>)
    expect(screen.getByRole('dialog', { name: 'Nuevo despacho' })).toHaveAttribute('open')
  })

  it('restores focus on native close and can be opened again', () => {
    render(<Example />)
    const opener = screen.getByRole('button', { name: 'Abrir' })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog') as HTMLDialogElement
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    fireEvent.click(opener)
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    act(() => dialog.close())
    expect(opener).toHaveFocus()
  })
})
