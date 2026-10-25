import { btnSecondary } from '../../../lib/ui'
import { useVentanaAjuste } from '../hooks/useVentanaAjuste'
import { formatearRestante } from '../ventanaAjuste'

interface Props {
  creadoEn: string
  // `ventana_expira_en` devuelto por la RPC tras un ajuste; sin él se estima con el valor por defecto.
  expiraEn?: string
  onAgregar: () => void
}

// HU-26: "Agregar productos" solo mientras la pista indique que la ventana sigue abierta. La base
// rechaza cualquier ajuste fuera de plazo aunque este reloj diga lo contrario.
export default function AccionAjusteDespacho({ creadoEn, expiraEn, onAgregar }: Props) {
  const { restanteMs, abierta } = useVentanaAjuste(creadoEn, expiraEn)
  if (!abierta) {
    return <p className="text-xs text-slate-600">La ventana de ajuste de este despacho está cerrada.</p>
  }
  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={onAgregar}>Agregar productos</button>
      <p className="text-xs text-slate-600">
        Quedan {formatearRestante(restanteMs)} para agregar productos{expiraEn ? '' : ' (aprox.)'}.
      </p>
    </div>
  )
}
