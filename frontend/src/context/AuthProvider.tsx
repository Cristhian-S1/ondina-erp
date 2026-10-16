import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../types'
import { isRecoverySession, recoverySessionId, rememberRecovery } from '../domains/auth/recovery-session'
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
  const [recovery, setRecovery] = useState(false)
  const recovering = useRef(false)
  const recoveryId = useRef<string | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const identity = useRef<string | null | undefined>(undefined)
  const version = useRef(0)
  const loadedProfile = useRef<Perfil | null>(null)

  useEffect(() => {
    let active = true
    let receivedAuthEvent = false
    let pendingSession: number | undefined

    function prepareSession(userId: string | null) {
      const request = ++version.current
      window.clearTimeout(pendingSession)
      const background = !!userId && identity.current === userId && loadedProfile.current?.id === userId
      if (!background) {
        if (identity.current !== userId || !userId) {
          clearIdentityData(queryClient, identity.current)
        }
        identity.current = userId
        loadedProfile.current = null
        setPerfil(null)
        setError(null)
        setLoading(!!userId)
      }
      return { request, background }
    }

    function blockProfile(message: string, userId: string) {
      clearIdentityData(queryClient, userId)
      loadedProfile.current = null
      setPerfil(null)
      setError(message)
    }

    async function loadProfile(userId: string, request: number, background: boolean) {
      if (!active || request !== version.current) return
      try {
        const { data, error: profileError } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (!active || request !== version.current) return

        if (profileError && profileError.code !== 'PGRST116') {
          blockProfile('No fue posible cargar tu perfil. Intenta iniciar sesión nuevamente.', userId)
        } else if (!data) {
          blockProfile('Tu cuenta no tiene un perfil asignado. Contacta al administrador.', userId)
        } else if (data.activo === false) {
          blockProfile('Tu cuenta está inactiva. Contacta al administrador para recuperar el acceso.', userId)
        } else {
          const next = data as Perfil
          const previous = loadedProfile.current
          if (previous && (previous.rol !== next.rol || previous.sucursal_id !== next.sucursal_id)) {
            clearIdentityData(queryClient, userId)
          }
          loadedProfile.current = next
          setPerfil(next)
          setError(null)
        }
      } catch {
        if (active && request === version.current) {
          blockProfile('No fue posible cargar tu perfil. Intenta iniciar sesión nuevamente.', userId)
        }
      } finally {
        if (active && request === version.current && !background) setLoading(false)
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      receivedAuthEvent = true
      if (event === 'PASSWORD_RECOVERY' || isRecoverySession(session)) {
        prepareSession(null)
        recovering.current = true
        recoveryId.current = recoverySessionId(session)
        rememberRecovery(session)
        setRecovery(true)
        return
      }
      // A recovery session must never load an ERP profile, including USER_UPDATED.
      if (recovering.current && session && (event !== 'SIGNED_IN' || recoverySessionId(session) === recoveryId.current)) return
      recovering.current = false
      recoveryId.current = null
      rememberRecovery(null)
      setRecovery(false)
      const userId = session?.user.id ?? null
      const { request, background } = prepareSession(userId)
      if (!userId) return
      pendingSession = window.setTimeout(() => {
        void loadProfile(userId, request, background)
      }, 0)
    })

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || receivedAuthEvent) return
      if (sessionError) {
        setError('No fue posible recuperar tu sesión. Intenta iniciar sesión nuevamente.')
        setLoading(false)
        return
      }
      if (isRecoverySession(data.session)) {
        prepareSession(null)
        recovering.current = true
        recoveryId.current = recoverySessionId(data.session)
        setRecovery(true)
        return
      }
      const userId = data.session?.user.id ?? null
      const { request, background } = prepareSession(userId)
      if (userId) void loadProfile(userId, request, background)
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
    recovering.current = false
    recoveryId.current = null
    rememberRecovery(null)
    setRecovery(false)
    ++version.current
    clearIdentityData(queryClient, identity.current)
    identity.current = null
    loadedProfile.current = null
    setPerfil(null)
    setLoading(false)
    setError(null)
  }

  return (
    <AuthContext.Provider value={{ perfil, loading, recovery, signIn, signOut }}>
      {error && <p role="alert" className="relative z-50 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {children}
    </AuthContext.Provider>
  )
}
