import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../../context/auth-context'
import { obtenerStockBodega, obtenerStockEnvases } from '../api'
import { obtenerProductos, obtenerSucursales, obtenerTiposEmpaque } from '../../../lib/catalog'
import { btnPrimary, btnSecondary, cardCls, inputCls, labelCls, tdCls, thCls } from '../../../lib/ui'
import type { Producto, Sucursal, TipoEmpaque } from '../../../types'
import type { StockBodega, StockEnvases } from '../types'

type Tab = 'productos' | 'envases'

function Tabs({ activa, onChange }: { activa: Tab; onChange: (tab: Tab) => void }) {
  const opciones: { id: Tab; label: string }[] = [
    { id: 'productos', label: 'Productos' },
    { id: 'envases', label: 'Envases' },
  ]

  return (
    <div className="inline-flex rounded-lg border border-brand-200 bg-brand-50 p-1">
      {opciones.map((opcion) => (
        <button
          key={opcion.id}
          type="button"
          onClick={() => onChange(opcion.id)}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
            activa === opcion.id
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-brand-700 hover:bg-brand-100 hover:text-brand-900'
          }`}
        >
          {opcion.label}
        </button>
      ))}
    </div>
  )
}

function SeccionStock({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className={cardCls}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
      </div>
      {children}
    </section>
  )
}

export default function Stock() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'

  const [tab, setTab] = useState<Tab>('productos')
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalId] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [tiposEmpaque, setTiposEmpaque] = useState<TipoEmpaque[]>([])
  const [stockBodega, setStockBodega] = useState<StockBodega[]>([])
  const [stockEnvases, setStockEnvases] = useState<StockEnvases[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  useEffect(() => {
    async function init() {
      const [sucursalesData, productosData, empaquesData] = await Promise.all([
        obtenerSucursales(),
        obtenerProductos(true),
        obtenerTiposEmpaque(),
      ])
      setSucursales(sucursalesData)
      setProductos(productosData)
      setTiposEmpaque(empaquesData)
      setSucursalId(perfil?.sucursal_id ?? sucursalesData[0]?.id ?? '')
      setCargando(false)
    }
    void init()
  }, [perfil])

  const loadStock = useCallback(async (sid: string) => {
    if (!sid) return
    setRefrescando(true)
    const [sb, se] = await Promise.all([obtenerStockBodega(sid), obtenerStockEnvases(sid)])
    setStockBodega(sb)
    setStockEnvases(se)
    setRefrescando(false)
  }, [])

  useEffect(() => {
    async function cargar() {
      await loadStock(sucursalId)
    }
    void cargar()
  }, [sucursalId, loadStock])

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>

  const sucursalActual = sucursales.find((s) => s.id === sucursalId)

  const filasProductos = stockBodega
    .map((s) => ({
      ...s,
      producto: productos.find((p) => p.id === s.producto_id),
    }))
    .sort((a, b) => (a.producto?.nombre ?? '').localeCompare(b.producto?.nombre ?? ''))

  const filasEnvases = stockEnvases
    .map((s) => ({
      ...s,
      empaque: tiposEmpaque.find((t) => t.id === s.tipo_empaque_id),
    }))
    .sort((a, b) => (a.empaque?.nombre ?? '').localeCompare(b.empaque?.nombre ?? ''))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock</h1>
        <p className="mt-1 text-sm text-slate-500">Consulta existencias por sucursal.</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          {esAdmin ? (
            <label className={labelCls}>
              Sucursal
              <select
                className={inputCls}
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
              >
                <option value="">Selecciona una sucursal...</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div>
              <p className={labelCls}>Sucursal</p>
              <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
                {sucursalActual?.nombre ?? 'Sin sucursal asignada'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={btnPrimary}
            disabled={refrescando}
            onClick={() => void loadStock(sucursalId)}
          >
            {refrescando ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button type="button" className={btnSecondary} disabled>
            Exportar Excel
          </button>
        </div>
      </div>

      <Tabs activa={tab} onChange={setTab} />

      {tab === 'productos' ? (
        <SeccionStock titulo="Productos en bodega">
          {filasProductos.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Sin registros de stock de productos para esta sucursal.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className={thCls}>Producto</th>
                    <th className={thCls}>Tipo</th>
                    <th className={`${thCls} text-right`}>Unidades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filasProductos.map((f) => (
                    <tr key={f.producto_id}>
                      <td className={tdCls}>{f.producto?.nombre ?? 'Desconocido'}</td>
                      <td className={tdCls}>{f.producto?.tipo ?? '-'}</td>
                      <td className={`${tdCls} text-right font-semibold`}>{f.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SeccionStock>
      ) : (
        <SeccionStock titulo="Envases">
          {filasEnvases.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Sin registros de envases para esta sucursal.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className={thCls}>Envase</th>
                    <th className={thCls}>Categoría</th>
                    <th className={`${thCls} text-right`}>Unidades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filasEnvases.map((f) => (
                    <tr key={f.tipo_empaque_id}>
                      <td className={tdCls}>{f.empaque?.nombre ?? 'Desconocido'}</td>
                      <td className={tdCls}>{f.empaque?.categoria ?? '-'}</td>
                      <td className={`${tdCls} text-right font-semibold`}>{f.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SeccionStock>
      )}
    </div>
  )
}
