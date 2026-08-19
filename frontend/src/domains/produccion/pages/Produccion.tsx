import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../../context/auth-context'
import { supabase } from '../../../lib/supabase'
import { obtenerProductos, obtenerTiposEmpaque } from '../../../lib/catalog'
import { btnPrimary, btnSecondary, cardCls, inputCls, labelCls, tdCls, thCls } from '../../../lib/ui'
import type { Producto, TipoEmpaque } from '../../../types'
import {
  obtenerEnvasesDisponibles,
  obtenerMermas,
  obtenerProducciones,
  registrarMerma,
  registrarProduccion,
} from '../api'
import type { EnvaseDisponible, MermaProduccion, Produccion as RegistroProduccion } from '../types'
import { validarMerma , validarProduccion } from '../validacion'
import HistorialProduccion from '../components/HistorialProduccion'
import IndicadoresProduccion from '../components/IndicadoresProduccion'

type Seccion = 'registrar' | 'envases' | 'historial' | 'indicadores' | 'incidencias'

export default function Produccion() {
  const { perfil } = useAuth()
  const { pathname } = useLocation()
  const sucursalId = perfil?.sucursal_id ?? ''
  const seccion = pathname.split('/').at(-1) as Seccion
  useEffect(() => {
    setError(null)
    setExito(null)
  }, [seccion])
  const [productos, setProductos] = useState<Producto[]>([])
  const [empaques, setEmpaques] = useState<TipoEmpaque[]>([])
  const [producciones, setProducciones] = useState<RegistroProduccion[]>([])
  const [envases, setEnvases] = useState<EnvaseDisponible[]>([])
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [versionDatos, setVersionDatos] = useState(0)

  const [mermas, setMermas] = useState<MermaProduccion[]>([])
  const [productoMermaId, setProductoMermaId] = useState('')
  const [cantidadMerma, setCantidadMerma] = useState('')
  const [motivoMerma, setMotivoMerma] = useState('')

  const cargarDatos = useCallback(async () => {
    if (!sucursalId) return
    setCargando(true)
    setError(null)
    try {
      const [productosData, empaquesData, produccionesData, mermasData] = await Promise.all([
        obtenerProductos(true),
        obtenerTiposEmpaque(),
        obtenerProducciones(sucursalId),
        obtenerMermas(sucursalId),
      ])
      const envasesData = await obtenerEnvasesDisponibles(sucursalId, empaquesData)
      setProductos(productosData)
      setEmpaques(empaquesData)
      setProducciones(produccionesData)
      setMermas(mermasData)
      setEnvases(envasesData)
      setVersionDatos((version) => version + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar producción.')
    } finally {
      setCargando(false)
    }
  }, [sucursalId])

  useEffect(() => {
    const timer = window.setTimeout(() => void cargarDatos(), 0)
    return () => window.clearTimeout(timer)
  }, [cargarDatos])

  useEffect(() => {
    if (!sucursalId) return
    const actualizar = () => void cargarDatos()
    const canal = supabase
      .channel(`produccion-${sucursalId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producciones', filter: `sucursal_id=eq.${sucursalId}` }, actualizar)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mermas',
          filter: `sucursal_id=eq.${sucursalId}`,
        },
        actualizar,
      )      
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_envases', filter: `sucursal_id=eq.${sucursalId}` }, actualizar)
      .subscribe()
    return () => { void supabase.removeChannel(canal) }
  }, [cargarDatos, sucursalId])

  async function guardarProduccion(event: FormEvent) {
    event.preventDefault()
    if (!perfil?.sucursal_id) return
    const datos = {
      sucursal_id: perfil.sucursal_id,
      producto_id: productoId,
      cantidad: Number(cantidad),
      observaciones: observaciones.trim() || null,
      creado_por: perfil.id,
    }
    const validacion = validarProduccion(datos)
    if (validacion) return setError(validacion)
    setGuardando(true)
    setError(null)
    setExito(null)
    const mensaje = await registrarProduccion(datos)
    setGuardando(false)
    if (mensaje) return setError(mensaje)
    setCantidad('')
    setObservaciones('')
    setExito('Producción registrada. Las existencias se actualizaron automáticamente.')
    await cargarDatos()
  }

  async function guardarMerma(event: FormEvent) {
    event.preventDefault()

    if (!perfil?.sucursal_id) return

    const datos = {
      sucursal_id: perfil.sucursal_id,
      producto_id: productoMermaId,
      tipo_empaque_id: null,
      despacho_id: null,
      cantidad: Number(cantidadMerma),
      motivo: motivoMerma.trim(),
      creado_por: perfil.id,
    }

    const validacion = validarMerma(datos)

    if (validacion) {
      setError(validacion)
      return
    }

    setGuardando(true)
    setError(null)
    setExito(null)

    const mensaje = await registrarMerma(datos)

    setGuardando(false)

    if (mensaje) {
      setError(mensaje)
      return
    }

    setProductoMermaId('')
    setCantidadMerma('')
    setMotivoMerma('')

    setExito(
      'Merma registrada correctamente. Las existencias fueron actualizadas.',
    )

    await cargarDatos()
  }

  const nombreProducto = (id: string) => productos.find((item) => item.id === id)?.nombre ?? 'Producto'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Producción</h1>
          <p className="mt-1 text-sm text-slate-500">Registra producción, incidencias y consulta envases disponibles.</p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => void cargarDatos()}>Actualizar</button>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {exito && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{exito}</p>}
      {cargando ? <p className="text-sm text-slate-500">Cargando información...</p> : null}

      {!cargando && seccion === 'registrar' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(18rem,24rem)_1fr]">
          <form className={`${cardCls} space-y-4 p-5`} onSubmit={(event) => void guardarProduccion(event)}>
            <h2 className="font-semibold text-slate-900">Nueva producción</h2>
            <label className={labelCls}>Producto
              <select className={inputCls} value={productoId} onChange={(event) => setProductoId(event.target.value)}>
                <option value="">
                  Selecciona...
                  </option>
                    {productos
                      .filter((item) => item.activo)
                      .map((item) => ( 
                  <option key={item.id} value={item.id}>{item.nombre}
                </option>
              ))}
              </select>
            </label>
            <label className={labelCls}>Cantidad<input className={inputCls} type="number" min="1" step="1" value={cantidad} onChange={(event) => setCantidad(event.target.value)} /></label>
            <label className={labelCls}>Observaciones (opcional)<textarea className={inputCls} rows={3} maxLength={1000} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} /></label>
            <button disabled={guardando} className={btnPrimary}>{guardando ? 'Registrando...' : 'Registrar producción'}</button>
          </form>
          <TablaProducciones registros={producciones} nombreProducto={nombreProducto} />
        </div>
      )}

      {!cargando && seccion === 'incidencias' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(18rem,24rem)_1fr]">
          <form
            className={`${cardCls} space-y-4 p-5`}
            onSubmit={(event) => void guardarMerma(event)}
          >
            <div>
              <h2 className="font-semibold text-slate-900">
                Registrar merma
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Registra productos dañados o perdidos para descontarlos del
                stock de bodega.
              </p>
            </div>

            <label className={labelCls}>
              Producto

              <select
                className={inputCls}
                value={productoMermaId}
                onChange={(event) => setProductoMermaId(event.target.value)}
              >
                <option value="">Selecciona...</option>

                {productos
                  .filter((item) => item.activo)
                  .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelCls}>
              Cantidad

              <input
                className={inputCls}
                type="number"
                min="1"
                step="1"
                value={cantidadMerma}
                onChange={(event) => setCantidadMerma(event.target.value)}
              />
            </label>

            <label className={labelCls}>
              Motivo

              <textarea
                className={inputCls}
                rows={4}
                maxLength={1000}
                value={motivoMerma}
                onChange={(event) => setMotivoMerma(event.target.value)}
                placeholder="Ej.: Bidón dañado durante producción"
              />
            </label>

            <button
              disabled={guardando}
              className={btnPrimary}
            >
              {guardando ? 'Registrando...' : 'Registrar merma'}
            </button>
          </form>

          <section className={cardCls}>
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">
                Mermas recientes
              </h2>
            </div>

            {mermas.length === 0 ? (
              <EstadoVacio texto="No hay mermas registradas." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className={thCls}>Fecha</th>
                      <th className={thCls}>Producto</th>
                      <th className={`${thCls} text-right`}>
                        Cantidad
                      </th>
                      <th className={thCls}>Motivo</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {mermas.map((item) => (
                      <tr key={item.id}>
                        <td className={tdCls}>
                          {new Date(item.creado_en).toLocaleString('es-CL')}
                        </td>

                        <td className={tdCls}>
                          {item.producto_id
                            ? nombreProducto(item.producto_id)
                            : 'Producto'}
                        </td>

                        <td className={`${tdCls} text-right font-semibold`}>
                          {item.cantidad}
                        </td>

                        <td className={tdCls}>
                          {item.motivo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {!cargando && seccion === 'envases' && <TablaEnvases envases={envases} empaques={empaques} />}
      {!cargando && seccion === 'historial' && <HistorialProduccion sucursalId={sucursalId} productos={productos} versionDatos={versionDatos} />}
      {!cargando && seccion === 'indicadores' && <IndicadoresProduccion sucursalId={sucursalId} productos={productos} versionDatos={versionDatos} />}
    </div>
  )
}

function EstadoVacio({ texto }: { texto: string }) {
  return <p className="px-5 py-10 text-center text-sm text-slate-500">{texto}</p>
}

function TablaProducciones({ registros, nombreProducto }: { registros: RegistroProduccion[]; nombreProducto: (id: string) => string }) {
  return <section className={cardCls}><h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Producción reciente</h2>{registros.length === 0 ? <EstadoVacio texto="No hay producciones registradas." /> : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50"><th className={thCls}>Fecha</th><th className={thCls}>Producto</th><th className={`${thCls} text-right`}>Cantidad</th></tr></thead><tbody className="divide-y divide-slate-100">{registros.map((item) => <tr key={item.id}><td className={tdCls}>{new Date(item.creado_en).toLocaleString('es-CL')}</td><td className={tdCls}>{nombreProducto(item.producto_id)}</td><td className={`${tdCls} text-right font-semibold`}>{item.cantidad}</td></tr>)}</tbody></table></div>}</section>
}

function TablaEnvases({ envases, empaques }: { envases: EnvaseDisponible[]; empaques: TipoEmpaque[] }) {
  return <section className={cardCls}><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Envases vacíos disponibles</h2><p className="mt-1 text-sm text-slate-500">Solo se muestran empaques retornables de tu sucursal.</p></div>{envases.length === 0 ? <EstadoVacio texto="No hay envases retornables disponibles." /> : <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{envases.map((item) => <article className="rounded-xl border border-slate-200 p-5" key={item.tipo_empaque_id}><p className="text-sm font-medium text-slate-600">{item.nombre}</p><p className="mt-2 text-3xl font-bold text-brand-800">{item.cantidad}</p><p className="mt-2 text-xs text-slate-500">{empaques.find((empaque) => empaque.id === item.tipo_empaque_id)?.categoria} · actualizado {new Date(item.modificado_en).toLocaleString('es-CL')}</p></article>)}</div>}</section>
}
