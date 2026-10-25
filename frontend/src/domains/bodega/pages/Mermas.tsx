import { useState } from 'react'
import { Toast } from '../../../components/Toast'
import { useToast } from '../../../components/toast-utils'
import EstadoVista from '../../../components/EstadoVista'
import Paginacion from '../../../components/Paginacion'
import { useAuth } from '../../../context/auth-context'
import { useJornadaSantiago } from '../../../lib/jornada'
import { btnSecondary, cardCls, inputCls, labelCls } from '../../../lib/ui'
import type { FiltrosMermas } from '../api'
import AmbitoBodega from '../components/AmbitoBodega'
import FormularioMerma from '../components/FormularioMerma'
import ListaMermas from '../components/ListaMermas'
import ModalAnularMerma from '../components/ModalAnularMerma'
import { useDatosBodega } from '../hooks/useDatosBodega'
import { useDespachosDelDia, useInvalidarMermas, useListaMermas } from '../hooks/useMermas'
import type { Merma, OrigenMerma } from '../types'

export default function Mermas() {
  return <AmbitoBodega>{(sucursalId, setOcupado) => <MermasSucursal sucursalId={sucursalId} setOcupado={setOcupado} />}</AmbitoBodega>
}

function MermasSucursal({ sucursalId, setOcupado }: { sucursalId: string; setOcupado: (ocupado: boolean) => void }) {
  const { perfil } = useAuth()
  const jornada = useJornadaSantiago()
  const recursos = useDatosBodega(sucursalId, false)
  const despachos = useDespachosDelDia(sucursalId, jornada)
  const [origenFiltro, setOrigenFiltro] = useState<OrigenMerma | ''>('')
  const [estadoFiltro, setEstadoFiltro] = useState<'' | 'activas' | 'anuladas'>('')
  const filtros: FiltrosMermas = {
    origen: origenFiltro || undefined,
    anuladas: estadoFiltro === '' ? undefined : estadoFiltro === 'anuladas',
  }
  const lista = useListaMermas(sucursalId, filtros)
  const invalidar = useInvalidarMermas(sucursalId)
  const [mermaAnular, setMermaAnular] = useState<Merma | null>(null)
  const [ocupadoLocal, setOcupadoLocal] = useState(false)
  const { toast, mostrar, cerrar } = useToast()
  const esAdmin = perfil?.rol === 'administrador'

  function marcarOcupado(valor: boolean) {
    setOcupadoLocal(valor)
    setOcupado(valor)
  }

  if (recursos.isError && !recursos.data) {
    return <EstadoVista variante="error" mensaje="No fue posible cargar los datos de bodega. Inténtalo de nuevo." onReintentar={() => void recursos.refetch()} />
  }
  if (!perfil || !recursos.data) return <EstadoVista variante="cargando" />

  return (
    <div className="space-y-6">
      <Toast toast={toast} onClose={cerrar} />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mermas</h1>
        <p className="mt-1 text-sm text-slate-600">Registra productos o envases perdidos en bodega o en un despacho del día.</p>
      </div>
      <FormularioMerma sucursalId={sucursalId} recursos={recursos.data} despachosDelDia={despachos.data ?? []}
        errorDespachos={despachos.isError} setOcupado={marcarOcupado}
        onRegistrada={async () => { await invalidar() }} />
      <section className={`${cardCls} min-w-0`}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Mermas de la sucursal</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className={labelCls}>Origen
              <select className={inputCls} value={origenFiltro} onChange={e => setOrigenFiltro(e.target.value as OrigenMerma | '')}>
                <option value="">Todos</option>
                <option value="bodega">Bodega</option>
                <option value="despacho">Despacho</option>
              </select>
            </label>
            <label className={labelCls}>Estado
              <select className={inputCls} value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value as '' | 'activas' | 'anuladas')}>
                <option value="">Todas</option>
                <option value="activas">Activas</option>
                <option value="anuladas">Anuladas</option>
              </select>
            </label>
          </div>
        </div>
        {lista.isError && !lista.data ? (
          <EstadoVista variante="error" mensaje="No fue posible cargar las mermas. Inténtalo de nuevo." onReintentar={() => void lista.refetch()} />
        ) : lista.isPending ? (
          <EstadoVista variante="cargando" />
        ) : <>
          {lista.isError && <div role="alert" className="m-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No fue posible actualizar. Se conservan los últimos datos disponibles. <button type="button" className={btnSecondary} onClick={() => void lista.refetch()}>Reintentar</button></div>}
          {lista.data.filas.length === 0 ? (
            <div role="status"><EstadoVista variante="vacio" mensaje={origenFiltro || estadoFiltro ? 'No hay mermas con los filtros seleccionados.' : 'Aún no hay mermas registradas para esta sucursal.'} /></div>
          ) : (
            <ListaMermas filas={lista.data.filas} recursos={recursos.data} perfil={perfil} puedeAnular={esAdmin}
              ocupado={ocupadoLocal} onAnular={merma => { cerrar(); setMermaAnular(merma) }} />
          )}
          <Paginacion pagina={lista.pagina} total={lista.data.total} onCambiar={lista.setPagina}
            cargando={lista.isFetching} etiqueta="Paginación de mermas" />
        </>}
      </section>
      {esAdmin && <ModalAnularMerma merma={mermaAnular} recursos={recursos.data} setOcupado={marcarOcupado}
        onClose={() => setMermaAnular(null)}
        onAnulada={async () => { mostrar('Merma anulada.'); await invalidar() }} />}
    </div>
  )
}
