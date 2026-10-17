import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../context/auth-context'
import SolicitarRecuperacion from './SolicitarRecuperacion'
import Restablecer from './Restablecer'
import Login from './Login'
const api = vi.hoisted(() => ({ solicitarRecuperacion: vi.fn(), actualizarPassword: vi.fn() }))
vi.mock('../domains/auth/api', () => api)
const signOut = vi.fn()
function setup(path = '/recuperar', recovery = true, loading = false) {
  function Wrapper() {
    const [recovering, setRecovering] = useState(recovery)
    return (<AuthContext.Provider value={{ perfil: null, loading, recovery: recovering, signIn: vi.fn(), signOut: async () => { await signOut(); setRecovering(false) } }}><MemoryRouter initialEntries={[path]}><Routes><Route path="/recuperar" element={<SolicitarRecuperacion />} /><Route path="/restablecer" element={<Restablecer />} /><Route path="/login" element={<Login />} /></Routes></MemoryRouter></AuthContext.Provider>)
  }
  return render(<Wrapper />)
}
function request() { fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'persona@example.invalid' } }); fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' })) }
function update(password = 'NuevaClave2026', confirm = password) { fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: password } }); fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: confirm } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' })) }
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); api.solicitarRecuperacion.mockResolvedValue(undefined); api.actualizarPassword.mockResolvedValue(undefined); signOut.mockResolvedValue(undefined) })
it('login links to recovery', () => { setup('/login', false); expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute('href', '/recuperar') })
it('validates email with Spanish linked errors and focus', async () => {
  setup(); fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'bad' } }); fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' })); expect(await screen.findByText('Ingresa un correo electrónico válido.')).toBeInTheDocument(); await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toHaveFocus()); expect(api.solicitarRecuperacion).not.toHaveBeenCalled()
})
it('shows pending, neutral success and persistent cooldown', async () => {
  let done!: () => void; api.solicitarRecuperacion.mockReturnValue(new Promise<void>((resolve) => { done = resolve })); const view = setup(); request(); expect(await screen.findByRole('button', { name: 'Enviando...' })).toBeDisabled(); await act(async () => done()); expect(screen.getByRole('status')).toHaveTextContent('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'); expect(api.solicitarRecuperacion).toHaveBeenCalledWith('persona@example.invalid', expect.stringContaining('/restablecer')); expect(screen.getByRole('button', { name: /Reenviar/ })).toBeDisabled(); view.unmount(); setup(); expect(screen.getByRole('button', { name: /Enviar/ })).toBeDisabled()
})
it('keeps failures safe and limits failed retries', async () => { api.solicitarRecuperacion.mockRejectedValue(new Error('private account details')); setup(); request(); expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible enviar el enlace. Espera un minuto e intenta nuevamente.'); expect(screen.queryByText(/private account/)).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeDisabled() })
it.each([['short', /al menos 10/], ['longpassword1', /mayúscula/], ['LONGPASSWORD1', /minúscula/], ['LongPassword', /número/]])('validates policy: %s', async (password, message) => { setup('/restablecer'); update(password); expect(await screen.findByText(message)).toBeInTheDocument(); expect(api.actualizarPassword).not.toHaveBeenCalled() })
it('requires matching confirmation', async () => { setup('/restablecer'); update('NuevaClave2026', 'OtraClave2026'); expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument() })
it('updates then signs out and returns to login', async () => { setup('/restablecer'); update(); await screen.findByRole('button', { name: 'Ingresar' }); expect(api.actualizarPassword).toHaveBeenCalledWith('NuevaClave2026'); expect(signOut).toHaveBeenCalledOnce(); expect(screen.getByRole('status')).toHaveTextContent('Contraseña actualizada') })
it.each(['/restablecer', '/restablecer#error=access_denied&error_code=otp_expired'])('rejects invalid/expired/reused link: %s', (path) => { setup(path, false); expect(screen.getByRole('alert')).toHaveTextContent('El enlace expiró, ya fue utilizado o no es válido.'); expect(screen.getByRole('link', { name: 'Solicitar otro enlace' })).toHaveAttribute('href', '/recuperar'); expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument() })
it('waits for session initialization', () => { setup('/restablecer', false, true); expect(screen.getByRole('status')).toHaveTextContent('Verificando enlace'); expect(screen.queryByRole('alert')).not.toBeInTheDocument() })
it('retries logout without resending the mutation', async () => { signOut.mockRejectedValueOnce(new Error('offline')); setup('/restablecer'); update(); fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión y volver al login' })); await screen.findByRole('button', { name: 'Ingresar' }); expect(api.actualizarPassword).toHaveBeenCalledOnce() })

it('disables the password action until updateUser settles', async () => {
  let done!: () => void
  api.actualizarPassword.mockReturnValue(new Promise<void>((resolve) => { done = resolve }))
  setup('/restablecer')
  update()
  expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled()
  expect(signOut).not.toHaveBeenCalled()
  await act(async () => done())
  await screen.findByRole('button', { name: 'Ingresar' })
})

it('keeps the recovery form and a new-link action after an update failure', async () => {
  api.actualizarPassword.mockRejectedValue(new Error('Elige una contraseña diferente de la anterior.'))
  setup('/restablecer')
  update()
  expect(await screen.findByRole('alert')).toHaveTextContent('Elige una contraseña diferente de la anterior.')
  expect(screen.getByRole('link', { name: 'Solicitar otro enlace' })).toHaveAttribute('href', '/recuperar')
  expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('NuevaClave2026')
  expect(signOut).not.toHaveBeenCalled()
})

it('rejects an expired callback even if another recovery session remains', () => {
  setup('/restablecer?error_code=otp_expired', true)
  expect(screen.getByRole('alert')).toHaveTextContent('El enlace expiró')
  expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
})

it('allows another request when the client retry delay ends', async () => {
  vi.useFakeTimers()
  try {
    setup()
    await act(async () => request())
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(screen.getByRole('button', { name: 'Reenviar enlace' })).toBeEnabled()
  } finally {
    vi.useRealTimers()
  }
})
