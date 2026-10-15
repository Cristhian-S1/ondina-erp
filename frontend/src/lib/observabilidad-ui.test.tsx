import { fireEvent, render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { crearMutationCacheObservable, descartarReferenciaMutacion } from './observabilidad'

// Unit tests never reach Supabase; without this, importing the real client throws when VITE_* env vars are absent (CI).
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('../pages/Login', () => ({ default: () => <p>Formulario existente</p> }))
vi.mock('../domains', () => ({ domains: [] }))
afterEach(() => { descartarReferenciaMutacion(); vi.restoreAllMocks() })

it('shows the logged operation ID persistently, preserves the screen and lets the user dismiss it', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const client = new QueryClient({ mutationCache: crearMutationCacheObservable() })
  const observer = new MutationObserver(client, { mutationFn: async () => { throw new Error('private-token') } })
  render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await act(async () => { await observer.mutate().catch(() => {}) })
  expect(screen.getByRole('alert')).toHaveTextContent(log.mock.calls[0][1].operacionId)
  expect(screen.getByText('Formulario existente')).toBeInTheDocument()
  expect(screen.getByRole('alert')).not.toHaveTextContent('private-token')
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  client.clear()
})
