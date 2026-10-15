import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from '../../../components/Toast'
import { useToast } from '../../../components/toast-utils'
import { useAuth } from '../../../context/auth-context'
import { btnPrimary, btnSecondary, cardCls } from '../../../lib/ui'
import EstadoVista from '../../../components/EstadoVista'
import AmbitoBodega from '../components/AmbitoBodega'
import FiltrosHistorialDespachos from '../components/FiltrosHistorialDespachos'
import HistorialDespachos from '../components/HistorialDespachos'
import DevolucionesHistorialDespachos from '../components/DevolucionesHistorialDespachos'
import ModalNuevoDespacho from '../components/ModalNuevoDespacho'
import type { FiltroDia } from '../components/despachos.types'
import { useDatosBodega } from '../hooks/useDatosBodega'
import Paginacion from '../../../components/Paginacion'
import { usePaginaBodega } from '../hooks/usePaginaBodega'
import { filtrosHistorial } from '../hooks/filtrosHistorial'
import { useJornadaSantiago } from '../../../lib/jornada'

export default function Despachos() {
  return <AmbitoBodega>{(sucursalId, setOcupado) => <DespachosSucursal sucursalId={sucursalId} setOcupado={setOcupado} />}</AmbitoBodega>
}

function DespachosSucursal({ sucursalId, setOcupado }: { sucursalId: string; setOcupado: (ocupado: boolean) => void }) {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const recursos = useDatosBodega(sucursalId, true)
  const jornada = useJornadaSantiago()
  const { vendedores = [], productos = [], tiposEmpaque = [] } = recursos.data ?? {}
  const [modalOpen, setModalOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [despachoExpandido, setDespachoExpandido] = useState<string | null>(null)
  const [diaFiltro, setDiaFiltro] = useState<FiltroDia>('hoy')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [vendedorFiltro, setVendedorFiltro] = useState('')
  const historial = usePaginaBodega(sucursalId, filtrosHistorial(jornada, diaFiltro, fechaSeleccionada, vendedorFiltro), vendedores)
  const datos = { isPending: recursos.isPending || historial.isPending,
    isError: recursos.isError || historial.isError, data: recursos.data && historial.data }
  const load = () => historial.actualizar()
  const { toast, mostrar, cerrar } = useToast()

  if (datos.isError && !datos.data) return <EstadoVista variante="error" mensaje="No fue posible cargar los despachos. Inténtalo de nuevo." onReintentar={() => void load()} />
  if (datos.isPending) return <EstadoVista variante="cargando" />

  return (
    <div className="space-y-6">
      <Toast toast={toast} onClose={cerrar} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Despachos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Registra salidas hacia vendedores y devoluciones de productos o envases.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <button type="button" className={btnSecondary} onClick={() => navigate('/devoluciones')}>Devoluciones</button>
          <button type="button" className={btnPrimary} onClick={() => { cerrar(); setModalOpen(true) }}>Nuevo despacho</button>
        </div>
      </div>
      {!modalOpen && datos.isError && (<div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No fue posible actualizar. Se conservan los últimos datos disponibles. <button type="button" className={btnSecondary} onClick={() => void load()}>Reintentar</button></div>)}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className={`${cardCls} min-w-0`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Últimos despachos</h2>
            <span className="text-xs text-slate-600">{historial.data?.total ?? 0} registros</span>
          </div>
          <FiltrosHistorialDespachos esAdmin={perfil?.rol === 'administrador'} diaFiltro={diaFiltro}
            fechaSeleccionada={fechaSeleccionada} vendedorFiltro={vendedorFiltro} vendedores={vendedores}
            setDiaFiltro={setDiaFiltro} setFechaSeleccionada={setFechaSeleccionada}
            setVendedorFiltro={setVendedorFiltro} setDespachoExpandido={setDespachoExpandido} />
          <HistorialDespachos pagina={historial.data} productos={productos} tiposEmpaque={tiposEmpaque}
            despachoExpandido={despachoExpandido} setDespachoExpandido={setDespachoExpandido}
            onDevolucion={() => navigate('/devoluciones')} />
          <Paginacion pagina={historial.pagina} total={historial.data?.total ?? 0}
            onCambiar={historial.setPagina} cargando={historial.isFetching || enviando} etiqueta="Paginación de despachos" />
        </section>
        <DevolucionesHistorialDespachos pagina={historial.data} productos={productos} tiposEmpaque={tiposEmpaque} />
      </div>
      <ModalNuevoDespacho open={modalOpen} sucursalId={sucursalId} recursos={recursos.data}
        errorLectura={datos.isError} onClose={() => setModalOpen(false)} onActualizar={load}
        setOcupado={valor => { setEnviando(valor); setOcupado(valor) }}
        onRegistrado={async () => { mostrar('Despacho registrado.'); await load() }} />
    </div>
  )
}
