import { Component } from 'react'
import type { ReactNode } from 'react'
import { reportarError } from '../lib/observabilidad'

interface BoundaryState { failed: boolean; errorId: string | null }

export default class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false, errorId: null }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true, errorId: null }
  }

  componentDidCatch(error: Error) {
    this.setState({ errorId: reportarError(error, { operacion: 'render' }) })
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="flex min-h-svh items-center justify-center bg-slate-50 p-6">
          <div role="alert" className="max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">Ocurrió un error inesperado</h1>
            <p className="text-sm text-slate-600">Recarga la aplicación para volver a intentarlo. Si el problema continúa, comparte este código con soporte.</p>
            <p className="text-xs text-slate-500">Código: {this.state.errorId} · Versión: {__APP_VERSION__}</p>
            <button type="button" onClick={() => window.location.reload()}
              className="min-h-11 min-w-11 rounded-lg bg-brand-600 px-4 py-2 text-white">Recargar</button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
