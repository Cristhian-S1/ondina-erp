import type { ToastState } from './toast-utils'

export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  if (!toast) return null

  const estilo =
    toast.tipo === 'exito'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : 'bg-red-50 border-red-200 text-red-800'

  return (
    <div className="fixed left-2 right-2 top-20 z-50 animate-in fade-in slide-in-from-top-2 duration-300 sm:left-auto sm:right-4">
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${estilo}`}>
        <span className="text-sm font-medium">{toast.mensaje}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-current opacity-60 transition hover:opacity-100"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
