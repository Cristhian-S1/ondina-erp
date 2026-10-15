import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../context/auth-context'
import { obtenerStockBodega, obtenerStockEnvases } from '../api'
import { obtenerProductos, obtenerSucursales, obtenerTiposEmpaque } from '../../../lib/catalog'
import { btnSecondary, cardCls, inputCls, labelCls, thCls } from '../../../lib/ui'
import EstadoVista from '../../../components/EstadoVista'
import { formatMiles } from '../../../lib/format'
import type { Producto, Sucursal, TipoEmpaque } from '../../../types'

type Tab = 'productos' | 'envases'

function Tabs({ activa, onChange }: { activa: Tab; onChange: (tab: Tab) => void }) {
  const opciones: { id: Tab; label: string }[] = [
    { id: 'productos', label: 'Productos' },
    { id: 'envases', label: 'Envases' },
  ]

  return (
    <div className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-lg border border-brand-200 bg-brand-50 p-1 sm:inline-grid sm:w-auto sm:max-w-none">
      {opciones.map((opcion) => (
        <button
          key={opcion.id}
          type="button"
          onClick={() => onChange(opcion.id)}
          className={`min-h-11 rounded-md px-4 py-1.5 text-sm font-semibold transition ${
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

// Etiqueta legible para valores de catálogo como `uso_interno` o `no_retornable`.
function etiquetaCatalogo(valor?: string | null) {
  if (!valor) return '-'
  const texto = valor.replaceAll('_', ' ')
  return texto.charAt(0).toLocaleUpperCase('es-CL') + texto.slice(1)
}

// Teléfono: cada fila es una tarjeta compacta (nombre + tipo a la izquierda, unidades a la derecha).
// Desde 640 px vuelve la tabla. Mismo árbol DOM, sólo CSS.
const tablaCls = 'block w-full sm:table'
const theadCls = 'sr-only sm:not-sr-only sm:table-header-group'
const tbodyCls = 'block space-y-2 p-3 sm:table-row-group sm:space-y-0 sm:divide-y sm:divide-slate-100 sm:p-0'
const filaCls = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:table-row sm:rounded-none sm:border-0 sm:px-0 sm:py-0'
const celdaNombreCls = 'col-start-1 row-start-1 block min-w-0 break-words text-base font-semibold text-slate-900 sm:table-cell sm:px-4 sm:py-3 sm:text-sm sm:font-normal'
const celdaTipoCls = 'col-start-1 row-start-2 block text-xs text-slate-600 sm:table-cell sm:px-4 sm:py-3 sm:text-sm sm:text-slate-900'
const celdaUnidadesCls = 'col-start-2 row-span-2 row-start-1 block text-right text-xl font-bold text-slate-900 sm:table-cell sm:px-4 sm:py-3 sm:text-sm sm:font-semibold'

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
  const [cargando, setCargando] = useState(true)

  const [version, updateVersion] = useState(0)
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null)
  const stockQuery = useQuery({
    queryKey: ['stock', perfil?.id, sucursalId],
    queryFn: async () => {
      const [stockBodega, stockEnvases] = await Promise.all([
        obtenerStockBodega(sucursalId), obtenerStockEnvases(sucursalId),
      ])
      return { stockBodega, stockEnvases }
    },
    enabled: !!perfil && !!sucursalId,
    // FE-07: refresh on return after stock movements made in other screens or sessions.
    staleTime: 30_000,
    refetchOnWindowFocus: 'always',
  })
  const stockBodega = stockQuery.data?.stockBodega ?? []
  const stockEnvases = stockQuery.data?.stockEnvases ?? []
  const refrescando = stockQuery.isFetching
  const errorStock = stockQuery.isError ? 'No fue posible cargar el stock. Inténtalo de nuevo con Actualizar.' : null
  const setVersion: typeof updateVersion = (next) => {
    updateVersion(next)
    if (perfil && sucursalId) void stockQuery.refetch()
  }

  useEffect(() => {
    let vigente = true
    async function init() {
      const [sucursalesData, productosData, empaquesData] = await Promise.all([
        obtenerSucursales(),
        obtenerProductos(true),
        obtenerTiposEmpaque(true),
      ])
      if (!vigente) return
      setErrorCatalogo(null)
      setSucursales(sucursalesData)
      setProductos(productosData)
      setTiposEmpaque(empaquesData)
      setSucursalId((actual) => actual || perfil?.sucursal_id || sucursalesData[0]?.id || '')
      setCargando(false)
    }
    void init().catch(() => {
      if (vigente) {
        setErrorCatalogo('No fue posible cargar los catálogos. Inténtalo de nuevo con Actualizar.')
        setCargando(false)
      }
    })
    return () => { vigente = false }
  }, [perfil, version])

  if (cargando) return <EstadoVista variante="cargando" />

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
            className={btnSecondary}
            disabled={refrescando}
            onClick={() => setVersion((actual) => actual + 1)}
          >
            {refrescando ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      <Tabs activa={tab} onChange={setTab} />

      {errorCatalogo || errorStock ? (
        <EstadoVista variante="error" mensaje={errorCatalogo ?? errorStock ?? undefined} onReintentar={() => setVersion((actual) => actual + 1)} />
      ) : refrescando ? (
        <EstadoVista variante="cargando" mensaje="Actualizando stock..." />
      ) : tab === 'productos' ? (
        <SeccionStock titulo="Productos en bodega">
          {filasProductos.length === 0 ? (
            <div role="status"><EstadoVista variante="vacio" mensaje="Sin registros de stock de productos para esta sucursal." /></div>
          ) : (
            <div className="sm:overflow-x-auto">
              <table role="table" className={tablaCls}>
                <thead role="rowgroup" className={theadCls}>
                  <tr role="row" className="border-b border-slate-100 bg-slate-50">
                    <th role="columnheader" scope="col" className={thCls}>Producto</th>
                    <th role="columnheader" scope="col" className={thCls}>Tipo</th>
                    <th role="columnheader" scope="col" className={`${thCls} text-right`}>Unidades</th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className={tbodyCls}>
                  {filasProductos.map((f) => (
                    <tr role="row" key={f.producto_id} className={filaCls}>
                      <td role="cell" className={celdaNombreCls}>{f.producto?.nombre ?? 'Producto no disponible'}</td>
                      <td role="cell" className={celdaTipoCls}>{etiquetaCatalogo(f.producto?.tipo)}</td>
                      <td role="cell" className={celdaUnidadesCls}>{formatMiles(f.cantidad)}</td>
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
            <div role="status"><EstadoVista variante="vacio" mensaje="Sin registros de envases para esta sucursal." /></div>
          ) : (
            <div className="sm:overflow-x-auto">
              <table role="table" className={tablaCls}>
                <thead role="rowgroup" className={theadCls}>
                  <tr role="row" className="border-b border-slate-100 bg-slate-50">
                    <th role="columnheader" scope="col" className={thCls}>Envase</th>
                    <th role="columnheader" scope="col" className={thCls}>Categoría</th>
                    <th role="columnheader" scope="col" className={`${thCls} text-right`}>Unidades</th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className={tbodyCls}>
                  {filasEnvases.map((f) => (
                    <tr role="row" key={f.tipo_empaque_id} className={filaCls}>
                      <td role="cell" className={celdaNombreCls}>{f.empaque?.nombre ?? 'Envase no disponible'}</td>
                      <td role="cell" className={celdaTipoCls}>{etiquetaCatalogo(f.empaque?.categoria)}</td>
                      <td role="cell" className={celdaUnidadesCls}>{formatMiles(f.cantidad)}</td>
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
