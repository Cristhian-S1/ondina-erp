import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import logo from '../assets/logo.jpg'
import type { Role } from '../types'
import type { NavItem } from '../types/module'
import { domains } from '../domains'
import { BellIcon, HomeIcon, LogOutIcon, MenuIcon } from './icons'

const TODOS: Role[] = ['vendedor', 'bodega', 'produccion', 'administrador']

const HOME: NavItem = { path: '/', label: 'Inicio', icon: HomeIcon, roles: TODOS }

const ALL_NAV: NavItem[] = [HOME, ...domains.flatMap((module) => module.nav)]

const rolEtiqueta: Record<Role, string> = {
  vendedor: 'Vendedor',
  bodega: 'Bodega',
  produccion: 'Producción',
  administrador: 'Administrador',
}

export default function DashboardLayout() {
  const { perfil, signOut } = useAuth()
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  if (!perfil) return <Navigate to="/login" replace />

  const visibleNav = ALL_NAV.filter((item) => item.roles.includes(perfil.rol))
  const current = ALL_NAV.find((item) => item.path === pathname)
  if (current && !current.roles.includes(perfil.rol)) return <Navigate to="/" replace />

  function toggleSidebar() {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed((value) => !value)
    } else {
      setMobileOpen((value) => !value)
    }
  }

  const iniciales = `${perfil.nombres[0] ?? ''}${perfil.apellidos[0] ?? ''}`

  return (
    <div className="flex min-h-svh">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-900 transition-all duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-16' : 'lg:w-64'} lg:translate-x-0`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-brand-800 ${
            collapsed ? 'lg:justify-center lg:px-0' : 'gap-3 px-4'
          }`}
        >
          <img
            src={logo}
            alt="Ondina"
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
          <span className={`text-lg font-bold text-white ${collapsed ? 'lg:hidden' : ''}`}>
            Ondina
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-brand-800 hover:text-white'
                } ${collapsed ? 'lg:justify-center lg:px-0' : 'px-4'}`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-brand-800 p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className={`flex w-full items-center gap-3 rounded-lg py-2.5 text-sm text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-400 ${
              collapsed ? 'lg:justify-center lg:px-0' : 'px-4'
            }`}
          >
            <LogOutIcon className="h-5 w-5 shrink-0" />
            <span className={`${collapsed ? 'lg:hidden' : ''}`}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div
        className={`flex min-h-svh w-full flex-col transition-[padding] duration-300 ${
          collapsed ? 'lg:pl-16' : 'lg:pl-64'
        }`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Alternar menú lateral"
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
          >
            <MenuIcon className="h-6 w-6" />
          </button>

          <div className="flex-1" />

          <button
            type="button"
            aria-label="Notificaciones"
            className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
          >
            <BellIcon className="h-6 w-6" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          </button>

          <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
              {iniciales}
            </div>
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold leading-tight text-slate-900">
                {perfil.nombres} {perfil.apellidos}
              </p>
              <p className="text-xs leading-tight text-slate-500">{rolEtiqueta[perfil.rol]}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
