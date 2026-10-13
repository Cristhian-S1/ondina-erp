import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '@/context/auth-context'
import { makePerfil } from '@/test/render'
import type { Role } from '@/types'
import DashboardLayout from './DashboardLayout'

vi.mock('@/domains', () => ({ domains: [{ nav: [{ path: '/stock', label: 'Stock', roles: ['bodega', 'administrador'], icon: () => null }] }] }))
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
})
function setup(path: string, role: Role) {
  return render(<AuthContext.Provider value={{ perfil: makePerfil({ rol: role }), loading: false, signIn: vi.fn(), signOut: vi.fn() }}>
    <MemoryRouter initialEntries={[path]}><Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/stock" element={<p>Stock page</p>} />
      </Route>
    </Routes></MemoryRouter>
  </AuthContext.Provider>)
}
describe('Dashboard navigation', () => {
  it('makes the closed mobile sidebar inert and exposes its toggle state', () => {
    const { container } = setup('/', 'bodega')
    const toggle = screen.getByRole('button', { name: 'Alternar menú lateral' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const sidebar = container.querySelector('aside')!
    expect(toggle).toHaveAttribute('aria-controls', sidebar.id)
    expect(sidebar).toHaveAttribute('inert')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(sidebar).not.toHaveAttribute('inert')
  })
})
