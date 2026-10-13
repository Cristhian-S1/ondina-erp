import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-generated.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
  throw new Error(
    'Configuración de Supabase incompleta: define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY antes de iniciar Ondina.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
