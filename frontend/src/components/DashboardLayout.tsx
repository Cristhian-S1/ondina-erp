import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import logo from '../assets/logo.jpg'
import type { Role } from '../types'
import type { NavItem } from '../types/module'
import { domains } from '../domains'
import { HomeIcon, LogOutIcon, MenuIcon } from './icons'

const TODOS: Role[] = ['vendedor', 'bodega', 'produccion', 'administrador']

const HOME: NavItem = { path: '/', label: 'Inicio', icon: HomeIcon, roles: TODOS }

const ALL_NAV: NavItem[] = [HOME, ...domains.flatMap((module) => module.nav)]

const rolEtiqueta: Record<Role, string> = {
  vendedor: 'Vendedor',
  bodega: 'Bodega',
  produccion: 'Producción',
  administrador: 'Administrador',
}

// Secciones de administración aún sin funcionalidad (UX-03): visibles, pero marcadas.
const PROXIMAMENTE = new Set(['/reportes', '/ubicaciones', '/administracion', '/auditoria'])

const FOCUSABLE = 'a[href], button:not([disabled])'

function isDesktop() {
  return window.matchMedia('(min-width: 1024px)').matches
}

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia('(min-width: 1024px)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export default function DashboardLayout() {
  const { perfil, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop)
  // Al cruzar el breakpoint el drawer móvil no debe reaparecer abierto al volver.
  const [desktopPrevio, setDesktopPrevio] = useState(desktop)
  if (desktopPrevio !== desktop) {
    setDesktopPrevio(desktop)
    setMobileOpen(false)
  }
  const sidebarHidden = !desktop && !mobileOpen
  const menuButton = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const modalAbierto = mobileOpen && !desktop

  // El nombre se guarda junto al ámbito (perfil + sucursal) al que pertenece: si
  // el perfil cambia y la lectura nueva falla, no se muestra la sucursal anterior.
  const [sucursalLeida, setSucursalLeida] = useState<{ clave: string; nombre: string } | null>(null)
  const sucursalId = perfil?.sucursal_id ?? null
  const claveSucursal = sucursalId ? `${perfil?.id ?? ''}:${sucursalId}` : null
  const sucursalNombre = sucursalLeida && sucursalLeida.clave === claveSucursal ? sucursalLeida.nombre : null

  // Nombre de sucursal para el drawer móvil. Import dinámico: el layout no debe
  // instanciar el cliente Supabase al cargarse; un fallo deja el texto genérico.
  useEffect(() => {
    if (!modalAbierto || !sucursalId) return
    let activo = true
    import('../lib/dashboard')
      .then((m) => m.obtenerSucursalDashboard(sucursalId))
      .then((data) => {
        if (activo && claveSucursal) setSucursalLeida(data?.nombre ? { clave: claveSucursal, nombre: data.nombre } : null)
      })
      .catch(() => {})
    return () => { activo = false }
  }, [modalAbierto, sucursalId, claveSucursal])

  useEffect(() => {
    if (!modalAbierto) return
    const opener = menuButton.current
    sidebar.current?.querySelector<HTMLElement>('nav a')?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const items = Array.from(sidebar.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !sidebar.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !sidebar.current?.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus()
    }
  }, [modalAbierto])

  const seccion = ALL_NAV.filter(
    (item) => pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path + '/')),
  ).sort((a, b) => b.path.length - a.path.length)[0]
  const titulo = seccion?.label
  useEffect(() => {
    document.title = titulo ? `${titulo} · Ondina` : 'Ondina'
  }, [titulo])

  if (!perfil) return <Navigate to="/login" replace />

  const visibleNav = ALL_NAV.filter((item) => item.roles.includes(perfil.rol))

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
        ref={sidebar}
        id="menu-lateral"
        inert={sidebarHidden}
        aria-hidden={sidebarHidden}
        role={modalAbierto ? 'dialog' : undefined}
        aria-modal={modalAbierto ? true : undefined}
        aria-label={modalAbierto ? 'Menú principal' : undefined}
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
            src={sidebarHidden ? undefined : logo}
            alt="Ondina"
            width={40}
            height={40}
            decoding="async"
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
          <span className={`text-lg font-bold text-white ${collapsed ? 'lg:hidden' : ''}`}>
            Ondina
          </span>
        </div>

        <div className="shrink-0 border-b border-brand-800 px-4 py-3 lg:hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 text-sm text-white">
              <p className="truncate font-semibold">{perfil.nombres} {perfil.apellidos}</p>
              <p className="text-xs text-slate-300">{rolEtiqueta[perfil.rol]}</p>
              <p className="truncate text-xs text-slate-300">
                {perfil.sucursal_id ? (sucursalNombre ?? 'Sucursal asignada') : perfil.rol === 'administrador' ? 'Todas las sucursales' : 'Sin sucursal asignada'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sm text-slate-300 hover:bg-brand-800 hover:text-white"
            >
              <span className="sr-only">Cerrar menú</span>
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/' || ALL_NAV.some((other) => other.path !== item.path && other.path.startsWith(item.path + '/'))}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 min-w-11 items-center gap-3 rounded-lg py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-700 text-white shadow-[inset_4px_0_0_#fff]'
                    : 'text-slate-300 hover:bg-brand-800 hover:text-white'
                } ${collapsed ? 'lg:justify-center lg:px-0' : 'px-4'}`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
              {PROXIMAMENTE.has(item.path) && (
                <span className={`ml-auto shrink-0 rounded-full bg-brand-800 px-2 py-0.5 text-[11px] font-medium text-slate-200 ${collapsed ? 'lg:hidden' : ''}`}>
                  Próximamente
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-brand-800 p-3">
          <button
            type="button"
            onClick={() => void signOut().catch(() => {})}
            aria-label="Cerrar sesión"
            title={collapsed ? 'Cerrar sesión' : undefined}
            className={`flex min-h-11 min-w-11 w-full items-center gap-3 rounded-lg py-2.5 text-sm text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-400 ${
              collapsed ? 'lg:justify-center lg:px-0' : 'px-4'
            }`}
          >
            <LogOutIcon className="h-5 w-5 shrink-0" />
            <span className={`${collapsed ? 'lg:hidden' : ''}`}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div
        inert={modalAbierto}
        className={`flex min-h-svh w-full flex-col transition-[padding] duration-300 ${
          collapsed ? 'lg:pl-16' : 'lg:pl-64'
        }`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button
            ref={menuButton}
            type="button"
            onClick={toggleSidebar}
            aria-label="Alternar menú lateral"
            aria-expanded={desktop ? !collapsed : mobileOpen}
            aria-controls="menu-lateral"
            className="min-h-11 min-w-11 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
          >
            <MenuIcon className="h-6 w-6" />
          </button>

          <div className="flex-1" />

          <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
              {iniciales}
            </div>
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold leading-tight text-slate-900">
                {perfil.nombres} {perfil.apellidos}
              </p>
              <p className="text-xs leading-tight text-slate-600">{rolEtiqueta[perfil.rol]}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
        <footer className="px-4 pb-3 text-right text-xs text-slate-600 sm:px-6" title={`Versión de la aplicación: ${__APP_VERSION__}`}>
          Versión {__APP_VERSION__}
        </footer>
      </div>
    </div>
  )
}
