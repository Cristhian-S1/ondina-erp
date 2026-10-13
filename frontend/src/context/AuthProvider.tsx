import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../types'
import { AuthContext } from './auth-context'

function clearIdentityData(queryClient: QueryClient, userId: string | null | undefined) {
  queryClient.clear()
  try {
    sessionStorage.removeItem('ondina:draft-registrar-venta')
    if (userId) sessionStorage.removeItem(`ondina:draft-registrar-venta:${userId}`)
  } catch {
    return
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const identity = useRef<string | null | undefined>(undefined)
  const version = useRef(0)
  const loadedIdentity = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    let receivedAuthEvent = false
    let pendingSession: number | undefined

    async function loadSession(userId: string | null) {
      if (!active) return
      const request = ++version.current
      if (identity.current !== userId) {
        clearIdentityData(queryClient, identity.current)
        identity.current = userId
      }
      loadedIdentity.current = null
      setPerfil(null)
      setError(null)
      setLoading(!!userId)
      if (!userId) return

      try {
        const { data, error: profileError } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (!active || request !== version.current) return

        if (profileError && profileError.code !== 'PGRST116') {
          setError('No fue posible cargar tu perfil. Intenta iniciar sesión nuevamente.')
        } else if (!data) {
          setError('Tu cuenta no tiene un perfil asignado. Contacta al administrador.')
        } else if (data.activo === false) {
          setError('Tu cuenta está inactiva. Contacta al administrador para recuperar el acceso.')
        } else {
          loadedIdentity.current = userId
          setPerfil(data as Perfil)
        }
      } catch {
        if (active && request === version.current) {
          setError('No fue posible cargar tu perfil. Intenta iniciar sesión nuevamente.')
        }
      } finally {
        if (active && request === version.current) setLoading(false)
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      receivedAuthEvent = true
      const request = ++version.current
      window.clearTimeout(pendingSession)
      const userId = session?.user.id ?? null
      if (userId && identity.current === userId && loadedIdentity.current === userId) return
      pendingSession = window.setTimeout(() => {
        if (active && request === version.current) void loadSession(userId)
      }, 0)
    })

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || receivedAuthEvent) return
      if (sessionError) {
        setError('No fue posible recuperar tu sesión. Intenta iniciar sesión nuevamente.')
        setLoading(false)
        return
      }
      void loadSession(data.session?.user.id ?? null)
    }).catch(() => {
      if (!active || receivedAuthEvent) return
      setError('No fue posible recuperar tu sesión. Intenta iniciar sesión nuevamente.')
      setLoading(false)
    })

    return () => {
      active = false
      window.clearTimeout(pendingSession)
      listener.subscription.unsubscribe()
    }
  }, [queryClient])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
    } catch (cause) {
      setError('No fue posible cerrar sesión. Intenta nuevamente.')
      throw cause
    }
    ++version.current
    clearIdentityData(queryClient, identity.current)
    identity.current = null
    loadedIdentity.current = null
    setPerfil(null)
    setLoading(false)
    setError(null)
  }

  return (
    <AuthContext.Provider value={{ perfil, loading, signIn, signOut }}>
      {error && <p role="alert" className="relative z-50 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {children}
    </AuthContext.Provider>
  )
}
