import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { obtenerResumenVenta } from '../api'
import EstadoVista from '../../../components/EstadoVista'
import { btnPrimary, btnSecondary, cardCls, inputCls, labelCls } from '../../../lib/ui'
import { formatMiles } from '../../../lib/format'

export default function ResumenVentaConfirmada({ id, cliente, perfilId, onOtra }: { id: string; cliente: string; perfilId: string; onOtra: () => void }) {
  const [copia, setCopia] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => { titulo.current?.focus() }, [])
  const consulta = useQuery({ queryKey: ['ventas', 'resumen', perfilId, id], queryFn: () => obtenerResumenVenta(id), retry: false })
  return <section className={`${cardCls} min-w-0 space-y-5 p-5`}>
    <h1 ref={titulo} tabIndex={-1} className="text-2xl font-bold text-slate-900">Venta registrada</h1>
    <p role="status" className="text-sm text-slate-600">La venta quedó confirmada. Conserva el folio para cualquier consulta.</p>
    <label className={labelCls}>Folio de la venta<input className={inputCls} readOnly value={id} onFocus={event => event.currentTarget.select()} /></label>
    <button type="button" className={btnSecondary} onClick={() => {
      if (!navigator.clipboard) {
        setCopia('No se pudo copiar el folio. Selecciónalo y cópialo manualmente.')
        return
      }
      void navigator.clipboard.writeText(id).then(() => setCopia('Folio copiado')).catch(() => setCopia('No se pudo copiar el folio. Selecciónalo y cópialo manualmente.'))
    }}>Copiar folio</button>
    {copia && <p role="status" className="text-sm text-slate-600">{copia}</p>}
    <p>Cliente: <strong>{cliente}</strong></p>
    {consulta.isPending ? <EstadoVista variante="cargando" mensaje="Cargando total confirmado..." /> : consulta.error ? <EstadoVista variante="error" mensaje="No fue posible cargar el resumen de la venta. Inténtalo de nuevo." onReintentar={() => void consulta.refetch()} /> : <p>Total confirmado: <strong>$ {formatMiles(consulta.data.total)}</strong></p>}
    <div className="flex flex-wrap gap-3"><button type="button" className={btnPrimary} onClick={onOtra}>Registrar otra venta</button><Link to="/ventas" className={btnSecondary}>Ir a Ventas</Link></div>
  </section>
}
