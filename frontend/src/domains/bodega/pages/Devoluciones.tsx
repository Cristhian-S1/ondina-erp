import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../context/auth-context'
import { corregirDevolucion, registrarDevolucion } from '../api'
import { btnPrimary, btnSecondary, cardCls, inputCls } from '../../../lib/ui'
import { fmtFecha, fmtFechaHora, formatMiles } from '../../../lib/format'
import EstadoVista from '../../../components/EstadoVista'
import InputNumerico from '../../../components/InputNumerico'
import Dialog from '../../../components/Dialog'
import { disponibleParaDevolver } from '../validacion'
import AmbitoBodega from '../components/AmbitoBodega'
import SeccionDevolucion from '../components/SeccionDevolucion'
import { useDatosBodega } from '../hooks/useDatosBodega'
import Paginacion from '../../../components/Paginacion'
import { usePaginaBodega } from '../hooks/usePaginaBodega'
import { filtrosHistorial } from '../hooks/filtrosHistorial'
import { useJornadaSantiago } from '../hooks/useJornadaSantiago'

type EstadoDespacho = 'pendiente' | 'productos' | 'envases' | 'completo'

const estadoEtiqueta: Record<EstadoDespacho, string> = {
  pendiente: 'Pendiente',
  productos: 'Productos',
  envases: 'Envases',
  completo: 'Completo',
}

const estadoBadge: Record<EstadoDespacho, string> = {
  pendiente: 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600',
  productos: 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700',
  envases: 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700',
  completo: 'rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700',
}

type FiltroDia = 'hoy' | 'ayer' | '7d' | 'todo' | 'fecha'

const OPCIONES_DIA: Array<[FiltroDia, string]> = [
  ['hoy', 'Hoy'],
  ['ayer', 'Ayer'],
  ['7d', '7 días'],
  ['todo', 'Todo'],
]

const inputCompact = `${inputCls} text-right`
// Fila compacta: nombre y disponibilidad a la izquierda, input acotado a la derecha.
const filaCls = 'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-3'
// En teléfono las flechas apiladas de InputNumerico duplicarían el alto de la fila; el teclado numérico basta
// (ArrowUp/ArrowDown siguen funcionando). Se muestran cuando la sección mide ≥ 32rem (container query:
// en escritorio la columna de detalle es angosta aunque la ventana sea ancha).
const sinFlechasMovil = '@max-lg:[&_button]:hidden'

export default function Devoluciones() {
  return <AmbitoBodega>{(sucursalId, setOcupado) => <DevolucionesSucursal sucursalId={sucursalId} setOcupado={setOcupado} />}</AmbitoBodega>
}

function DevolucionesSucursal({ sucursalId, setOcupado }: { sucursalId: string; setOcupado: (ocupado: boolean) => void }) {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'

  const recursos = useDatosBodega(sucursalId, false)
  const jornada = useJornadaSantiago()
  const { vendedores = [], productos = [], tiposEmpaque = [], stockEnvases = [], cargaVendedor = [] } = recursos.data ?? {}
  const load = () => historial.actualizar()

  const detalleTitulo = useRef<HTMLHeadingElement>(null)
  const [seleccionado, setSeleccionado] = useState('')
  const [diaFiltro, setDiaFiltro] = useState<'hoy' | 'ayer' | '7d' | 'todo' | 'fecha'>('hoy')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [vendedorFiltro, setVendedorFiltro] = useState('')
  const historial = usePaginaBodega(sucursalId, filtrosHistorial(jornada, diaFiltro, fechaSeleccionada, vendedorFiltro), vendedores, seleccionado)
  const datos = { isPending: recursos.isPending || historial.isPending,
    isError: recursos.isError || historial.isError, data: recursos.data && historial.data }
  const despachosFiltrados = historial.data?.despachos ?? []
  const paginaDatos = historial.data
  const despachoDetalles = [...(paginaDatos?.despachoDetalles ?? []).filter(d => d.despacho_id !== seleccionado || !historial.individual), ...(historial.individual?.despachoDetalles ?? [])]
  const despachoEnvases = [...(paginaDatos?.despachoEnvases ?? []).filter(d => d.despacho_id !== seleccionado || !historial.individual), ...(historial.individual?.despachoEnvases ?? [])]
  const desvProducto = [...(paginaDatos?.desvProducto ?? []).filter(d => d.despacho_id !== seleccionado || !historial.individual), ...(historial.individual?.desvProducto ?? [])]
  const desvEnvase = [...(paginaDatos?.desvEnvase ?? []).filter(d => d.despacho_id !== seleccionado || !historial.individual), ...(historial.individual?.desvEnvase ?? [])]
  const despachos = [...despachosFiltrados.filter(d => d.id !== seleccionado || !historial.individual), ...(historial.individual?.despachos ?? [])]

  const [productoInputs, setProductoInputs] = useState<Record<string, string>>({})
  const [envaseInputs, setEnvaseInputs] = useState<
    Record<string, { buenos: string; malos: string }>
  >({})
  const [confirmarEnvases, setConfirmarEnvases] = useState(false)
  const [enviando, actualizarEnviando] = useState(false)
  const enviandoRef = useRef(false)
  function setEnviando(valor: boolean) {
    enviandoRef.current = valor
    actualizarEnviando(valor)
    setOcupado(valor)
  }
  const intento = useRef<{ contenido: string; clave: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (seleccionado) {
      detalleTitulo.current?.focus()
      detalleTitulo.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    }
  }, [seleccionado])

  const tiposEmpaqueDevolvibles = useMemo(
    () => tiposEmpaque.filter((t) => t.categoria !== 'no_retornable'),
    [tiposEmpaque],
  )

  const estadoDe = (despachoId: string): EstadoDespacho => {
    const hasProductos = desvProducto.some((x) => x.despacho_id === despachoId && !x.anulado)
    const hasEnvases = desvEnvase.some((x) => x.despacho_id === despachoId && !x.anulado)
    if (hasProductos && hasEnvases) return 'completo'
    if (hasProductos) return 'productos'
    if (hasEnvases) return 'envases'
    return 'pendiente'
  }

  const vendedorDeDespacho = (despachoId: string) =>
    despachos.find((d) => d.id === despachoId)?.vendedor_id ?? ''

  const productosDespachados = (despachoId: string) => {
    const map = new Map<string, number>()
    for (const d of despachoDetalles) {
      if (d.despacho_id !== despachoId) continue
      map.set(d.producto_id, (map.get(d.producto_id) ?? 0) + d.cantidad)
    }
    return map
  }

  const envasesDespachados = (despachoId: string) => {
    const map = new Map<string, number>()
    for (const e of despachoEnvases) {
      if (e.despacho_id !== despachoId) continue
      map.set(e.tipo_empaque_id, (map.get(e.tipo_empaque_id) ?? 0) + e.cantidad)
    }
    return map
  }

  const cargaDeDespacho = (despachoId: string, productoId: string) =>
    cargaVendedor.find(
      (c) => c.vendedor_id === vendedorDeDespacho(despachoId) && c.producto_id === productoId,
    )?.cantidad ?? 0

  const stockEnvaseDe = (tipoEmpaqueId: string) =>
    stockEnvases.find((s) => s.tipo_empaque_id === tipoEmpaqueId)?.cantidad ?? 0

  const devueltoProductoDe = (despachoId: string, productoId: string) =>
    desvProducto
      .filter((x) => x.despacho_id === despachoId && x.producto_id === productoId && !x.anulado)
      .reduce((sum, x) => sum + x.cantidad, 0)

  const devueltoEnvaseBuenoDe = (despachoId: string, tipoEmpaqueId: string) =>
    desvEnvase
      .filter(
        (x) =>
          x.despacho_id === despachoId &&
          x.tipo_empaque_id === tipoEmpaqueId &&
          x.estado === 'bueno' && !x.anulado,
      )
      .reduce((sum, x) => sum + x.cantidad, 0)

  const devueltoEnvaseMaloDe = (despachoId: string, tipoEmpaqueId: string) =>
    desvEnvase
      .filter(
        (x) =>
          x.despacho_id === despachoId &&
          x.tipo_empaque_id === tipoEmpaqueId &&
          x.estado === 'malo' && !x.anulado,
      )
      .reduce((sum, x) => sum + x.cantidad, 0)

  function prellenarInputs(despachoId: string) {
    const productos: Record<string, string> = {}
    for (const [productoId] of productosDespachados(despachoId)) {
      const devuelto = devueltoProductoDe(despachoId, productoId)
      if (devuelto > 0) productos[productoId] = String(devuelto)
    }
    const envases: Record<string, { buenos: string; malos: string }> = {}
    for (const t of tiposEmpaqueDevolvibles) {
      const buenos = devueltoEnvaseBuenoDe(despachoId, t.id)
      const malos = devueltoEnvaseMaloDe(despachoId, t.id)
      if (buenos > 0 || malos > 0) {
        envases[t.id] = {
          buenos: buenos > 0 ? String(buenos) : '',
          malos: malos > 0 ? String(malos) : '',
        }
      }
    }
    setProductoInputs(productos)
    setEnvaseInputs(envases)
  }

  function seleccionar(despachoId: string) {
    setConfirmarEnvases(false)
    setSeleccionado(despachoId)
    prellenarInputs(despachoId)
    setError(null)
  }

  const despachoSeleccionado = despachos.find((d) => d.id === seleccionado)
  const estado = seleccionado ? estadoDe(seleccionado) : null
  const productosPendientes = estado === 'pendiente' || estado === 'envases'
  const envasesPendientes = estado === 'pendiente' || estado === 'productos'
  const hayProductosRegistrados = desvProducto.some((x) => x.despacho_id === seleccionado)
  const hayEnvasesRegistrados = desvEnvase.some((x) => x.despacho_id === seleccionado)
  const editarProductos = productosPendientes || (esAdmin && hayProductosRegistrados)
  const editarEnvases = envasesPendientes || (esAdmin && hayEnvasesRegistrados)
  const esCorreccion = esAdmin && (hayProductosRegistrados || hayEnvasesRegistrados)
  const soloLectura = !esAdmin && estado === 'completo'

  const advertenciasEnvases = editarEnvases && seleccionado ? tiposEmpaqueDevolvibles.flatMap(tipo => {
    const valores = envaseInputs[tipo.id]
    const cantidad = (Number(valores?.buenos) || 0) + (Number(valores?.malos) || 0)
    const despachadas = envasesDespachados(seleccionado).get(tipo.id) ?? 0
    return cantidad > despachadas ? [{ tipoId: tipo.id, nombre: tipo.nombre, cantidad, despachadas,
      mensaje: `Devuelves ${formatMiles(cantidad)} envases de ${tipo.nombre} y se despacharon ${formatMiles(despachadas)}. Pueden venir de clientes; revisa las cantidades antes de registrar.` }] : []
  }) : []

  async function registrar(confirmado = false) {
    if (enviandoRef.current || !perfil || !seleccionado) return
    setError(null)
    const estado = estadoDe(seleccionado)

    const productosPendientes = estado === 'pendiente' || estado === 'envases'
    const envasesPendientes = estado === 'pendiente' || estado === 'productos'
    const hayProductos = desvProducto.some((x) => x.despacho_id === seleccionado)
    const hayEnvases = desvEnvase.some((x) => x.despacho_id === seleccionado)
    const esCorreccion = esAdmin && (hayProductos || hayEnvases)

    const lineasProducto = productosPendientes || esCorreccion
      ? Object.entries(productoInputs)
          .filter(([, cantidad]) => Number(cantidad) > 0)
          .map(([producto_id, cantidad]) => ({ producto_id, cantidad: Number(cantidad) }))
      : []

    const lineasEnvase = envasesPendientes || esCorreccion
      ? Object.entries(envaseInputs)
          .filter(([, v]) => Number(v.buenos) > 0 || Number(v.malos) > 0)
          .flatMap(([tipo_empaque_id, v]) => [
            ...(Number(v.buenos) > 0
              ? [{ tipo_empaque_id, cantidad: Number(v.buenos), estado: 'bueno' as const }]
              : []),
            ...(Number(v.malos) > 0
              ? [{ tipo_empaque_id, cantidad: Number(v.malos), estado: 'malo' as const }]
              : []),
          ])
      : []

    if (lineasProducto.length === 0 && lineasEnvase.length === 0) {
      setError('Registra al menos una cantidad a devolver.')
      return
    }

    const despachados = productosDespachados(seleccionado)
    for (const l of lineasProducto) {
      const max = disponibleParaDevolver(despachados.get(l.producto_id) ?? 0, devueltoProductoDe(seleccionado, l.producto_id), esCorreccion)
      if (l.cantidad > max) {
        const p = productos.find((x) => x.id === l.producto_id)
        setError(
          `No puedes devolver más de ${max} ${p?.nombre ?? 'del producto'} (disponible para devolver).`,
        )
        document.getElementById(`devolucion-producto-${l.producto_id}`)?.focus()
        return
      }
    }

    if (advertenciasEnvases.length && !confirmado) {
      setConfirmarEnvases(true)
      return
    }
    setConfirmarEnvases(false)
    setEnviando(true)
    const payload = {
      despacho_id: seleccionado,
      creado_por: perfil.id,
      lineas_producto: lineasProducto,
      lineas_envase: lineasEnvase,
    }
    // El tipo de operación forma parte del contenido: una devolución y una corrección con las mismas líneas no comparten clave.
    const contenido = JSON.stringify([esCorreccion, sucursalId, payload])
    if (intento.current?.contenido !== contenido) {
      intento.current = { contenido, clave: crypto.randomUUID() }
    }
    const { error: err } = esCorreccion
      ? await corregirDevolucion({ ...payload, idempotency_key: intento.current.clave })
      : await registrarDevolucion({ ...payload, idempotency_key: intento.current.clave })
    if (err) {
      setError(err)
      setEnviando(false)
      return
    }
    intento.current = null

    setEnviando(false)
    setProductoInputs({})
    setEnvaseInputs({})
    await load()
  }

  if (datos.isError && !datos.data) return <EstadoVista variante="error" mensaje="No fue posible cargar las devoluciones. Inténtalo de nuevo." onReintentar={() => void load()} />
  if (datos.isPending) return <EstadoVista variante="cargando" />


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Devoluciones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra lo que el vendedor devuelve al finalizar su ruta, por despacho.
          </p>
        </div>

      </div>

      {datos.isError && (<div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No fue posible actualizar. Se conservan los últimos datos disponibles. <button type="button" className={btnSecondary} onClick={() => void load()}>Reintentar</button></div>)}
      {historial.errorIndividual && <EstadoVista variante="error" mensaje="No fue posible actualizar el despacho seleccionado. Inténtalo de nuevo." onReintentar={() => void load()} />}
      {error && (
        <p id="error-devolucion" role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className={`${cardCls} min-w-0`}>
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {OPCIONES_DIA.filter(([valor]) => esAdmin || valor === 'hoy').map(
              ([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  className={
                    diaFiltro === valor
                      ? 'min-h-11 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white'
                      : 'min-h-11 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400'
                  }
                  onClick={() => {
                    setDiaFiltro(valor)
                    setFechaSeleccionada('')
                    setSeleccionado('')
                  }}
                >
                  {etiqueta}
                </button>
              ),
            )}
            {esAdmin && (
              <input
                type="date"
                aria-label="Fecha"
                className="min-h-11 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                value={fechaSeleccionada}
                onChange={(e) => {
                  setFechaSeleccionada(e.target.value)
                  setDiaFiltro(e.target.value === '' ? 'hoy' : 'fecha')
                  setSeleccionado('')
                }}
              />
            )}
          </div>

          <select
            aria-label="Filtrar por vendedor"
            className="min-h-11 min-w-0 max-w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
            value={vendedorFiltro}
            onChange={(e) => {
              setVendedorFiltro(e.target.value)
              setSeleccionado('')
            }}
          >
            <option value="">Todos los vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombres} {v.apellidos}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className={`${cardCls} min-w-0`}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Despachos</h2>
            <p className="text-sm text-slate-500">Selecciona uno para registrar la devolución</p>
          </div>

          {despachosFiltrados.length === 0 ? (
            <div role="status"><EstadoVista variante="vacio" mensaje="No hay despachos para el día y vendedor seleccionados." /></div>
          ) : (
            <ul className="space-y-2 p-3">
              {despachosFiltrados.map((d) => {
                const dEstado = estadoDe(d.id)
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => seleccionar(d.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        seleccionado === d.id
                          ? 'border-brand-200 bg-brand-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {d.vendedorNombre}
                        </p>
                        <span className={estadoBadge[dEstado]}>{estadoEtiqueta[dEstado]}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fmtFechaHora(d.creado_en)} · #{d.id.slice(0, 8)} · {d.totalUnidades} unid.
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <Paginacion pagina={historial.pagina} total={historial.data?.total ?? 0}
            onCambiar={historial.setPagina} cargando={historial.isFetching || enviando} etiqueta="Paginación de despachos" />
        </aside>

        <section className={`${cardCls} min-w-0`}>
          {!despachoSeleccionado ? (
            <div role="status"><EstadoVista variante="vacio" mensaje="Selecciona un despacho para registrar su devolución." /></div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 ref={detalleTitulo} tabIndex={-1} className="text-base font-semibold text-slate-900">
                    Devolución de {despachoSeleccionado.vendedorNombre}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {fmtFecha(despachoSeleccionado.creado_en)} ·{' '}
                    {despachoSeleccionado.totalUnidades} unid. despachadas
                  </p>
                </div>
                <span className={estadoBadge[estado!]}>{estadoEtiqueta[estado!]}</span>
              </div>

              <div className="space-y-5 p-3 sm:p-5">
                <SeccionDevolucion tono="producto" titulo="Productos del despacho" lineas={productosDespachados(seleccionado).size} yaDevueltos={!editarProductos}>
                  <ul className="divide-y divide-slate-200">
                    {[...productosDespachados(seleccionado).entries()].map(
                      ([productoId, despachado]) => {
                        const producto = productos.find((p) => p.id === productoId)
                        const disponible = disponibleParaDevolver(despachado, devueltoProductoDe(seleccionado, productoId), esCorreccion)
                        const errorCantidad = Number(productoInputs[productoId]) > disponible
                          ? `No puedes devolver más de ${disponible} ${producto?.nombre ?? 'del producto'} (disponible para devolver).` : undefined
                        return (
                          <li key={productoId} data-testid="fila-devolucion-producto" className={filaCls}>
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-900">{producto?.nombre ?? 'Producto'}</p>
                              <p className="mt-0.5 text-xs text-slate-600">
                                Despachado <b className="text-slate-900">{formatMiles(despachado)}</b>
                                {' · '}Disponible <b className="text-slate-900">{formatMiles(disponible)}</b>
                                {estado === 'pendiente' && <> · Carga <b className="text-slate-900">{formatMiles(cargaDeDespacho(seleccionado, productoId))}</b></>}
                              </p>
                            </div>
                            {editarProductos ? (
                              <div className={`w-36 @lg:w-44 ${sinFlechasMovil}`}>
                                <InputNumerico id={`devolucion-producto-${productoId}`}
                                  aria-label={`Cantidad a devolver de ${producto?.nombre ?? 'Producto'}`}
                                  aria-describedby="ayuda-devolucion-cantidad"
                                  className={inputCompact} value={productoInputs[productoId] ?? ''} error={errorCantidad}
                                  onChange={valor => {
                                    setError(null)
                                    setProductoInputs(prev => ({ ...prev, [productoId]: valor === undefined ? '' : String(valor) }))
                                  }} />
                              </div>
                            ) : (
                              <span className="text-right text-sm font-bold text-amber-800">
                                −{formatMiles(devueltoProductoDe(seleccionado, productoId))}
                              </span>
                            )}
                          </li>
                        )
                      },
                    )}
                  </ul>
                  {editarProductos && (
                    <p id="ayuda-devolucion-cantidad" className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                      La devolución de cada producto tiene como límite lo despachado menos lo ya devuelto. En una corrección se reemplazan las cantidades anteriores.
                    </p>
                  )}
                </SeccionDevolucion>

                <SeccionDevolucion tono="envase" titulo="Envases" lineas={tiposEmpaqueDevolvibles.length} yaDevueltos={!editarEnvases}>
                  <ul className="divide-y divide-slate-200">
                    {tiposEmpaqueDevolvibles.map((t) => {
                      const despachadas = envasesDespachados(seleccionado).get(t.id) ?? 0
                      const input = envaseInputs[t.id] ?? { buenos: '', malos: '' }
                      const advertencia = advertenciasEnvases.find(item => item.tipoId === t.id)
                      const advertenciaId = `advertencia-envase-${t.id}`
                      return (
                        <li key={t.id} data-testid="fila-devolucion-envase" className="grid min-w-0 gap-x-3 gap-y-2 px-3 py-3 @lg:grid-cols-[minmax(0,1fr)_auto] @lg:items-center">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-slate-900">{t.nombre}</p>
                            <p className="mt-0.5 text-xs text-slate-600">
                              Despachadas <b className="text-slate-900">{formatMiles(despachadas)}</b>
                              {' · '}En bodega <b className="text-slate-900">{formatMiles(stockEnvaseDe(t.id))}</b>
                            </p>
                          </div>
                          {editarEnvases ? (
                            <div className={`grid grid-cols-2 gap-3 @lg:w-80 ${sinFlechasMovil}`}>
                              <div className="min-w-0">
                                <span className="block text-xs font-medium text-slate-700">Buenos</span>
                                <InputNumerico aria-label={`Cantidad de envases buenos de ${t.nombre}`}
                                  aria-describedby={advertencia ? advertenciaId : undefined}
                                  className={inputCompact} value={input.buenos}
                                  onChange={valor => {
                                    setError(null)
                                    setEnvaseInputs(prev => ({ ...prev, [t.id]: { ...input, buenos: valor === undefined ? '' : String(valor) } }))
                                  }} />
                              </div>
                              <div className="min-w-0">
                                <span className="block text-xs font-medium text-slate-700">Malos</span>
                                <InputNumerico aria-label={`Cantidad de envases malos de ${t.nombre}`}
                                  aria-describedby={advertencia ? advertenciaId : undefined}
                                  className={inputCompact} value={input.malos}
                                  onChange={valor => {
                                    setError(null)
                                    setEnvaseInputs(prev => ({ ...prev, [t.id]: { ...input, malos: valor === undefined ? '' : String(valor) } }))
                                  }} />
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm font-bold @lg:text-right">
                              <span className="text-emerald-800">+{formatMiles(devueltoEnvaseBuenoDe(seleccionado, t.id))} buenos</span>
                              <span className="ml-3 text-amber-800">+{formatMiles(devueltoEnvaseMaloDe(seleccionado, t.id))} malos</span>
                            </p>
                          )}
                          {advertencia && editarEnvases && <p id={advertenciaId} role="status" className="text-xs text-amber-800 @lg:col-span-2">{advertencia.mensaje}</p>}
                        </li>
                      )
                    })}
                  </ul>
                  <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                    Solo los envases en estado “bueno” vuelven al stock de bodega.
                  </p>
                </SeccionDevolucion>

                {!soloLectura && (
                  <div className="border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      className={`${btnPrimary} w-full`}
                      disabled={enviando || !!historial.errorIndividual}
                      onClick={() => void registrar()}
                    >
                      {enviando
                        ? 'Guardando...'
                        : esCorreccion
                          ? 'Guardar corrección'
                          : 'Registrar devolución'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      <Dialog open={confirmarEnvases} onClose={() => { if (!enviando) setConfirmarEnvases(false) }}
        title="Confirmar devolución de envases"
        description="La cantidad de algunos envases supera lo despachado. Pueden venir de clientes y está permitido registrarlos; confirma que las cantidades son correctas.">
        <ul className="space-y-2 text-sm text-slate-700">{advertenciasEnvases.map(item => <li key={item.tipoId}>{item.mensaje}</li>)}</ul>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={btnSecondary} onClick={() => setConfirmarEnvases(false)}>Volver a revisar</button>
          <button type="button" className={btnPrimary} disabled={enviando} onClick={() => void registrar(true)}>
            {esCorreccion ? 'Confirmar y guardar corrección' : 'Confirmar y registrar'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
