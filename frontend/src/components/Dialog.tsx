import { useEffect, useEffectEvent, useId, useRef } from 'react'
import type { ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}

export default function Dialog({ open, onClose, title, description, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const requestClose = useEffectEvent(onClose)

  useEffect(() => {
    if (!open) return
    const dialog = ref.current!
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const handleClose = () => { if (!dialog.open) requestClose() }
    dialog.addEventListener('close', handleClose)
    dialog.showModal()
    return () => {
      // Closing during cleanup must not request a state change (including StrictMode replay).
      dialog.removeEventListener('close', handleClose)
      if (dialog.open) dialog.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      className="m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-lg space-y-4 overflow-y-auto rounded-2xl border-0 bg-white p-6 shadow-xl backdrop:bg-slate-950/60 [&_button]:min-h-11 [&_button]:min-w-11"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>
        <button type="button" aria-label="Cerrar" onClick={onClose}
          className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">✕</button>
      </div>
      {description && <p id={descriptionId} className="text-sm text-slate-500">{description}</p>}
      {children}
    </dialog>
  )
}
