import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Broken(): never { throw new TypeError('private profile and network data') }

afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('renders children when healthy', () => {
    render(<ErrorBoundary><p>Aplicación</p></ErrorBoundary>)
    expect(screen.getByText('Aplicación')).toBeInTheDocument()
  })

  it('shows a safe Spanish fallback, random ID, version and reload action', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Broken /></ErrorBoundary>, { onCaughtError: () => {} })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Ocurrió un error inesperado')
    expect(alert).toHaveTextContent(/Código: [a-f0-9]{8}/)
    expect(alert).toHaveTextContent('Versión: dev')
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(alert).not.toHaveTextContent('private profile')
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{8}$/), 'TypeError')
  })
})
