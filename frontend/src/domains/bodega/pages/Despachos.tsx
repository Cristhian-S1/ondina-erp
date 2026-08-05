import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../context/auth-context'
import {
  crearDespacho,
  obtenerDespachos,
  obtenerDetallesDespacho,
  obtenerDevolucionesEnvase,
  obtenerDevolucionesProducto,
  obtenerVendedores,
  registrarDevolucionEnvases,
  registrarDevolucionProductos,
} from '../api'
import { obtenerProductos, obtenerSucursales, obtenerTiposEmpaque } from '../../../lib/catalog'
import { btnPrimary, btnSecondary, cardCls, fmtFecha, inputCls, labelCls } from '../../../lib/ui'
import type { Perfil, Producto, Sucursal, TipoEmpaque } from '../../../types'
import type {
  DevolucionEnvase,
  DevolucionProducto,
  Despacho,
} from '../types'

interface DespachoConTotal extends Despacho {
  totalUnidades: number
  vendedorNombre: string
}

interface LineaProducto {
  producto_id: string
  cantidad: string
}

interface LineaEnvase {
  tipo_empaque_id: string
  cantidad: string
  estado: 'bueno' | 'malo'
}

interface Registro {
  id: string
  tipo: 'despacho' | 'devolucion_producto' | 'devolucion_envase'
  descripcion: string
  fecha: string
}

export default function Despachos() {
  const { perfil } = useAuth()

  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalId] = useState('')
  const [vendedores, setVendedores] = useState<Perfil[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [tiposEmpaque, setTiposEmpaque] = useState<TipoEmpaque[]>([])
  const [despachos, setDespachos] = useState<DespachoConTotal[]>([])
  const [desvProducto, setDesvProducto] = useState<DevolucionProducto[]>([])
  const [desvEnvase, setDesvEnvase] = useState<DevolucionEnvase[]>([])
  const [cargando, setCargando] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [vendedorId, setVendedorId] = useState('')
  const [lineas, setLineas] = useState<LineaProducto[]>([{ producto_id: '', cantidad: '' }])
  const [enviando, setEnviando] = useState(false)

  const [devOpen, setDevOpen] = useState(false)
  const [devTab, setDevTab] = useState<'productos' | 'envases'>('productos')
  const [devDespachoId, setDevDespachoId] = useState('')
  const [devLineasProducto, setDevLineasProducto] = useState<LineaProducto[]>([
    { producto_id: '', cantidad: '' },
  ])
  const [devLineasEnvase, setDevLineasEnvase] = useState<LineaEnvase[]>([
    { tipo_empaque_id: '', cantidad: '', estado: 'bueno' },
  ])
  const [devEnviando, setDevEnviando] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const data = await obtenerSucursales()
      setSucursales(data)
      setSucursalId(perfil?.sucursal_id ?? data[0]?.id ?? '')
    }
    void init()
  }, [perfil])

  const load = useCallback(async () => {
    const [vendedoresData, productosData, empaquesData, despachosRaw] = await Promise.all([
      obtenerVendedores(sucursalId),
      obtenerProductos(),
      obtenerTiposEmpaque(),
      obtenerDespachos(sucursalId),
    ])

    const ids = despachosRaw.map((d) => d.id)
    const [detalles, dProd, dEnv] = await Promise.all([
      obtenerDetallesDespacho(ids),
      obtenerDevolucionesProducto(ids),
      obtenerDevolucionesEnvase(ids),
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
    setDesvProducto(dProd)
    setDesvEnvase(dEnv)
    setCargando(false)
  }, [sucursalId])

  useEffect(() => {
    async function cargar() {
      await load()
    }
    void cargar()
  }, [load])

  const registros = useMemo<Registro[]>(() => {
    const rows: Registro[] = []
    for (const d of despachos) {
      rows.push({
        id: `d-${d.id}`,
        tipo: 'despacho',
        descripcion: `Despacho a ${d.vendedorNombre} · ${d.totalUnidades} unidades`,
        fecha: d.creado_en,
      })
    }
    for (const dv of desvProducto) {
      const d = despachos.find((x) => x.id === dv.despacho_id)
      const p = productos.find((x) => x.id === dv.producto_id)
      rows.push({
        id: `dp-${dv.id}`,
        tipo: 'devolucion_producto',
        descripcion: `${dv.cantidad} × ${p?.nombre ?? 'Producto'} · despacho a ${d?.vendedorNombre ?? '?'}`,
        fecha: dv.creado_en,
      })
    }
    for (const de of desvEnvase) {
      const d = despachos.find((x) => x.id === de.despacho_id)
      const t = tiposEmpaque.find((x) => x.id === de.tipo_empaque_id)
      rows.push({
        id: `de-${de.id}`,
        tipo: 'devolucion_envase',
        descripcion: `${de.cantidad} × ${t?.nombre ?? 'Envase'} (${de.estado}) · despacho a ${d?.vendedorNombre ?? '?'}`,
        fecha: de.creado_en,
      })
    }
    return rows.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 15)
  }, [despachos, desvProducto, desvEnvase, productos, tiposEmpaque])

  async function registrarDespacho() {
    if (!perfil) return
    setError(null)

    if (!sucursalId) {
      setError('Selecciona una sucursal para registrar el despacho.')
      return
    }

    const lineasValidas = lineas.filter((l) => l.producto_id && Number(l.cantidad) > 0)
    if (!vendedorId || lineasValidas.length === 0) {
      setError('Selecciona un vendedor y agrega al menos un producto.')
      return
    }

    setEnviando(true)
    const { error: err } = await crearDespacho({
      sucursal_id: sucursalId,
      vendedor_id: vendedorId,
      despachador_id: perfil.id,
      creado_por: perfil.id,
      lineas: lineasValidas.map((l) => ({
        producto_id: l.producto_id,
        cantidad: Number(l.cantidad),
      })),
    })

    if (err) {
      setError(err)
      setEnviando(false)
      return
    }

    setEnviando(false)
    setModalOpen(false)
    setVendedorId('')
    setLineas([{ producto_id: '', cantidad: '' }])
    await load()
  }

  async function registrarDevolucion() {
    if (!perfil) return
    setError(null)

    if (!devDespachoId) {
      setError('Selecciona el despacho de la devolución.')
      return
    }

    const lineasProductoValidas = devLineasProducto.filter(
      (l) => l.producto_id && Number(l.cantidad) > 0,
    )
    const lineasEnvaseValidas = devLineasEnvase.filter(
      (l) => l.tipo_empaque_id && Number(l.cantidad) > 0,
    )

    if (devTab === 'productos' && lineasProductoValidas.length === 0) {
      setError('Agrega al menos un producto a devolver.')
      return
    }
    if (devTab === 'envases' && lineasEnvaseValidas.length === 0) {
      setError('Agrega al menos un envase a devolver.')
      return
    }

    setDevEnviando(true)

    if (devTab === 'productos') {
      const { error: err } = await registrarDevolucionProductos({
        despacho_id: devDespachoId,
        creado_por: perfil.id,
        lineas: lineasProductoValidas.map((l) => ({
          producto_id: l.producto_id,
          cantidad: Number(l.cantidad),
        })),
      })
      if (err) {
        setError(err)
        setDevEnviando(false)
        return
      }
      setDevLineasProducto([{ producto_id: '', cantidad: '' }])
    } else {
      const { error: err } = await registrarDevolucionEnvases({
        despacho_id: devDespachoId,
        creado_por: perfil.id,
        lineas: lineasEnvaseValidas.map((l) => ({
          tipo_empaque_id: l.tipo_empaque_id,
          cantidad: Number(l.cantidad),
          estado: l.estado,
        })),
      })
      if (err) {
        setError(err)
        setDevEnviando(false)
        return
      }
      setDevLineasEnvase([{ tipo_empaque_id: '', cantidad: '', estado: 'bueno' }])
    }

    setDevEnviando(false)
    await load()
  }

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Despachos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra salidas hacia vendedores y devoluciones de productos o envases.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {perfil?.rol === 'administrador' && (
            <label className={labelCls}>
              Sucursal
              <select
                className={inputCls}
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
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
          <button type="button" className={btnPrimary} onClick={() => setModalOpen(true)}>
            Nuevo despacho
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <section className={cardCls}>
        <button
          type="button"
          onClick={() => setDevOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">Registrar devolución</h2>
            <p className="text-sm text-slate-500">Devolución de productos o envases de un despacho</p>
          </div>
          <span
            className={`text-slate-400 transition-transform ${devOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>

        {devOpen && (
          <div className="space-y-4 border-t border-slate-100 px-5 py-4">
            <label className={labelCls}>
              Despacho
              <select
                className={inputCls}
                value={devDespachoId}
                onChange={(e) => setDevDespachoId(e.target.value)}
              >
                <option value="">Selecciona un despacho...</option>
                {despachos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.vendedorNombre} · {fmtFecha(d.creado_en)} · {d.totalUnidades} unid.
                  </option>
                ))}
              </select>
            </label>

            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDevTab('productos')}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  devTab === 'productos'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Productos
              </button>
              <button
                type="button"
                onClick={() => setDevTab('envases')}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  devTab === 'envases'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Envases
              </button>
            </div>

            {devTab === 'productos' && (
              <div className="space-y-3">
                {devLineasProducto.map((linea, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto]"
                  >
                    <label className={labelCls}>
                      Producto
                      <select
                        className={inputCls}
                        value={linea.producto_id}
                        onChange={(e) => {
                          const next = [...devLineasProducto]
                          next[index] = { ...linea, producto_id: e.target.value }
                          setDevLineasProducto(next)
                        }}
                      >
                        <option value="">Selecciona...</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="sr-only">Cantidad</span>
                      <input
                        type="number"
                        min={1}
                        placeholder="Cant."
                        className={inputCls}
                        value={linea.cantidad}
                        onChange={(e) => {
                          const next = [...devLineasProducto]
                          next[index] = { ...linea, cantidad: e.target.value }
                          setDevLineasProducto(next)
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() =>
                        setDevLineasProducto((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() =>
                    setDevLineasProducto((prev) => [
                      ...prev,
                      { producto_id: '', cantidad: '' },
                    ])
                  }
                >
                  + Agregar producto
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={devEnviando}
                  onClick={() => void registrarDevolucion()}
                >
                  {devEnviando ? 'Registrando...' : 'Registrar devolución de productos'}
                </button>
              </div>
            )}

            {devTab === 'envases' && (
              <div className="space-y-3">
                {devLineasEnvase.map((linea, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto]"
                  >
                    <label className={labelCls}>
                      Envase
                      <select
                        className={inputCls}
                        value={linea.tipo_empaque_id}
                        onChange={(e) => {
                          const next = [...devLineasEnvase]
                          next[index] = { ...linea, tipo_empaque_id: e.target.value }
                          setDevLineasEnvase(next)
                        }}
                      >
                        <option value="">Selecciona...</option>
                        {tiposEmpaque.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre} ({t.categoria})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="sr-only">Cantidad</span>
                      <input
                        type="number"
                        min={1}
                        placeholder="Cant."
                        className={inputCls}
                        value={linea.cantidad}
                        onChange={(e) => {
                          const next = [...devLineasEnvase]
                          next[index] = { ...linea, cantidad: e.target.value }
                          setDevLineasEnvase(next)
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="sr-only">Estado</span>
                      <select
                        className={inputCls}
                        value={linea.estado}
                        onChange={(e) => {
                          const next = [...devLineasEnvase]
                          next[index] = {
                            ...linea,
                            estado: e.target.value as 'bueno' | 'malo',
                          }
                          setDevLineasEnvase(next)
                        }}
                      >
                        <option value="bueno">Bueno</option>
                        <option value="malo">Malo</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() =>
                        setDevLineasEnvase((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() =>
                    setDevLineasEnvase((prev) => [
                      ...prev,
                      { tipo_empaque_id: '', cantidad: '', estado: 'bueno' },
                    ])
                  }
                >
                  + Agregar envase
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={devEnviando}
                  onClick={() => void registrarDevolucion()}
                >
                  {devEnviando ? 'Registrando...' : 'Registrar devolución de envases'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={cardCls}>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Últimos registros</h2>
        </div>
        {registros.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Aún no hay despachos ni devoluciones para esta sucursal.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {registros.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      r.tipo === 'despacho'
                        ? 'bg-brand-600'
                        : r.tipo === 'devolucion_producto'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                  />
                  <p className="truncate text-sm text-slate-900">{r.descripcion}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{fmtFecha(r.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Nuevo despacho</h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

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
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="sr-only">Cantidad</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="Cant."
                      className={inputCls}
                      value={linea.cantidad}
                      onChange={(e) => {
                        const next = [...lineas]
                        next[index] = { ...linea, cantidad: e.target.value }
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
          </div>
        </div>
      )}
    </div>
  )
}
