import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../context/auth-context'
import {
  obtenerCargaVendedores,
  obtenerDespachos,
  obtenerDetallesDespacho,
  obtenerDevolucionesEnvase,
  obtenerDevolucionesProducto,
  obtenerEnvasesDespacho,
  obtenerStockEnvases,
  obtenerVendedores,
  registrarDevolucionEnvases,
  registrarDevolucionProductos,
} from '../api'
import { obtenerProductos, obtenerSucursales, obtenerTiposEmpaque } from '../../../lib/catalog'
import { btnPrimary, cardCls, fmtFecha, inputCls, labelCls, tdCls, thCls } from '../../../lib/ui'
import type { Perfil, Producto, Sucursal, TipoEmpaque } from '../../../types'
import type {
  CargaVendedor,
  Despacho,
  DespachoDetalle,
  DespachoEnvase,
  DevolucionEnvase,
  DevolucionProducto,
  StockEnvases,
} from '../types'

interface DespachoConTotal extends Despacho {
  totalUnidades: number
  vendedorNombre: string
}

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

const inputCompact = `${inputCls} !mt-0 w-20 text-right`

function aaaammdd(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export default function Devoluciones() {
  const { perfil } = useAuth()

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
  const [stockEnvases, setStockEnvases] = useState<StockEnvases[]>([])
  const [cargaVendedor, setCargaVendedor] = useState<CargaVendedor[]>([])
  const [cargando, setCargando] = useState(true)

  const [seleccionado, setSeleccionado] = useState('')
  const [diaFiltro, setDiaFiltro] = useState<'hoy' | 'ayer' | '7d' | 'todo' | 'fecha'>('hoy')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [vendedorFiltro, setVendedorFiltro] = useState('')
  const [productoInputs, setProductoInputs] = useState<Record<string, string>>({})
  const [envaseInputs, setEnvaseInputs] = useState<
    Record<string, { buenos: string; malos: string }>
  >({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tiposEmpaqueDevolvibles = useMemo(
    () => tiposEmpaque.filter((t) => t.categoria !== 'no_retornable'),
    [tiposEmpaque],
  )

  useEffect(() => {
    async function init() {
      const data = await obtenerSucursales()
      setSucursales(data)
      setSucursalId(perfil?.sucursal_id ?? data[0]?.id ?? '')
    }
    void init()
  }, [perfil])

  const load = useCallback(async () => {
    const [vendedoresData, productosData, empaquesData, despachosRaw, envasesStockRaw] =
      await Promise.all([
        obtenerVendedores(sucursalId),
        obtenerProductos(),
        obtenerTiposEmpaque(),
        obtenerDespachos(sucursalId),
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

    setProductos(productosData)
    setTiposEmpaque(empaquesData)
    setVendedores(vendedoresData)
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
    setStockEnvases(envasesStockRaw)
    setCargaVendedor(cargaRaw)
    setCargando(false)
  }, [sucursalId])

  useEffect(() => {
    async function cargar() {
      await load()
    }
    void cargar()
  }, [load])

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

  const estadoDe = (despachoId: string): EstadoDespacho => {
    const hasProductos = desvProducto.some((x) => x.despacho_id === despachoId)
    const hasEnvases = desvEnvase.some((x) => x.despacho_id === despachoId)
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
      .filter((x) => x.despacho_id === despachoId && x.producto_id === productoId)
      .reduce((sum, x) => sum + x.cantidad, 0)

  const devueltoEnvaseBuenoDe = (despachoId: string, tipoEmpaqueId: string) =>
    desvEnvase
      .filter(
        (x) =>
          x.despacho_id === despachoId &&
          x.tipo_empaque_id === tipoEmpaqueId &&
          x.estado === 'bueno',
      )
      .reduce((sum, x) => sum + x.cantidad, 0)

  const devueltoEnvaseMaloDe = (despachoId: string, tipoEmpaqueId: string) =>
    desvEnvase
      .filter(
        (x) =>
          x.despacho_id === despachoId &&
          x.tipo_empaque_id === tipoEmpaqueId &&
          x.estado === 'malo',
      )
      .reduce((sum, x) => sum + x.cantidad, 0)

  function seleccionar(despachoId: string) {
    if (estadoDe(despachoId) === 'completo') return
    setSeleccionado(despachoId)
    setProductoInputs({})
    setEnvaseInputs({})
    setError(null)
  }

  async function registrar() {
    if (!perfil || !seleccionado) return
    setError(null)
    const estado = estadoDe(seleccionado)

    const productosPendientes = estado === 'pendiente' || estado === 'envases'
    const envasesPendientes = estado === 'pendiente' || estado === 'productos'

    const lineasProducto = productosPendientes
      ? Object.entries(productoInputs)
          .filter(([, cantidad]) => Number(cantidad) > 0)
          .map(([producto_id, cantidad]) => ({ producto_id, cantidad: Number(cantidad) }))
      : []

    const lineasEnvase = envasesPendientes
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
      const max = despachados.get(l.producto_id) ?? 0
      if (l.cantidad > max) {
        const p = productos.find((x) => x.id === l.producto_id)
        setError(
          `No puedes devolver más de ${max} ${p?.nombre ?? 'del producto'} (despachado).`,
        )
        return
      }
    }

    setEnviando(true)
    if (lineasProducto.length > 0) {
      const { error: err } = await registrarDevolucionProductos({
        despacho_id: seleccionado,
        creado_por: perfil.id,
        lineas: lineasProducto,
      })
      if (err) {
        setError(err)
        setEnviando(false)
        return
      }
    }
    if (lineasEnvase.length > 0) {
      const { error: err } = await registrarDevolucionEnvases({
        despacho_id: seleccionado,
        creado_por: perfil.id,
        lineas: lineasEnvase,
      })
      if (err) {
        setError(err)
        setEnviando(false)
        return
      }
    }

    setEnviando(false)
    setProductoInputs({})
    setEnvaseInputs({})
    await load()
  }

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>

  const despachoSeleccionado = despachos.find((d) => d.id === seleccionado)
  const estado = seleccionado ? estadoDe(seleccionado) : null
  const productosPendientes = estado === 'pendiente' || estado === 'envases'
  const envasesPendientes = estado === 'pendiente' || estado === 'productos'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Devoluciones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra lo que el vendedor devuelve al finalizar su ruta, por despacho.
          </p>
        </div>

        {perfil?.rol === 'administrador' && (
          <label className={labelCls}>
            Sucursal
            <select
              className={inputCls}
              value={sucursalId}
              onChange={(e) => {
                setSucursalId(e.target.value)
                setSeleccionado('')
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
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className={cardCls}>
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['hoy', 'Hoy'],
                ['ayer', 'Ayer'],
                ['7d', '7 días'],
                ['todo', 'Todo'],
              ] as const
            ).map(([valor, etiqueta]) => (
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
                  setSeleccionado('')
                }}
              >
                {etiqueta}
              </button>
            ))}
            <input
              type="date"
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
              value={fechaSeleccionada}
              onChange={(e) => {
                setFechaSeleccionada(e.target.value)
                setDiaFiltro(e.target.value === '' ? 'hoy' : 'fecha')
                setSeleccionado('')
              }}
            />
          </div>

          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
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
        <aside className={cardCls}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Despachos</h2>
            <p className="text-sm text-slate-500">Selecciona uno para registrar la devolución</p>
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
                const dEstado = estadoDe(d.id)
                const completo = dEstado === 'completo'
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      disabled={completo}
                      onClick={() => seleccionar(d.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        seleccionado === d.id
                          ? 'border-brand-200 bg-brand-50'
                          : completo
                            ? 'cursor-not-allowed border-slate-100 opacity-60'
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
                        {fmtFecha(d.creado_en)} · {d.totalUnidades} unid.
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <section className={cardCls}>
          {!despachoSeleccionado ? (
            <p className="px-5 py-16 text-center text-sm text-slate-500">
              Selecciona un despacho para registrar su devolución.
            </p>
          ) : (
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Devolución de {despachoSeleccionado.vendedorNombre}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {fmtFecha(despachoSeleccionado.creado_en)} ·{' '}
                    {despachoSeleccionado.totalUnidades} unid. despachadas
                  </p>
                </div>
                <span className={estadoBadge[estado!]}>{estadoEtiqueta[estado!]}</span>
              </div>

              <div className="space-y-6 p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Productos del despacho
                    </h3>
                    {!productosPendientes && (
                      <span className="text-xs font-semibold text-emerald-700">Ya devueltos</span>
                    )}
                  </div>
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className={thCls}>Producto</th>
                          <th className={`${thCls} text-right`}>Despachado</th>
                          {estado === 'pendiente' && (
                            <th className={`${thCls} text-right`}>Carga</th>
                          )}
                          <th className={`${thCls} text-right`}>Devuelve</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...productosDespachados(seleccionado).entries()].map(
                          ([productoId, despachado]) => {
                            const producto = productos.find((p) => p.id === productoId)
                            return (
                              <tr key={productoId}>
                                <td className={tdCls}>{producto?.nombre ?? 'Producto'}</td>
                                <td className={`${tdCls} text-right font-semibold`}>
                                  {despachado}
                                </td>
                                {estado === 'pendiente' && (
                                  <td className={`${tdCls} text-right text-slate-500`}>
                                    {cargaDeDespacho(seleccionado, productoId)}
                                  </td>
                                )}
                                <td className={`${tdCls} text-right`}>
                                  {productosPendientes ? (
                                    <input
                                      type="number"
                                      min={0}
                                      max={despachado}
                                      placeholder="0"
                                      className={inputCompact}
                                      value={productoInputs[productoId] ?? ''}
                                      onChange={(e) =>
                                        setProductoInputs((prev) => ({
                                          ...prev,
                                          [productoId]: e.target.value,
                                        }))
                                      }
                                    />
                                  ) : (
                                    <span className="font-medium text-amber-600">
                                      −{devueltoProductoDe(seleccionado, productoId)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                  {productosPendientes && (
                    <p className="mt-1 text-xs text-slate-500">
                      No puedes devolver más de lo despachado por producto.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Envases
                    </h3>
                    {!envasesPendientes && (
                      <span className="text-xs font-semibold text-emerald-700">Ya devueltos</span>
                    )}
                  </div>
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className={thCls}>Envase</th>
                          <th className={`${thCls} text-right`}>Despachadas</th>
                          <th className={`${thCls} text-right`}>En bodega</th>
                          <th className={`${thCls} text-right`}>Buenos</th>
                          <th className={`${thCls} text-right`}>Malos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tiposEmpaqueDevolvibles.map((t) => {
                          const despachadas = envasesDespachados(seleccionado).get(t.id) ?? 0
                          const input = envaseInputs[t.id] ?? { buenos: '', malos: '' }
                          return (
                            <tr key={t.id}>
                              <td className={tdCls}>{t.nombre}</td>
                              <td className={`${tdCls} text-right font-semibold`}>
                                {despachadas}
                              </td>
                              <td className={`${tdCls} text-right text-slate-500`}>
                                {stockEnvaseDe(t.id)}
                              </td>
                              <td className={`${tdCls} text-right`}>
                                {envasesPendientes ? (
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    className={inputCompact}
                                    value={input.buenos}
                                    onChange={(e) =>
                                      setEnvaseInputs((prev) => ({
                                        ...prev,
                                        [t.id]: { ...input, buenos: e.target.value },
                                      }))
                                    }
                                  />
                                ) : (
                                  <span className="font-medium text-emerald-600">
                                    +{devueltoEnvaseBuenoDe(seleccionado, t.id)}
                                  </span>
                                )}
                              </td>
                              <td className={`${tdCls} text-right`}>
                                {envasesPendientes ? (
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    className={inputCompact}
                                    value={input.malos}
                                    onChange={(e) =>
                                      setEnvaseInputs((prev) => ({
                                        ...prev,
                                        [t.id]: { ...input, malos: e.target.value },
                                      }))
                                    }
                                  />
                                ) : (
                                  <span className="font-medium text-amber-600">
                                    +{devueltoEnvaseMaloDe(seleccionado, t.id)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Solo los envases en estado “bueno” vuelven al stock de bodega.
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className={`${btnPrimary} w-full`}
                    disabled={enviando}
                    onClick={() => void registrar()}
                  >
                    {enviando ? 'Registrando...' : 'Registrar devolución'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
