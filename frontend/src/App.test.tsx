import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthContext } from './context/auth-context'
import { makePerfil } from './test/render'
import type { Role } from './types'
import App from './App'

vi.mock('./pages/Dashboard', () => ({ default: () => <p>Home page</p> }))
vi.mock('./pages/Login', () => ({ default: () => <p>Login page</p> }))
vi.mock('./domains/bodega/pages/Stock', () => ({ default: () => <p>Restricted page</p> }))
vi.mock('./domains/ventas/pages/RegistrarVenta', () => ({ default: () => <p>Restricted page</p> }))
vi.mock('./domains/administracion/pages/Administracion', () => ({ default: () => <p>Restricted page</p> }))

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
})
function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>
}
const roles: Role[] = ['vendedor', 'bodega', 'produccion', 'administrador']
const cases: { path: string; allowed: Role[] }[] = [
  ...['/stock', '/STOCK', '/stock/', '/stock//', '/x/../stock', '/%2e%2e/stock', '/stock ', '/%73tock', '/sto%63k'].map((path) => ({ path, allowed: ['bodega', 'administrador'] as Role[] })),
  ...['/ventas/registrar', '/ventas/REGISTRAR/', '/ventas/%72egistrar'].map((path) => ({ path, allowed: ['vendedor', 'administrador'] as Role[] })),
  ...['/administracion', '/ADMINISTRACION/', '/%61dministracion'].map((path) => ({ path, allowed: ['administrador'] as Role[] })),
  ...['//stock', '/stock/..', '/stock%20', '/stock%2F', '/%2Fstock', '/ventas%2Fregistrar'].map((path) => ({ path, allowed: [] })),
]
describe('App resolved route authorization (REV-1)', () => {
  it.each(cases.flatMap(({ path, allowed }) => roles.map((role) => ({ path, role, allowed: allowed.includes(role) }))))('$role at $path: allowed=$allowed', async ({ path, role, allowed }) => {
    const normalizedPath = new URL(`http://local.test${path}`).pathname
    render(<AuthContext.Provider value={{ perfil: makePerfil({ rol: role }), loading: false, signIn: vi.fn(), signOut: vi.fn() }}>
      <MemoryRouter initialEntries={[normalizedPath]}><App /><Location /></MemoryRouter>
    </AuthContext.Provider>)
    expect(await screen.findByText(allowed ? 'Restricted page' : 'Home page')).toBeInTheDocument()
    if (!allowed) {
      expect(screen.queryByText('Restricted page')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/)
    }
  })
})
