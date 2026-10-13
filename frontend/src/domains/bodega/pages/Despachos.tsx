// Nota de dominio: esta página es del dominio BODEGA (HU-26/27/28), no del
// dominio Ventas. Vive en feature/bodega y aparece acá solo porque la rama
// feature/ventas nació de develop y arrastró este componente compartido. En
// un futuro queda en consideración aislar la navegación de despachos para
// que no se mezcle con el menú del vendedor de ventas.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Dialog from '../../../components/Dialog'
import { useAuth } from '../../../context/auth-context'
import {
  crearDespacho,
  obtenerCargaVendedores,
  obtenerDespachos,
  obtenerDetallesDespacho,
  obtenerDevolucionesEnvase,
  obtenerDevolucionesProducto,
  obtenerEnvasesDespacho,
  obtenerStockBodega,
  obtenerStockEnvases,
  obtenerVendedores,
} from '../api'
import { obtenerProductos, obtenerSucursales, obtenerTiposEmpaque } from '../../../lib/catalog'
import { btnPrimary, btnSecondary, cardCls, fmtFecha, inputCls, labelCls } from '../../../lib/ui'
import { formatMiles, formatMilesInput, parseMiles } from '../../../lib/format'
import type { Perfil, Producto, Sucursal, TipoEmpaque } from '../../../types'
import type {
  CargaVendedor,
  Despacho,
  DespachoDetalle,
  DespachoEnvase,
  DevolucionEnvase,
  DevolucionProducto,
  StockBodega,
  StockEnvases,
} from '../types'

interface DespachoConTotal extends Despacho {
  totalUnidades: number
  vendedorNombre: string
}

interface LineaProducto {
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
  return new Date(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function aaaammdd(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export default function Despachos() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'
  const navigate = useNavigate()

  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalId] = useState('')
  const [vendedores, setVendedores] = useState<Perfil[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [tiposEmpaque, setTiposEmpaque] = useState<TipoEmpaque[]>([])
  const [despachos, setDespachos] = useState<DespachoConTotal[]>([])
  const [despachoDetalles, setDespachoDetalles] = useState<DespachoDetalle[]>([])
  const [despachoEnvases, setDespachoEnvases] = useState<DespachoEnvase[]>([])
  const [desvProducto, setDesvProducto] = useState<DevolucionProducto[]>([])
  const [desvEnvase, setDesvEnvase] = useState<DevolucionEnvase[]>([])
  const [stockBodega, setStockBodega] = useState<StockBodega[]>([])
  const [stockEnvases, setStockEnvases] = useState<StockEnvases[]>([])
  const [cargaVendedor, setCargaVendedor] = useState<CargaVendedor[]>([])
  const [cargando, setCargando] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [vendedorId, setVendedorId] = useState('')
  const [lineas, setLineas] = useState<LineaProducto[]>([{ producto_id: '', cantidad: '' }])
  // Bandejas: valor manual del usuario junto al total de hielo con que se
  // escribió. Si el hielo cambia, manda el auto-cálculo (1 cada CAPACIDAD_BANDEJA).
  const [bandejasManual, setBandejasManual] = useState<{ hielo: number; valor: string } | null>(
    null,
  )
  const [enviando, setEnviando] = useState(false)
  const intento = useRef<{ contenido: string; clave: string } | null>(null)

  const [despachoExpandido, setDespachoExpandido] = useState<string | null>(null)
  const [diaFiltro, setDiaFiltro] = useState<'hoy' | 'ayer' | '7d' | 'todo' | 'fecha'>('hoy')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [vendedorFiltro, setVendedorFiltro] = useState('')

  const [versionLectura, setVersionLectura] = useState(0)
  const [errorLectura, setErrorLectura] = useState<string | null>(null)
  const [errorSucursales, setErrorSucursales] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    async function init() {
      const data = await obtenerSucursales()
      setErrorSucursales(null)
      setSucursales(data)
      setSucursalId((actual) => actual || perfil?.sucursal_id || data[0]?.id || '')
    }
    void init().catch(() => {
      setErrorSucursales('No fue posible cargar las sucursales. Inténtalo de nuevo.')
      setCargando(false)
    })
  }, [perfil, versionLectura])

  const load = useCallback(async () => {
    try {
      setErrorLectura(null)
      const [vendedoresData, productosData, empaquesData, despachosRaw, stockRaw, envasesRaw] =
        await Promise.all([
          obtenerVendedores(sucursalId),
          obtenerProductos(true),
          obtenerTiposEmpaque(),
          obtenerDespachos(sucursalId),
          obtenerStockBodega(sucursalId),
          obtenerStockEnvases(sucursalId),
        ])

      const ids = despachosRaw.map((d) => d.id)
      const [detalles, envases, dProd, dEnv, cargaRaw] = await Promise.all([
        obtenerDetallesDespacho(ids),
        obtenerEnvasesDespacho(ids),
        obtenerDevolucionesProducto(ids),
        obtenerDevolucionesEnvase(ids),
        obtenerCargaVendedores(vendedoresData.map((v) => v.id)),
      ])

      const nombreVendedor = (id: string) => {
        const v = vendedoresData.find((x) => x.id === id)
        return v ? `${v.nombres} ${v.apellidos}` : 'Desconocido'
      }

      setVendedores(vendedoresData)
      setProductos(productosData)
      setTiposEmpaque(empaquesData)
      setDespachos(
        despachosRaw.map((d) => ({
          ...d,
          totalUnidades: detalles
            .filter((x) => x.despacho_id === d.id)
            .reduce((sum, x) => sum + x.cantidad, 0),
          vendedorNombre: nombreVendedor(d.vendedor_id),
        })),
      )
      setDespachoDetalles(detalles)
      setDespachoEnvases(envases)
      setDesvProducto(dProd)
      setDesvEnvase(dEnv)
      setStockBodega(stockRaw)
      setStockEnvases(envasesRaw)
      setCargaVendedor(cargaRaw)
    } catch {
      setErrorLectura('No fue posible cargar los despachos. Inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }, [sucursalId])

  useEffect(() => {
    async function cargar() {
      await load()
    }
    void cargar()
  }, [load, versionLectura])

  async function registrarDespacho() {
    if (!perfil) return
    setError(null)

    if (!sucursalId) {
      setError('Selecciona una sucursal para registrar el despacho.')
      return
    }

    const lineasValidas = lineas.filter((l) => l.producto_id && parseMiles(l.cantidad) > 0)
    if (!vendedorId || lineasValidas.length === 0) {
      setError('Selecciona un vendedor y agrega al menos un producto.')
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
        setError(
          `Stock insuficiente en bodega para ${producto?.nombre ?? 'el producto'}: ` +
            `disponible ${formatMiles(disponible)}, solicitado ${formatMiles(solicitado)}.`,
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
        setError(
          `Stock insuficiente de envases para ${bandejaTipo?.nombre ?? 'el envase'}: ` +
            `disponible ${formatMiles(disponible)}, solicitado ${formatMiles(l.cantidad)}.`,
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
    setLineas([{ producto_id: '', cantidad: '' }])
    setBandejasManual(null)
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

  const diaObjetivo = useMemo(() => {
    if (diaFiltro === 'fecha') return fechaSeleccionada
    if (diaFiltro === 'todo') return ''
    const hoy = new Date()
    if (diaFiltro === 'hoy') return aaaammdd(hoy)
    if (diaFiltro === 'ayer') {
      const ayer = new Date(hoy)
      ayer.setDate(hoy.getDate() - 1)
      return aaaammdd(ayer)
    }
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - 6)
    return aaaammdd(inicio)
  }, [diaFiltro, fechaSeleccionada])

  const despachosFiltrados = useMemo(() => {
    return despachos.filter((d) => {
      if (vendedorFiltro && d.vendedor_id !== vendedorFiltro) return false
      if (diaFiltro === 'todo') return true
      const fechaDespacho = aaaammdd(new Date(d.creado_en))
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
          vendedor: d?.vendedorNombre ?? 'Desconocido',
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

  if (errorSucursales || errorLectura) {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorSucursales ?? errorLectura}</p>
        <button type="button" className={btnSecondary} onClick={() => setVersionLectura((actual) => actual + 1)}>Reintentar</button>
      </div>
    )
  }

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Despachos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra salidas hacia vendedores y devoluciones de productos o envases.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {perfil?.rol === 'administrador' && (
            <label className={labelCls}>
              Sucursal
              <select
                className={inputCls}
                value={sucursalId}
                onChange={(e) => {
                  setSucursalId(e.target.value)
                  setDespachoExpandido(null)
                }}
              >
                {sucursales.length === 0 && <option value="">Sin sucursales</option>}
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className={btnSecondary}
            onClick={() => navigate('/devoluciones')}
          >
            Devoluciones
          </button>
          <button type="button" className={btnPrimary} onClick={() => setModalOpen(true)}>
            Nuevo despacho
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className={cardCls}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Últimos despachos</h2>
            <span className="text-xs text-slate-400">{despachosFiltrados.length} registros</span>
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
                        ? 'rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white'
                        : 'rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400'
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
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
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
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
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
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Aún no hay despachos para esta sucursal.
            </p>
          ) : despachosFiltrados.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No hay despachos para el día y vendedor seleccionados.
            </p>
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
                      onClick={() => setDespachoExpandido(expandido ? null : d.id)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <AvatarNombre nombre={d.vendedorNombre} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {d.vendedorNombre}
                          </p>
                          <p className="text-xs text-slate-500">{fmtFecha(d.creado_en)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
                          {formatMiles(d.totalUnidades)} unid.
                        </span>
                        {llegada && (
                          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                            Llegada {fmtHora(llegada)}
                          </span>
                        )}
                        <span
                          className={`text-slate-400 transition-transform ${
                            expandido ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        >
                          ▼
                        </span>
                      </div>
                    </button>

                    {expandido && (
                      <div className="space-y-3 border-t border-slate-100 px-4 py-3">
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
                                  <span className="font-medium text-amber-600">−{formatMiles(dv.cantidad)}</span>
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
                                        ? 'font-medium text-emerald-600'
                                        : 'font-medium text-amber-600'
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

        <aside className={cardCls}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Devoluciones</h2>
            <p className="text-sm text-slate-500">Agrupadas por despacho</p>
          </div>

          {gruposDevolucion.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Aún no hay devoluciones para esta sucursal.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {gruposDevolucion.map((g) => (
                <li key={g.despachoId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{g.vendedor}</p>
                    <span className="shrink-0 text-xs text-slate-400">{fmtFecha(g.fecha)}</span>
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
                            l.tipo === 'producto' ? 'text-amber-600' : 'text-emerald-600'
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

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo despacho">
            <label className={labelCls}>
              Vendedor
              <select
                className={inputCls}
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
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
              {lineas.map((linea, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto]"
                >
                  <label className="block">
                    <span className="sr-only">Producto</span>
                    <select
                      className={inputCls}
                      value={linea.producto_id}
                      onChange={(e) => {
                        const next = [...lineas]
                        next[index] = { ...linea, producto_id: e.target.value }
                        setLineas(next)
                      }}
                    >
                      <option value="">Selecciona producto...</option>
                      {productos
                        .filter((p) => p.activo)
                        .map((p) => (
                          <option
                            key={p.id}
                            value={p.id}
                            disabled={lineas.some(
                              (l, i) => i !== index && l.producto_id === p.id,
                            )}
                          >
                            {p.nombre} (disp. {formatMiles(stockDisponible(p.id))})
                          </option>
                        ))}
                    </select>
                    {linea.producto_id && (
                      <span className="mt-1 block text-xs text-slate-500">
                        Disponible en bodega:{' '}
                        <b className="text-slate-700">{formatMiles(stockDisponible(linea.producto_id))}</b>
                        {vendedorId && (
                          <>
                            {' · '}Carga del vendedor:{' '}
                            <b className="text-slate-700">
                              {formatMiles(cargaDelVendedor(linea.producto_id))}
                            </b>
                          </>
                        )}
                      </span>
                    )}
                  </label>
                  <label className="block">
                    <span className="sr-only">Cantidad</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder=""
                      className={inputCls}
                      value={linea.cantidad}
                      onChange={(e) => {
                        const formatted = formatMilesInput(e.target.value)
                        const next = [...lineas]
                        next[index] = { ...linea, cantidad: formatted }
                        setLineas(next)
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => setLineas((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setLineas((prev) => [...prev, { producto_id: '', cantidad: '' }])}
              >
                + Agregar producto
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Bandejas del despacho</p>
              {!bandejaTipo ? (
                <p className="text-sm text-slate-500">No hay tipos de envase configurados.</p>
              ) : (
                <>
                  <label className="block">
                    <span className="sr-only">Bandejas</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder=""
                      className={inputCls}
                      value={bandejasCantidad}
                      onChange={(e) => {
                        const formatted = formatMilesInput(e.target.value)
                        setBandejasManual({ hielo: totalHieloSolicitado, valor: formatted })
                      }}
                    />
                  </label>
                  <p className="text-xs text-slate-500">
                    Se completan solas: 1 bandeja cada {CAPACIDAD_BANDEJA} bolsas de hielo.
                  </p>
                  {totalHieloSolicitado > 0 && parseMiles(bandejasCantidad) !== bandejasSugeridas && (
                    <p className="text-xs text-amber-600">Sugerido: {formatMiles(bandejasSugeridas)}</p>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setModalOpen(false)}
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
