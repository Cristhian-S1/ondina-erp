import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../types'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPerfil(userId: string) {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error al cargar el perfil:', error)
        setPerfil(null)
        return
      }
      setPerfil(data)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void loadPerfil(data.session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) void loadPerfil(session.user.id)
        else setPerfil(null)
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setPerfil(null)
  }

  return (
    <AuthContext.Provider value={{ perfil, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
