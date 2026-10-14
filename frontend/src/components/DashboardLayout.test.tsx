import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '@/context/auth-context'
import { makePerfil } from '@/test/render'
import type { Role } from '@/types'
import DashboardLayout from './DashboardLayout'
import { obtenerSucursalDashboard } from '@/lib/dashboard'

vi.mock('@/domains', () => ({ domains: [{ nav: [
  { path: '/stock', label: 'Stock', roles: ['bodega', 'administrador'], icon: () => null },
  { path: '/reportes', label: 'Reportes', roles: ['administrador'], icon: () => null },
] }] }))
vi.mock('@/lib/dashboard', () => ({ obtenerSucursalDashboard: vi.fn().mockResolvedValue({ id: 'suc-1', nombre: 'Sucursal Norte' }) }))
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
})
function setup(path: string, role: Role) {
  return render(<><AuthContext.Provider value={{ perfil: makePerfil({ rol: role }), loading: false, signIn: vi.fn(), signOut: vi.fn() }}>
    <MemoryRouter initialEntries={[path]}><Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/stock" element={<p>Stock page</p>} />
        <Route path="/reportes" element={<p>Reportes page</p>} />
      </Route>
    </Routes></MemoryRouter>
  </AuthContext.Provider></>)
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
  it('moves focus into the drawer and restores the menu button on Escape', () => {
    setup('/', 'bodega')
    const toggle = screen.getByRole('button', { name: 'Alternar menú lateral' })
    toggle.focus()
    fireEvent.click(toggle)
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
  })
  it('restores the menu button after navigation closes the drawer', () => {
    setup('/', 'bodega')
    const toggle = screen.getByRole('button', { name: 'Alternar menú lateral' })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('link', { name: 'Stock' }))
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('declara el drawer abierto como diálogo modal y vuelve inerte el contenido', () => {
    const { container } = setup('/', 'bodega')
    const contenido = screen.getByRole('main').parentElement!
    expect(contenido).not.toHaveAttribute('inert')
    fireEvent.click(screen.getByRole('button', { name: 'Alternar menú lateral' }))
    const drawer = screen.getByRole('dialog', { name: 'Menú principal' })
    expect(drawer).toHaveAttribute('aria-modal', 'true')
    expect(drawer).toBe(container.querySelector('aside'))
    expect(contenido).toHaveAttribute('inert')
  })

  it('cicla el foco con Tab y Shift+Tab dentro del drawer', () => {
    setup('/', 'bodega')
    fireEvent.click(screen.getByRole('button', { name: 'Alternar menú lateral' }))
    const drawer = screen.getByRole('dialog', { name: 'Menú principal' })
    const foco = Array.from(drawer.querySelectorAll<HTMLElement>('a, button'))
    const primero = foco[0]
    const ultimo = foco[foco.length - 1]
    ultimo.focus()
    fireEvent.keyDown(ultimo, { key: 'Tab' })
    expect(primero).toHaveFocus()
    fireEvent.keyDown(primero, { key: 'Tab', shiftKey: true })
    expect(ultimo).toHaveFocus()
  })

  it('cierra el drawer con el botón Cerrar menú y devuelve el foco', () => {
    setup('/', 'bodega')
    const toggle = screen.getByRole('button', { name: 'Alternar menú lateral' })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }))
    expect(toggle).toHaveFocus()
  })

  it('no muestra la campana de notificaciones sin acción', () => {
    setup('/', 'bodega')
    expect(screen.queryByRole('button', { name: 'Notificaciones' })).not.toBeInTheDocument()
  })

  it('muestra nombre, rol y sucursal del usuario en el drawer móvil', async () => {
    setup('/', 'bodega')
    fireEvent.click(screen.getByRole('button', { name: 'Alternar menú lateral' }))
    const drawer = screen.getByRole('dialog', { name: 'Menú principal' })
    expect(drawer).toHaveTextContent('Ana López')
    expect(drawer).toHaveTextContent('Bodega')
    expect(await screen.findByText('Sucursal Norte')).toBeInTheDocument()
  })

  it('marca como Próximamente las rutas de administración en construcción', () => {
    setup('/', 'administrador')
    fireEvent.click(screen.getByRole('button', { name: 'Alternar menú lateral' }))
    const enlace = screen.getByRole('link', { name: /Reportes/ })
    expect(enlace).toHaveTextContent('Próximamente')
    expect(screen.getByRole('link', { name: /Stock/ })).not.toHaveTextContent('Próximamente')
  })

  it('actualiza document.title según la ruta', () => {
    setup('/stock', 'bodega')
    expect(document.title).toBe('Stock · Ondina')
  })

  it('R3-02: al cambiar de sucursal y fallar la lectura nueva no conserva el nombre anterior', async () => {
    const mocked = vi.mocked(obtenerSucursalDashboard)
    mocked.mockResolvedValueOnce({ id: 'suc-1', nombre: 'Sucursal A' } as never)
    mocked.mockRejectedValueOnce(new Error('falla'))
    const tree = (sucursal: string) => (
      <AuthContext.Provider value={{ perfil: makePerfil({ rol: 'bodega', sucursal_id: sucursal }), loading: false, signIn: vi.fn(), signOut: vi.fn() }}>
        <MemoryRouter initialEntries={['/']}><Routes>
          <Route element={<DashboardLayout />}><Route path="/" element={<p>Home page</p>} /></Route>
        </Routes></MemoryRouter>
      </AuthContext.Provider>
    )
    const { rerender } = render(tree('suc-1'))
    fireEvent.click(screen.getByRole('button', { name: 'Alternar menú lateral' }))
    expect(await screen.findByText('Sucursal A')).toBeInTheDocument()
    rerender(tree('suc-2'))
    await waitFor(() => expect(mocked).toHaveBeenCalledWith('suc-2'))
    expect(screen.queryByText('Sucursal A')).not.toBeInTheDocument()
    expect(screen.getByText('Sucursal asignada')).toBeInTheDocument()
  })

  it('R3-05: "Cerrar sesión" conserva nombre accesible explícito al colapsar la barra', () => {
    setup('/', 'bodega')
    fireEvent.click(screen.getByRole('button', { name: 'Alternar menú lateral' }))
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute('aria-label', 'Cerrar sesión')
  })
})
