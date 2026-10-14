import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../../context/auth-context'
import SucursalSelector from '../../../components/SucursalSelector'
import EstadoVista from '../../../components/EstadoVista'
import { Toast } from '../../../components/Toast'
import { useToast } from '../../../components/toast-utils'
import { useDatosProduccion } from '../hooks/useDatosProduccion'
import type { SeccionProduccion } from '../hooks/useDatosProduccion'
import { btnPrimary, btnSecondary, cardCls, inputCls, labelCls, errorTextCls } from '../../../lib/ui'
import { fmtFechaHora, formatMiles } from '../../../lib/format'
import { registrarIncidencia, registrarMerma, registrarProduccion } from '../api'
import InputNumerico from '../../../components/InputNumerico'
import { limiteEnvases, mensajeLimiteEnvases } from '../calculos'
import { validarMerma, validarProduccion } from '../validacion'
import HistorialProduccion from '../components/HistorialProduccion'
import IndicadoresProduccion from '../components/IndicadoresProduccion'
import ProduccionReciente from '../components/ProduccionReciente'
import TablaProduccionResponsive from '../components/TablaProduccionResponsive'

const secciones: { id: SeccionProduccion; titulo: string; descripcion: string }[] = [
  { id: 'registrar', titulo: 'Registrar producción', descripcion: 'Registra las unidades producidas y consulta la producción reciente.' },
  { id: 'envases', titulo: 'Envases vacíos', descripcion: 'Consulta los envases retornables disponibles en la sucursal.' },
  { id: 'historial', titulo: 'Historial', descripcion: 'Consulta la producción por producto y fechas. Horas de America/Santiago.' },
  { id: 'indicadores', titulo: 'Indicadores', descripcion: 'Revisa las unidades y registros de producción del período en America/Santiago.' },
  { id: 'incidencias', titulo: 'Incidencias', descripcion: 'Registra incidencias del turno y mermas de productos. Horas de America/Santiago.' },
]
const formCls = `${cardCls} min-w-0 space-y-4 self-start p-5`
const gridCls = 'grid min-w-0 grid-cols-1 gap-6 items-start xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]'
const controlCls = `${inputCls} min-w-0 max-w-full`

export default function Produccion() {
  const { perfil } = useAuth()
  const { pathname } = useLocation()
  const seccion = secciones.find(item => item.id === pathname.split('/').filter(Boolean).at(-1)) ?? secciones[0]
  const [seleccion, setSeleccion] = useState({ perfilId: perfil?.id, sucursalId: perfil?.sucursal_id ?? '' })
  const [ocupado, setOcupado] = useState(false)
  const esAdmin = perfil?.rol === 'administrador'
  const sucursalId = esAdmin
    ? (seleccion.perfilId === perfil.id ? seleccion.sucursalId : perfil.sucursal_id ?? '')
    : perfil?.sucursal_id ?? ''

  return <div className="min-w-0 space-y-6">
    <header className="min-w-0">
      <h1 className="text-2xl font-bold text-slate-900">Producción · {seccion.titulo}</h1>
      <p className="mt-1 text-sm text-slate-500">{seccion.descripcion}</p>
    </header>
    {esAdmin && <SucursalSelector disabled={ocupado} value={sucursalId} onChange={id => setSeleccion({ perfilId: perfil.id, sucursalId: id })} />}
    <nav aria-label="Secciones de producción" className="flex min-w-0 flex-wrap gap-2 lg:hidden">
      {secciones.map(item => <NavLink key={item.id} to={`/produccion/${item.id}`} className={({ isActive }) => `inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{item.titulo}</NavLink>)}
    </nav>
    {sucursalId && perfil ? <ProduccionSucursal key={`${perfil.id}:${sucursalId}`} sucursalId={sucursalId} seccion={seccion.id} setOcupado={setOcupado} />
      : <EstadoVista variante="vacio" mensaje={esAdmin ? 'Selecciona una sucursal para trabajar en producción.' : 'Para trabajar en producción debes tener una sucursal operativa asignada. Contacta al administrador.'} />}
  </div>
}

function ProduccionSucursal({ sucursalId, seccion, setOcupado }: { sucursalId: string; seccion: SeccionProduccion; setOcupado: (valor: boolean) => void }) {
  const { perfil } = useAuth()
  const vigente = useRef(true)
  useEffect(() => {
    vigente.current = true
    return () => { vigente.current = false }
  }, [])
  const { toast, mostrar, cerrar } = useToast()
  const ultimaSeccion = useRef(seccion)
  useEffect(() => {
    if (ultimaSeccion.current !== seccion) {
      ultimaSeccion.current = seccion
      cerrar()
    }
  }, [seccion, cerrar])
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState<number | undefined>()
  const [observaciones, setObservaciones] = useState('')
  const [guardando, actualizarGuardando] = useState(false)
  function setGuardando(valor: boolean) {
    actualizarGuardando(valor)
    setOcupado(valor)
  }
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})
  const campoPendiente = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (campoPendiente.current) document.getElementById(`campo-${campoPendiente.current}`)?.focus()
    campoPendiente.current = null
  }, [errores])
  function invalidar(campo: string, mensaje: string) {
    campoPendiente.current = campo
    setErrores(prev => ({ ...prev, [campo]: mensaje }))
    cerrar()
  }
  function corregir(campo: string) {
    setErrores(prev => ({ ...prev, [campo]: undefined }))
  }
  function accesibilidad(campo: string) {
    return { id: `campo-${campo}`, 'aria-invalid': errores[campo] ? true : undefined, 'aria-describedby': errores[campo] ? `error-${campo}` : undefined }
  }
  function errorCampo(campo: string) {
    return errores[campo] ? <p id={`error-${campo}`} role="alert" className={errorTextCls}>{errores[campo]}</p> : null
  }
  const [descripcionIncidencia, setDescripcionIncidencia] = useState('')
  const [productoMermaId, setProductoMermaId] = useState('')
  const [cantidadMerma, setCantidadMerma] = useState<number | undefined>()
  const [motivoMerma, setMotivoMerma] = useState('')
  const consulta = useDatosProduccion(perfil?.id ?? '', sucursalId, seccion)
  const productos = consulta.productos.data ?? []
  const nombreProducto = (id: string) => productos.find(item => item.id === id)?.nombre ?? 'Nombre no disponible'
  const productoSeleccionado = productos.find(item => item.id === productoId)
  const limite = limiteEnvases(productoSeleccionado?.tipo_empaque_id, consulta.envases.data ?? [])
  const errorEnvases = mensajeLimiteEnvases(cantidad ?? 0, limite)
  const catalogoInvalido = !consulta.productos.isSuccess

  async function guardarProduccion(event: FormEvent) {
    event.preventDefault()
    if (!perfil || !sucursalId) return
    const datos = { sucursal_id: sucursalId, producto_id: productoId, cantidad: cantidad ?? 0, observaciones: observaciones.trim() || null, creado_por: perfil.id }
    const validacion = validarProduccion(datos) ?? errorEnvases ?? null
    if (validacion) return invalidar(!productoId ? 'produccion-producto' : 'produccion-cantidad', validacion)
    setGuardando(true)
    cerrar()
    const mensaje = await registrarProduccion(datos)
    if (!vigente.current) return
    setGuardando(false)
    if (mensaje) return mostrar(mensaje, 'error')
    setCantidad(undefined)
    setObservaciones('')
    mostrar('Producción registrada. Las existencias se actualizaron automáticamente.')
    await consulta.invalidar('producciones')
  }

  async function guardarIncidencia(event: FormEvent) {
    event.preventDefault()
    if (!perfil || !sucursalId) return
    const descripcion = descripcionIncidencia.trim()
    if (!descripcion || descripcion.length > 1000) return invalidar('incidencia-descripcion', 'Describe la incidencia en un máximo de 1000 caracteres.')
    setGuardando(true)
    cerrar()
    const mensaje = await registrarIncidencia({ sucursal_id: sucursalId, produccion_id: null, descripcion, creado_por: perfil.id })
    if (!vigente.current) return
    setGuardando(false)
    if (mensaje) return mostrar(mensaje, 'error')
    setDescripcionIncidencia('')
    mostrar('Incidencia registrada. Las existencias se mantienen.')
    await consulta.invalidar('incidencias_produccion')
  }

  async function guardarMerma(event: FormEvent) {
    event.preventDefault()
    if (!perfil || !sucursalId) return
    const datos = { sucursal_id: sucursalId, producto_id: productoMermaId, tipo_empaque_id: null, despacho_id: null, cantidad: cantidadMerma ?? 0, motivo: motivoMerma.trim(), creado_por: perfil.id }
    const validacion = validarMerma(datos)
    if (validacion) return invalidar(!productoMermaId ? 'merma-producto' : (!Number.isInteger(datos.cantidad) || datos.cantidad <= 0) ? 'merma-cantidad' : 'merma-motivo', validacion)
    setGuardando(true)
    cerrar()
    const mensaje = await registrarMerma(datos)
    if (!vigente.current) return
    setGuardando(false)
    if (mensaje) return mostrar(mensaje, 'error')
    setProductoMermaId('')
    setCantidadMerma(undefined)
    setMotivoMerma('')
    mostrar('Merma registrada correctamente. Las existencias fueron actualizadas.')
    await consulta.invalidar('mermas')
  }

  const opcionesProducto = productos.filter(item => item.activo).map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)
  return <div className="min-w-0 space-y-6">
    <Toast toast={toast} onClose={cerrar} />
    <div className="flex justify-end"><button type="button" className={btnSecondary} onClick={() => void consulta.actualizar()}>Actualizar lista</button></div>
    {seccion !== 'envases' && <EstadoConsulta consulta={consulta.productos} mensaje="No fue posible cargar los datos de producción. Reintenta el catálogo de productos." cargando="Cargando productos..." />}

    {seccion === 'registrar' && <div className={gridCls}>
      <form className={formCls} onSubmit={event => void guardarProduccion(event)}>
        <h2 className="font-semibold text-slate-900">Nueva producción</h2>
        <label className={labelCls}>Producto<select className={controlCls} value={productoId} {...accesibilidad('produccion-producto')} onChange={event => { corregir('produccion-producto'); setProductoId(event.target.value) }}><option value="">Selecciona...</option>{opcionesProducto}</select></label>
        {errorCampo('produccion-producto')}
        <div><label htmlFor="campo-produccion-cantidad" className={labelCls}>Cantidad</label><InputNumerico {...accesibilidad('produccion-cantidad')} className={controlCls} value={cantidad} error={errorEnvases} onChange={valor => { corregir('produccion-cantidad'); setCantidad(valor) }} /></div>
        {errorCampo('produccion-cantidad')}
        <label className={labelCls}>Observaciones (opcional)<textarea className={controlCls} rows={3} maxLength={1000} value={observaciones} onChange={event => setObservaciones(event.target.value)} /></label>
        <button disabled={guardando || catalogoInvalido} className={btnPrimary}>{guardando ? 'Registrando...' : 'Registrar producción'}</button>
      </form>
      {!catalogoInvalido && <EstadoConsulta consulta={consulta.producciones} cargando="Cargando producción reciente...">
        <ProduccionReciente perfilId={perfil?.id ?? ''} sucursalId={sucursalId} productos={productos} recientes={consulta.producciones.data ?? []} />
      </EstadoConsulta>}
    </div>}

    {seccion === 'incidencias' && <div className="min-w-0 space-y-6">
      <div className={gridCls}>
        <form className={formCls} onSubmit={event => void guardarIncidencia(event)}>
          <h2 className="font-semibold text-slate-900">Incidencia descriptiva</h2>
          <p className="text-sm text-slate-500">Registra una observación del turno. Esta incidencia no cambia las existencias; si hubo pérdida, registra una merma en la sección siguiente.</p>
          <label className={labelCls}>Descripción de la incidencia<textarea className={controlCls} rows={4} maxLength={1000} value={descripcionIncidencia} {...accesibilidad('incidencia-descripcion')} onChange={event => { corregir('incidencia-descripcion'); setDescripcionIncidencia(event.target.value) }} /></label>
        {errorCampo('incidencia-descripcion')}
          <button disabled={guardando} className={btnPrimary}>{guardando ? 'Registrando...' : 'Registrar incidencia'}</button>
        </form>
        <section className={`${cardCls} min-w-0`}>
          <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Incidencias recientes</h2>
          <div className="min-w-0 xl:max-h-[28rem] xl:overflow-y-auto"><EstadoConsulta consulta={consulta.incidencias} cargando="Cargando incidencias...">
            {!consulta.incidencias.data?.length ? <EstadoVista variante="vacio" mensaje="No hay incidencias registradas." /> : <ul className="space-y-3 bg-slate-50 p-3 sm:space-y-0 sm:divide-y sm:divide-slate-100 sm:bg-transparent sm:p-0">{consulta.incidencias.data.map(item => <li key={item.id} data-testid="tarjeta-registro" className="min-w-0 space-y-2 rounded-xl border border-slate-300 bg-white p-4 shadow-sm [overflow-wrap:anywhere] sm:space-y-1 sm:rounded-none sm:border-0 sm:px-5 sm:py-4 sm:shadow-none">
              <p className="inline-block rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 sm:bg-transparent sm:p-0 sm:font-normal sm:text-slate-600">{fmtFechaHora(item.creado_en)}</p><p className="whitespace-pre-wrap text-sm text-slate-900">{item.descripcion}</p>
            </li>)}</ul>}
          </EstadoConsulta></div>
        </section>
      </div>
      <div className={gridCls}>
        <form className={formCls} onSubmit={event => void guardarMerma(event)}>
          <div><h2 className="font-semibold text-slate-900">Registrar merma</h2><p className="mt-1 text-sm text-slate-500">Registra productos dañados o perdidos para descontarlos del stock de bodega.</p></div>
          <label className={labelCls}>Producto<select className={controlCls} value={productoMermaId} {...accesibilidad('merma-producto')} onChange={event => { corregir('merma-producto'); setProductoMermaId(event.target.value) }}><option value="">Selecciona...</option>{opcionesProducto}</select></label>
        {errorCampo('merma-producto')}
          <div><label htmlFor="campo-merma-cantidad" className={labelCls}>Cantidad</label><InputNumerico {...accesibilidad('merma-cantidad')} className={controlCls} value={cantidadMerma} onChange={valor => { corregir('merma-cantidad'); setCantidadMerma(valor) }} /></div>
        {errorCampo('merma-cantidad')}
          <label className={labelCls}>Motivo<textarea className={controlCls} rows={4} maxLength={1000} value={motivoMerma} {...accesibilidad('merma-motivo')} onChange={event => { corregir('merma-motivo'); setMotivoMerma(event.target.value) }} placeholder="Ej.: Bidón dañado durante producción" /></label>
        {errorCampo('merma-motivo')}
          <button disabled={guardando || catalogoInvalido} className={btnPrimary}>{guardando ? 'Registrando...' : 'Registrar merma'}</button>
        </form>
        <section className={`${cardCls} min-w-0`}>
          <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Mermas recientes</h2>
          <div className="min-w-0 xl:max-h-[28rem] xl:overflow-y-auto"><EstadoConsulta consulta={consulta.mermas} cargando="Cargando mermas...">
            {!consulta.mermas.data?.length ? <EstadoVista variante="vacio" mensaje="No hay mermas registradas." /> : <TablaProduccionResponsive columnas={[{ titulo: 'Fecha', sinSalto: true, insignia: true }, { titulo: 'Producto', destacada: true }, { titulo: 'Cantidad', numerica: true }, { titulo: 'Motivo' }]} filas={consulta.mermas.data.map(item => ({ id: item.id, celdas: [fmtFechaHora(item.creado_en), item.producto_id ? nombreProducto(item.producto_id) : 'Producto', formatMiles(item.cantidad), item.motivo] }))} />}
          </EstadoConsulta></div>
        </section>
      </div>
    </div>}

    {seccion === 'envases' && <section className={`${cardCls} min-w-0`}>
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Envases vacíos disponibles</h2><p className="mt-1 text-sm text-slate-500">Empaques retornables de la sucursal. Horas de America/Santiago.</p></div>
      <EstadoConsulta consulta={consulta.envases} cargando="Cargando envases...">
        {!consulta.envases.data?.length ? <EstadoVista variante="vacio" mensaje="No hay envases retornables disponibles." /> : <div className="grid min-w-0 grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{consulta.envases.data.map(item => <article className="min-w-0 rounded-xl border border-slate-200 p-5 [overflow-wrap:anywhere]" key={item.tipo_empaque_id}>
          <p className="text-sm font-medium text-slate-600">{item.nombre}</p><p className="mt-2 text-3xl font-bold text-brand-800">{formatMiles(item.cantidad)}</p><p className="mt-2 text-xs text-slate-500">Retornable · actualizado {fmtFechaHora(item.modificado_en)}</p>
        </article>)}</div>}
      </EstadoConsulta>
    </section>}
    {seccion === 'historial' && <HistorialProduccion perfilId={perfil?.id} sucursalId={sucursalId} productos={productos} />}
    {seccion === 'indicadores' && <IndicadoresProduccion perfilId={perfil?.id} sucursalId={sucursalId} productos={productos} />}
  </div>
}

function EstadoConsulta({ consulta, mensaje, cargando, children }: {
  consulta: { isFetching: boolean; isPending: boolean; error: Error | null; refetch: () => unknown }
  mensaje?: string
  cargando: string
  children?: ReactNode
}) {
  if (consulta.isPending) return <EstadoVista variante="cargando" mensaje={cargando} />
  if (consulta.error) return <EstadoVista variante="error" mensaje={mensaje ?? 'No fue posible cargar la información. Inténtalo de nuevo.'} onReintentar={() => void consulta.refetch()} />
  return <div aria-busy={consulta.isFetching}>{consulta.isFetching && <p role="status" className="px-5 py-2 text-sm text-slate-600">Actualizando...</p>}{children}</div>
}
