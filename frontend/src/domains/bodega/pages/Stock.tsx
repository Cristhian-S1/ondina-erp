import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../context/auth-context'
import { obtenerStockBodega, obtenerStockEnvases } from '../api'
import { obtenerProductos, obtenerSucursales, obtenerTiposEmpaque } from '../../../lib/catalog'
import { btnSecondary, cardCls, inputCls, labelCls, tdCls, thCls } from '../../../lib/ui'
import type { Producto, Sucursal, TipoEmpaque } from '../../../types'
import type { StockBodega, StockEnvases } from '../types'

export default function Stock() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'

  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalId] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [tiposEmpaque, setTiposEmpaque] = useState<TipoEmpaque[]>([])
  const [stockBodega, setStockBodega] = useState<StockBodega[]>([])
  const [stockEnvases, setStockEnvases] = useState<StockEnvases[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function init() {
      const [sucursalesData, productosData, empaquesData] = await Promise.all([
        obtenerSucursales(),
        obtenerProductos(),
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
    const [sb, se] = await Promise.all([obtenerStockBodega(sid), obtenerStockEnvases(sid)])
    setStockBodega(sb)
    setStockEnvases(se)
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock</h1>
          <p className="mt-1 text-sm text-slate-500">
            {esAdmin
              ? 'Consulta existencias por sucursal.'
              : `Existencias de tu sucursal: ${sucursalActual?.nombre ?? ''}`}
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => void loadStock(sucursalId)}>
          Actualizar
        </button>
      </div>

      {esAdmin && (
        <label className={`${labelCls} max-w-sm`}>
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
      )}

      {!esAdmin && (
        <div className={cardCls}>
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{sucursalActual?.nombre}</h2>
          </div>
        </div>
      )}

      <section className={cardCls}>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Productos en bodega</h2>
        </div>
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
      </section>

      <section className={cardCls}>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Envases</h2>
        </div>
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
      </section>
    </div>
  )
}
