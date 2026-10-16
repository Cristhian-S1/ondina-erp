import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '@/context/auth-context'
import Login from './Login'

function setup(signIn = vi.fn()) {
  render(
    <AuthContext.Provider value={{ perfil: null, loading: false, signIn, signOut: vi.fn() }}>
      <MemoryRouter><Login /></MemoryRouter>
    </AuthContext.Provider>,
  )
  return signIn
}

function enviar() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.invalid' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

describe('A1-19 · Login accesible', () => {
  it('anuncia el error de credenciales con role=alert', async () => {
    setup(vi.fn().mockRejectedValue(new Error('Invalid login credentials')))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    enviar()
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(/incorrectos|No fue posible|Inténtalo/i)
  })

  it('limpia la alerta al reintentar', async () => {
    const signIn = vi.fn().mockRejectedValueOnce(new Error('x')).mockReturnValue(new Promise(() => {}))
    setup(signIn)
    enviar()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('los campos usan altura táctil de 44 px', () => {
    setup()
    expect(screen.getByLabelText('Email').className).toContain('min-h-11')
    expect(screen.getByLabelText('Contraseña').className).toContain('min-h-11')
  })

  it('alterna la visibilidad de la contraseña con aria-pressed y área de 44 px', () => {
    setup()
    const campo = screen.getByLabelText('Contraseña')
    const boton = screen.getByRole('button', { name: 'Mostrar contraseña' })
    expect(boton).toHaveAttribute('aria-pressed', 'false')
    expect(boton.className).toContain('min-h-11')
    expect(boton.className).toContain('min-w-11')
    expect(campo).toHaveAttribute('type', 'password')
    expect(boton.querySelector('svg[data-icono="ver"]')).toBeInTheDocument()
    fireEvent.click(boton)
    expect(campo).toHaveAttribute('type', 'text')
    expect(boton).toHaveAttribute('aria-pressed', 'true')
    expect(boton.querySelector('svg[data-icono="ocultar"]')).toBeInTheDocument()
    expect(boton).not.toHaveTextContent(/Ver|Ocultar/)
  })
})
