// Nota de dominio: esta página es del dominio BODEGA (HU-26/27/28), no del
// dominio Ventas. Vive en feature/bodega y aparece acá solo porque la rama
// feature/ventas nació de develop y arrastró este componente compartido. En
// un futuro queda en consideración aislar la navegación de despachos para
// que no se mezcle con el menú del vendedor de ventas.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from '../../../components/Toast'
import { useToast } from '../../../components/toast-utils'
import Dialog from '../../../components/Dialog'
import InputNumerico from '../../../components/InputNumerico'
import { useAuth } from '../../../context/auth-context'
import { crearDespacho } from '../api'
import { btnPrimary, btnSecondary, cardCls, inputCls, labelCls } from '../../../lib/ui'
import { fmtFecha, fmtFechaHora, formatMiles, parseMiles } from '../../../lib/format'
import EstadoVista from '../../../components/EstadoVista'
import AmbitoBodega from '../components/AmbitoBodega'
import { useDatosBodega } from '../hooks/useDatosBodega'
import { fechaSantiago, inicioPeriodo, useJornadaSantiago } from '../hooks/useJornadaSantiago'

interface LineaProducto {
  id: string
  producto_id: string
  cantidad: string
}

interface GrupoDevolucion {
  despachoId: string
  vendedor: string
  fecha: string
  lineas: {
    id: string
    tipo: 'producto' | 'envase'
    descripcion: string
    cantidad: number
  }[]
}

type FiltroDia = 'hoy' | 'ayer' | '7d' | 'todo' | 'fecha'

function nuevaLinea(): LineaProducto {
  return { id: crypto.randomUUID(), producto_id: '', cantidad: '' }
}

const CAPACIDAD_BANDEJA = 10

const OPCIONES_DIA: Array<[FiltroDia, string]> = [
  ['hoy', 'Hoy'],
  ['ayer', 'Ayer'],
  ['7d', '7 días'],
  ['todo', 'Todo'],
]

function AvatarNombre({ nombre }: { nombre: string }) {
  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
      {iniciales}
    </span>
  )
}

function fmtHora(iso: string) {
  return fmtFechaHora(iso).split(' ')[1]
}

export default function Despachos() {
  return <AmbitoBodega>{(sucursalId, setOcupado) => <DespachosSucursal sucursalId={sucursalId} setOcupado={setOcupado} />}</AmbitoBodega>
}

function DespachosSucursal({ sucursalId, setOcupado }: { sucursalId: string; setOcupado: (ocupado: boolean) => void }) {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'
  const navigate = useNavigate()

  const datos = useDatosBodega(sucursalId, true)
  const jornada = useJornadaSantiago()
  const { vendedores = [], productos = [], tiposEmpaque = [], despachos = [],
    despachoDetalles = [], despachoEnvases = [], desvProducto = [], desvEnvase = [],
    stockEnvases = [], cargaVendedor = [], stockBodega = [] } = datos.data ?? {}
  const load = datos.refetch
  const productosActivos = productos.filter(producto => producto.activo)

  const [modalOpen, setModalOpen] = useState(false)
  const [vendedorId, setVendedorId] = useState('')
  const [lineas, setLineas] = useState<LineaProducto[]>(() => [nuevaLinea()])
  // Bandejas: valor manual del usuario junto al total de hielo con que se
  // escribió. Si el hielo cambia, manda el auto-cálculo (1 cada CAPACIDAD_BANDEJA).
  const [bandejasManual, setBandejasManual] = useState<{ hielo: number; valor: string } | null>(
    null,
  )
  const [enviando, actualizarEnviando] = useState(false)
  function setEnviando(valor: boolean) {
    actualizarEnviando(valor)
    setOcupado(valor)
  }
  const intento = useRef<{ contenido: string; clave: string } | null>(null)

  const [despachoExpandido, setDespachoExpandido] = useState<string | null>(null)
  const [diaFiltro, setDiaFiltro] = useState<'hoy' | 'ayer' | '7d' | 'todo' | 'fecha'>('hoy')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [vendedorFiltro, setVendedorFiltro] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [campoError, setCampoError] = useState({ id: '', intento: 0 })
  const { toast, mostrar, cerrar } = useToast()
  function informarError(mensaje: string, id: string) {
    setError(mensaje)
    setCampoError(prev => ({ id, intento: prev.intento + 1 }))
  }
  function atributosError(id: string) {
    return { id, 'aria-invalid': !!error && campoError.id === id || undefined, 'aria-describedby': error && campoError.id === id ? 'error-despacho' : undefined }
  }
  useLayoutEffect(() => {
    if (error) document.getElementById(campoError.id)?.focus()
  }, [error, campoError])
  useEffect(() => {
    if (modalOpen) document.getElementById('despacho-vendedor')?.focus()
  }, [modalOpen])

  const bandejaTipo = useMemo(
    () => tiposEmpaque.find((t) => t.categoria === 'uso_interno') ?? null,
    [tiposEmpaque],
  )

  const totalHieloSolicitado = useMemo(
    () =>
      lineas.reduce((sum, l) => {
        if (!l.producto_id || parseMiles(l.cantidad) <= 0) return sum
        const productoLinea = productos.find((p) => p.id === l.producto_id)
        return productoLinea?.tipo === 'hielo' ? sum + parseMiles(l.cantidad) : sum
      }, 0),
    [lineas, productos],
  )

  const bandejasSugeridas = Math.ceil(totalHieloSolicitado / CAPACIDAD_BANDEJA)
  const bandejasAuto = totalHieloSolicitado > 0 ? String(bandejasSugeridas) : ''
  const bandejasCantidad =
    bandejasManual && bandejasManual.hielo === totalHieloSolicitado
      ? bandejasManual.valor
      : bandejasAuto

  const motivoLimite = productosActivos.length === 0 ? 'No hay productos activos en el catálogo.'
    : lineas.length >= productosActivos.length ? `Máximo ${productosActivos.length} productos por despacho: ya alcanzaste el número de productos activos del catálogo.`
    : undefined
  const disponibleBandejas = stockEnvases.find(item => item.tipo_empaque_id === bandejaTipo?.id)?.cantidad ?? 0
  const errorBandejas = parseMiles(bandejasCantidad) > disponibleBandejas
    ? `Excede el stock de bandejas: disponibles ${formatMiles(disponibleBandejas)}.` : undefined

  async function registrarDespacho() {
    if (!perfil) return
    setError(null)
    setCampoError(prev => ({ ...prev, id: '' }))

    if (!sucursalId) {
      setError('Selecciona una sucursal para registrar el despacho.')
      return
    }

    if (lineas.length > productosActivos.length) {
      setError(`El catálogo tiene ${productosActivos.length} productos activos. Quita las líneas adicionales.`)
      return
    }

    const lineasValidas = lineas.filter((l) => l.producto_id && parseMiles(l.cantidad) > 0)
    if (!vendedorId || lineasValidas.length === 0) {
      informarError('Selecciona un vendedor y agrega al menos un producto.', !vendedorId ? 'despacho-vendedor' : lineas[0]?.producto_id ? `despacho-cantidad-${lineas[0].id}` : `despacho-producto-${lineas[0]?.id}`)
      return
    }

    const solicitadoPorProducto = new Map<string, number>()
    for (const l of lineasValidas) {
      const actual = solicitadoPorProducto.get(l.producto_id) ?? 0
      solicitadoPorProducto.set(l.producto_id, actual + parseMiles(l.cantidad))
    }
    for (const [productoId, solicitado] of solicitadoPorProducto) {
      const disponible = stockBodega.find((s) => s.producto_id === productoId)?.cantidad ?? 0
      if (solicitado > disponible) {
        const producto = productos.find((p) => p.id === productoId)
        informarError(
          `Stock insuficiente en bodega para ${producto?.nombre ?? 'el producto'}: ` +
            `disponible ${formatMiles(disponible)}, solicitado ${formatMiles(solicitado)}.`,
          `despacho-cantidad-${lineas.find(item => item.producto_id === productoId)?.id}`,
        )
        return
      }
    }

    const bandejas = parseMiles(bandejasCantidad)
    const envasesValidos =
      bandejaTipo && bandejas > 0 ? [{ tipo_empaque_id: bandejaTipo.id, cantidad: bandejas }] : []
    for (const l of envasesValidos) {
      const disponible = stockEnvases.find((s) => s.tipo_empaque_id === l.tipo_empaque_id)?.cantidad ?? 0
      if (l.cantidad > disponible) {
        informarError(
          `Stock insuficiente de envases para ${bandejaTipo?.nombre ?? 'el envase'}: ` +
            `disponible ${formatMiles(disponible)}, solicitado ${formatMiles(l.cantidad)}.`,
          'despacho-bandejas',
        )
        return
      }
    }

    setEnviando(true)
    const payload = {
      sucursal_id: sucursalId,
      vendedor_id: vendedorId,
      despachador_id: perfil.id,
      creado_por: perfil.id,
      lineas: lineasValidas.map((l) => ({
        producto_id: l.producto_id,
        cantidad: parseMiles(l.cantidad),
      })),
      envases: envasesValidos.map((l) => ({
        tipo_empaque_id: l.tipo_empaque_id,
        cantidad: parseMiles(String(l.cantidad)),
      })),
    }
    const contenido = JSON.stringify(payload)
    if (intento.current?.contenido !== contenido) {
      intento.current = { contenido, clave: crypto.randomUUID() }
    }
    const { error: err } = await crearDespacho({ ...payload, idempotency_key: intento.current.clave })

    if (err) {
      setError(err)
      setEnviando(false)
      return
    }

    intento.current = null
    setEnviando(false)
    setModalOpen(false)
    setVendedorId('')
    setLineas([nuevaLinea()])
    setBandejasManual(null)
    mostrar('Despacho registrado.')
    await load()
  }

  const stockDisponible = (productoId: string) =>
    stockBodega.find((s) => s.producto_id === productoId)?.cantidad ?? 0

  const cargaDelVendedor = (productoId: string) =>
    cargaVendedor.find(
      (c) => c.vendedor_id === vendedorId && c.producto_id === productoId,
    )?.cantidad ?? 0

  const cargaVendedorSeleccionado = cargaVendedor.filter((c) => c.vendedor_id === vendedorId)

  const detallesDeDespacho = (despachoId: string) =>
    despachoDetalles.filter((d) => d.despacho_id === despachoId)

  const envasesDeDespacho = (despachoId: string) =>
    despachoEnvases.filter((e) => e.despacho_id === despachoId)

  const devolucionesDe = (despachoId: string) => ({
    productos: desvProducto.filter((x) => x.despacho_id === despachoId),
    envases: desvEnvase.filter((x) => x.despacho_id === despachoId),
  })

  const horaLlegadaDe = (despachoId: string) => {
    const fechas = [
      ...desvProducto.filter((x) => x.despacho_id === despachoId).map((x) => x.creado_en),
      ...desvEnvase.filter((x) => x.despacho_id === despachoId).map((x) => x.creado_en),
    ]
    return fechas.length > 0 ? fechas.sort().reverse()[0] : null
  }

  const diaObjetivo = diaFiltro === 'fecha' ? fechaSeleccionada
    : diaFiltro === 'todo' ? ''
    : inicioPeriodo(jornada, diaFiltro === 'ayer' ? 1 : diaFiltro === '7d' ? 6 : 0)

  const despachosFiltrados = useMemo(() => {
    return despachos.filter((d) => {
      if (vendedorFiltro && d.vendedor_id !== vendedorFiltro) return false
      if (diaFiltro === 'todo') return true
      const fechaDespacho = fechaSantiago(new Date(d.creado_en))
      if (diaFiltro === '7d') return fechaDespacho >= diaObjetivo
      return fechaDespacho === diaObjetivo
    })
  }, [despachos, vendedorFiltro, diaFiltro, diaObjetivo])

  const gruposDevolucion = useMemo<GrupoDevolucion[]>(() => {
    const idsVisibles = new Set(despachosFiltrados.map((d) => d.id))
    const grupos = new Map<string, GrupoDevolucion>()
    const asegurar = (despachoId: string) => {
      let grupo = grupos.get(despachoId)
      if (!grupo) {
        const d = despachos.find((x) => x.id === despachoId)
        grupo = {
          despachoId,
          vendedor: d?.vendedorNombre ?? 'Vendedor no disponible',
          fecha: d?.creado_en ?? '',
          lineas: [],
        }
        grupos.set(despachoId, grupo)
      }
      return grupo
    }
    for (const dv of desvProducto) {
      if (!idsVisibles.has(dv.despacho_id)) continue
      const p = productos.find((x) => x.id === dv.producto_id)
      asegurar(dv.despacho_id).lineas.push({
        id: `dp-${dv.id}`,
        tipo: 'producto',
        descripcion: p?.nombre ?? 'Producto',
        cantidad: dv.cantidad,
      })
    }
    for (const de of desvEnvase) {
      if (!idsVisibles.has(de.despacho_id)) continue
      const t = tiposEmpaque.find((x) => x.id === de.tipo_empaque_id)
      asegurar(de.despacho_id).lineas.push({
        id: `de-${de.id}`,
        tipo: 'envase',
        descripcion: `${t?.nombre ?? 'Envase'} (${de.estado})`,
        cantidad: de.cantidad,
      })
    }
    return [...grupos.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  }, [desvProducto, desvEnvase, despachos, despachosFiltrados, productos, tiposEmpaque])

  if (datos.isError && !datos.data) return <EstadoVista variante="error" mensaje="No fue posible cargar los despachos. Inténtalo de nuevo." onReintentar={() => void load()} />
  if (datos.isPending) return <EstadoVista variante="cargando" />

  return (
    <div className="space-y-6">
      <Toast toast={toast} onClose={cerrar} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Despachos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra salidas hacia vendedores y devoluciones de productos o envases.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => navigate('/devoluciones')}
          >
            Devoluciones
          </button>
          <button type="button" className={btnPrimary} onClick={() => { setError(null); cerrar(); setModalOpen(true) }}>
            Nuevo despacho
          </button>
        </div>
      </div>

      {!modalOpen && datos.isError && (<div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No fue posible actualizar. Se conservan los últimos datos disponibles. <button type="button" className={btnSecondary} onClick={() => void load()}>Reintentar</button></div>)}
      {error && !modalOpen && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className={`${cardCls} min-w-0`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Últimos despachos</h2>
            <span className="text-xs text-slate-600">{despachosFiltrados.length} registros</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
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
                      setDespachoExpandido(null)
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
                    setDespachoExpandido(null)
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
                setDespachoExpandido(null)
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

          {despachos.length === 0 ? (
            <div role="status"><EstadoVista variante="vacio" mensaje="Aún no hay despachos para esta sucursal." /></div>
          ) : despachosFiltrados.length === 0 ? (
            <div role="status"><EstadoVista variante="vacio" mensaje="No hay despachos para el día y vendedor seleccionados." /></div>
          ) : (
            <ul className="space-y-2 p-3">
              {despachosFiltrados.map((d) => {
                const expandido = despachoExpandido === d.id
                const detalles = detallesDeDespacho(d.id)
                const devs = devolucionesDe(d.id)
                const llegada = horaLlegadaDe(d.id)
                return (
                  <li
                    key={d.id}
                    className={`rounded-xl border transition ${
                      expandido
                        ? 'border-brand-200 bg-brand-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={expandido}
                      aria-controls={`despacho-${d.id}`}
                      onClick={() => setDespachoExpandido(expandido ? null : d.id)}
                      className="flex min-w-0 w-full flex-col items-start gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <AvatarNombre nombre={d.vendedorNombre} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {d.vendedorNombre}
                          </p>
                          <p className="text-xs text-slate-500">{fmtFechaHora(d.creado_en)} · #{d.id.slice(0, 8)}</p>
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
                        <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
                          {formatMiles(d.totalUnidades)} unid.
                        </span>
                        {llegada && (
                          <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white">
                            Llegada {fmtHora(llegada)}
                          </span>
                        )}
                        <span
                          className={`text-slate-600 transition-transform ${
                            expandido ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        >
                          ▼
                        </span>
                      </div>
                    </button>

                    {expandido && (
                      <div id={`despacho-${d.id}`} className="space-y-3 border-t border-slate-100 px-4 py-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Productos despachados
                          </p>
                          {detalles.length === 0 ? (
                            <p className="mt-1 text-sm text-slate-500">Sin detalles registrados.</p>
                          ) : (
                            <ul className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                              {detalles.map((det) => (
                                <li
                                  key={det.id}
                                  className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0"
                                >
                                  <span className="text-slate-700">
                                    {productos.find((p) => p.id === det.producto_id)?.nombre ??
                                      'Producto'}
                                  </span>
                                  <span className="font-semibold text-slate-900">
                                    {formatMiles(det.cantidad)}
                                  </span>
                                </li>
                              ))}
                              <li className="flex items-center justify-between bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                                <span>Total</span>
                                <span>{formatMiles(d.totalUnidades)}</span>
                              </li>
                            </ul>
                          )}
                        </div>

                        {envasesDeDespacho(d.id).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Envases despachados
                            </p>
                            <ul className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                              {envasesDeDespacho(d.id).map((env) => (
                                <li
                                  key={env.id}
                                  className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0"
                                >
                                  <span className="text-slate-700">
                                    {tiposEmpaque.find((t) => t.id === env.tipo_empaque_id)?.nombre ??
                                      'Envase'}
                                  </span>
                                  <span className="font-semibold text-slate-900">
                                    {formatMiles(env.cantidad)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(devs.productos.length > 0 || devs.envases.length > 0) && (
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Devoluciones
                              </p>
                              {llegada && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  Llegada · {fmtFecha(llegada)}
                                </span>
                              )}
                            </div>
                            <ul className="mt-2 space-y-1">
                              {devs.productos.map((dv) => (
                                <li
                                  key={dv.id}
                                  className="flex items-center justify-between text-sm text-slate-700"
                                >
                                  <span>
                                    {productos.find((p) => p.id === dv.producto_id)?.nombre ??
                                      'Producto'}
                                  </span>
                                  <span className="font-medium text-amber-700">−{formatMiles(dv.cantidad)}</span>
                                </li>
                              ))}
                              {devs.envases.map((de) => (
                                <li
                                  key={de.id}
                                  className="flex items-center justify-between text-sm text-slate-700"
                                >
                                  <span>
                                    {tiposEmpaque.find((t) => t.id === de.tipo_empaque_id)?.nombre ??
                                      'Envase'}
                                  </span>
                                  <span
                                    className={
                                      de.estado === 'bueno'
                                        ? 'font-medium text-emerald-700'
                                        : 'font-medium text-amber-700'
                                    }
                                  >
                                    +{formatMiles(de.cantidad)} {de.estado === 'bueno' ? 'buenas' : 'malas'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => navigate('/devoluciones')}
                        >
                          Registrar devolución
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className={`${cardCls} min-w-0`}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Devoluciones</h2>
            <p className="text-sm text-slate-500">Agrupadas por despacho</p>
          </div>

          {gruposDevolucion.length === 0 ? (
            <div role="status"><EstadoVista variante="vacio" mensaje="Aún no hay devoluciones para esta sucursal." /></div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {gruposDevolucion.map((g) => (
                <li key={g.despachoId} className="px-4 py-3">
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <p className="max-w-full truncate text-sm font-semibold text-slate-900">{g.vendedor}</p>
                    <span className="text-xs text-slate-500">{fmtFechaHora(g.fecha)} · #{g.despachoId.slice(0, 8)}</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {g.lineas.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-slate-700">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              l.tipo === 'producto' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="truncate">{l.descripcion}</span>
                        </span>
                        <span
                          className={`shrink-0 font-medium ${
                            l.tipo === 'producto' ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {l.tipo === 'producto' ? `−${formatMiles(l.cantidad)}` : `+${formatMiles(l.cantidad)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <Dialog open={modalOpen} onClose={() => { if (!enviando) { setError(null); setModalOpen(false) } }} title="Nuevo despacho">
            {datos.isError && (<div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No fue posible actualizar. Se conservan los últimos datos disponibles. <button type="button" className={btnSecondary} onClick={() => void load()}>Reintentar</button></div>)}
            {error && <p id="error-despacho" role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <label className={labelCls}>
              Vendedor
              <select
                className={inputCls}
                value={vendedorId}
                {...atributosError('despacho-vendedor')}
                onChange={(e) => { setError(null); setVendedorId(e.target.value) }}
              >
                <option value="">Selecciona un vendedor...</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombres} {v.apellidos}
                  </option>
                ))}
              </select>
            </label>

            {vendedorId && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Carga actual del vendedor
                </p>
                {cargaVendedorSeleccionado.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">Sin carga registrada.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {cargaVendedorSeleccionado.map((c) => (
                      <li
                        key={c.producto_id}
                        className="flex items-center justify-between text-sm text-slate-700"
                      >
                        <span>
                          {productos.find((p) => p.id === c.producto_id)?.nombre ?? 'Producto'}
                        </span>
                        <span className="font-semibold text-slate-900">{formatMiles(c.cantidad)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Productos del despacho</p>
              {lineas.map((linea, index) => {
                const solicitado = lineas.filter(item => item.producto_id === linea.producto_id)
                  .reduce((total, item) => total + parseMiles(item.cantidad), 0)
                const errorCantidad = linea.producto_id && solicitado > stockDisponible(linea.producto_id)
                  ? `Excede el stock en bodega: disponibles ${formatMiles(stockDisponible(linea.producto_id))}.` : undefined
                const ayudaId = `disponible-despacho-${linea.id}`
                const atributosProducto = atributosError(`despacho-producto-${linea.id}`)
                return <div key={linea.id} className="grid min-w-0 grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
                  <div className="min-w-0">
                    <label htmlFor={atributosProducto.id} className={labelCls}>Producto</label>
                    <select className={inputCls} value={linea.producto_id} {...atributosProducto}
                      aria-describedby={[atributosProducto['aria-describedby'], linea.producto_id ? ayudaId : undefined].filter(Boolean).join(' ') || undefined}
                      onChange={event => {
                        setError(null)
                        setLineas(prev => prev.map(item => item.id === linea.id ? { ...item, producto_id: event.target.value } : item))
                      }}>
                      <option value="">Selecciona producto...</option>
                      {productosActivos.map(producto => <option key={producto.id} value={producto.id}
                        disabled={lineas.some((item, i) => i !== index && item.producto_id === producto.id)}>
                        {producto.nombre} (disp. {formatMiles(stockDisponible(producto.id))})
                      </option>)}
                    </select>
                    {linea.producto_id && <span id={ayudaId} className="mt-1 block text-xs text-slate-500">
                      Disponible en bodega: <b className="text-slate-700">{formatMiles(stockDisponible(linea.producto_id))}</b>
                      {vendedorId && <> · Carga del vendedor: <b className="text-slate-700">{formatMiles(cargaDelVendedor(linea.producto_id))}</b></>}
                    </span>}
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`despacho-cantidad-${linea.id}`} className={labelCls}>Cantidad</label>
                    <InputNumerico {...atributosError(`despacho-cantidad-${linea.id}`)} value={linea.cantidad} error={errorCantidad}
                      onChange={valor => {
                        setError(null)
                        setLineas(prev => prev.map(item => item.id === linea.id ? { ...item, cantidad: valor === undefined ? '' : String(valor) } : item))
                      }} />
                  </div>
                  <button type="button" className={`${btnSecondary} sm:mt-6`} onClick={() => setLineas(prev => prev.filter(item => item.id !== linea.id))}>Quitar</button>
                </div>
              })}
              <button type="button" className={btnSecondary} disabled={!!motivoLimite}
                aria-describedby={motivoLimite ? 'limite-productos-despacho' : undefined}
                onClick={() => setLineas(prev => prev.length < productosActivos.length ? [...prev, nuevaLinea()] : prev)}>
                + Agregar producto
              </button>
              {motivoLimite && <p id="limite-productos-despacho" className="text-xs text-slate-600">{motivoLimite}</p>}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Bandejas del despacho</p>
              {!bandejaTipo ? (
                <p className="text-sm text-slate-500">No hay tipos de envase configurados.</p>
              ) : (
                <>
                  <div>
                    <label htmlFor="despacho-bandejas" className={labelCls}>Bandejas</label>
                    <InputNumerico {...atributosError('despacho-bandejas')} value={bandejasCantidad} error={errorBandejas}
                      onChange={valor => {
                        setError(null)
                        setBandejasManual({ hielo: totalHieloSolicitado, valor: valor === undefined ? '' : String(valor) })
                      }} />
                  </div>
                  <p className="text-xs text-slate-500">
                    Se completan solas: 1 bandeja cada {CAPACIDAD_BANDEJA} bolsas de hielo.
                  </p>
                  {totalHieloSolicitado > 0 && parseMiles(bandejasCantidad) !== bandejasSugeridas && (
                    <p className="text-xs text-amber-700">Sugerido: {formatMiles(bandejasSugeridas)}</p>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => { if (!enviando) { setError(null); setModalOpen(false) } }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={enviando}
                onClick={() => void registrarDespacho()}
              >
                {enviando ? 'Registrando...' : 'Registrar despacho'}
              </button>
            </div>
      </Dialog>
    </div>
  )
}
