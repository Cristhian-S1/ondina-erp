import { afterEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.hoisted(() => vi.fn(() => ({ marker: 'client' })))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  createClient.mockClear()
})

describe('FE-13 · configuración de Supabase', () => {
  it.each(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])('rechaza %s ausente antes de crear el cliente', async (variable) => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-key')
    vi.stubEnv(variable, '')
    await expect(import('./supabase')).rejects.toThrow('Configuración de Supabase incompleta')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('crea el cliente cuando ambas variables están presentes', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-key')
    const { supabase } = await import('./supabase')
    expect(supabase).toEqual({ marker: 'client' })
    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'public-key')
  })
})
