import { useRef, useState } from 'react'
import Dialog from '../../../components/Dialog'
import CampoFormulario from '../../../components/CampoFormulario'
import { fmtFechaHora, formatMiles } from '../../../lib/format'
import { btnDanger, btnSecondary, errorBlockCls } from '../../../lib/ui'
import { anularMermaBodega } from '../api'
import type { Merma } from '../types'
import { anulacionMermaSchema } from '../validacion'
import type { RecursosDespacho } from './despachos.types'
import { nombreItemMerma } from '../mermas'

interface Props {
  merma: Merma | null
  recursos: RecursosDespacho
  setOcupado: (ocupado: boolean) => void
  onClose: () => void
  onAnulada: () => Promise<void>
}

// Solo administración (la base lo exige; la lista ya oculta la acción para otros roles).
// Pide un motivo propio de la anulación, distinto del motivo original de la merma.
export default function ModalAnularMerma({ merma, recursos, setOcupado, onClose, onAnulada }: Props) {
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviandoEstado] = useState(false)
  const enCurso = useRef(false)
  const [mermaBorrador, setMermaBorrador] = useState(merma?.id ?? null)

  // Un motivo pertenece a una merma: al abrir otra se empieza limpio.
  if (merma && merma.id !== mermaBorrador) {
    setMermaBorrador(merma.id)
    setMotivo('')
    setErrorMotivo(undefined)
    setError(null)
  }

  function setEnviando(valor: boolean) {
    enCurso.current = valor
    setEnviandoEstado(valor)
    setOcupado(valor)
  }
  function cerrar() {
    if (enCurso.current) return
    setError(null)
    setErrorMotivo(undefined)
    onClose()
  }

  async function confirmar() {
    if (!merma || enCurso.current) return
    setError(null)
    const validado = anulacionMermaSchema.safeParse({ motivo })
    if (!validado.success) {
      setErrorMotivo(validado.error.issues[0]?.message)
      return
    }
    setErrorMotivo(undefined)
    setEnviando(true)
    const { error: fallo } = await anularMermaBodega(merma.id, validado.data.motivo)
    if (fallo) {
      setError(fallo)
      setEnviando(false)
      return
    }
    setEnviando(false)
    setMotivo('')
    onClose()
    await onAnulada()
  }

  return (
    <Dialog open={!!merma} onClose={cerrar} title="Anular merma"
      description="La merma queda registrada como anulada y su efecto sobre el stock se compensa en la base de datos.">
      {merma && <>
        <p className="text-sm text-slate-700">
          {nombreItemMerma(merma, recursos)} · {formatMiles(merma.cantidad)} u. · {fmtFechaHora(merma.creado_en)}
        </p>
        <p className="text-xs text-slate-600">Motivo original: {merma.motivo}</p>
        {error && <p role="alert" className={errorBlockCls}>{error}</p>}
        <CampoFormulario etiqueta="Motivo de la anulación" error={errorMotivo}>
          {atributos => <textarea {...atributos} rows={3} value={motivo} disabled={enviando}
            onChange={e => { setMotivo(e.target.value); setErrorMotivo(undefined); setError(null) }} />}
        </CampoFormulario>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className={btnSecondary} onClick={cerrar}>Cancelar</button>
          <button type="button" className={btnDanger} disabled={enviando} onClick={() => void confirmar()}>
            {enviando ? 'Anulando...' : 'Anular merma'}
          </button>
        </div>
      </>}
    </Dialog>
  )
}
