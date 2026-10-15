import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { mensajeErrorSupabase } from '../../../lib/errors'
import { useAuth } from '../../../context/auth-context'
import { useClientesRuta } from '../hooks/useClientesRuta'
import { useProductosVenta } from '../hooks/useProductosVenta'
import { useCargaVendedor } from '../hooks/useCargaVendedor'
import { useRegistrarVenta } from '../hooks/useRegistrarVenta'
import { registrarVentaSchema, type RegistrarVentaForm, type RegistrarVentaFormInput } from '../schemas'
import type { DetalleVentaDraft, ProductoVenta } from '../types'
import { Toast } from '../../../components/Toast'
import { useToast } from '../../../components/toast-utils'
import Dialog from '../../../components/Dialog'
import EstadoVista from '../../../components/EstadoVista'
import InputNumerico from '../../../components/InputNumerico'
import { btnSecondary, cardCls, errorTextCls, thCls } from '../../../lib/ui'
import { PlusCircleIcon } from '../../../components/icons'
import CampoFormulario from '../components/CampoFormulario'
import FilaProductoVenta from '../components/FilaProductoVenta'
import PersistenciaBorradorVenta from '../components/PersistenciaBorradorVenta'
import ResumenFormularioVenta from '../components/ResumenFormularioVenta'
import ResumenVentaConfirmada from '../components/ResumenVentaConfirmada'

const METODOS: { value: 'efectivo' | 'transferencia'; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
]

const STORAGE_PREFIX = 'ondina:draft-registrar-venta:'

const PRODUCTOS_DEFAULT = ['Bidón POL', 'Bidón PET', 'Hielo CUBO']

const DETALLES_VACIOS: DetalleVentaDraft[] = PRODUCTOS_DEFAULT.map(() => ({
  productoId: '',
  cantidad: 0,
  precioUnitario: 0,
}))

const draftSchema = registrarVentaSchema.extend({
  clienteId: z.string(),
  descuento: z.number().min(0),
  detalles: z.array(z.object({
    productoId: z.string(),
    cantidad: z.number().int().min(0),
    precioUnitario: z.number().min(0),
  })).min(1),
})

function cargarDraft(key: string): RegistrarVentaForm | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const result = draftSchema.safeParse(JSON.parse(raw))
    if (result.success) return result.data
  } catch {
    // noop
  }
  limpiarDraft(key)
  return null
}

function limpiarDraft(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // noop
  }
}

function construirDefaults(productos: ProductoVenta[] | undefined): RegistrarVentaForm {
  if (productos && productos.length > 0) {
    return {
      clienteId: '',
      metodoPago: 'efectivo',
      descuento: 0,
      observaciones: '',
      detalles: PRODUCTOS_DEFAULT.slice(0, productos.length).map((nombre) => {
        const p = productos.find((x) => x.nombre === nombre)
        return p
          ? { productoId: p.id, cantidad: 0, precioUnitario: p.precio_base }
          : { productoId: '', cantidad: 0, precioUnitario: 0 }
      }),
    }
  }
  return {
    clienteId: '',
    metodoPago: 'efectivo',
    descuento: 0,
    observaciones: '',
    detalles: DETALLES_VACIOS,
  }
}



export default function RegistrarVenta() {
  const { perfil } = useAuth()
  const identidad = useRef(perfil?.id)
  // El cleanup del borrador anterior no debe recrearlo después de un cambio de identidad.
  useLayoutEffect(() => { identidad.current = perfil?.id }, [perfil?.id])
  return <FormularioVenta key={perfil?.id ?? 'sin-sesion'} identidad={identidad} />
}

function FormularioVenta({ identidad }: { identidad: RefObject<string | undefined> }) {
  const { perfil } = useAuth()
  const storageKey = perfil ? `${STORAGE_PREFIX}${perfil.id}` : null
  const [draft] = useState(() => storageKey ? cargarDraft(storageKey) : null)
  const [confirmada, setConfirmada] = useState<{ id: string; cliente: string } | null>(null)
  const [ventaCero, setVentaCero] = useState<RegistrarVentaForm | null>(null)
  const volverAlCliente = useRef(false)
  const draftActivo = useRef(true)
  const navigate = useNavigate()
  const clientes = useClientesRuta()
  const productos = useProductosVenta()
  const carga = useCargaVendedor()
  const registrar = useRegistrarVenta()
  const { toast, mostrar, cerrar } = useToast()
  const motivoBase = useId()
  const defaults = useMemo(() => construirDefaults(productos.data), [productos.data])
  const { register, handleSubmit, control, reset, subscribe, getValues, getFieldState, setValue, setError, setFocus, formState: { errors } } = useForm<RegistrarVentaFormInput, unknown, RegistrarVentaForm>({
    resolver: zodResolver(registrarVentaSchema), defaultValues: draft ?? defaults,
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'detalles' })
  const maxProductos = productos.data?.length ?? 0
  const limiteId = `${motivoBase}-limite-productos`
  const motivoLimite = productos.isPending ? 'Cargando catálogo de productos...'
    : productos.isError ? 'No fue posible cargar el catálogo. Reintenta para agregar productos.'
    : maxProductos === 0 ? 'No hay productos activos en el catálogo.'
    : fields.length >= maxProductos ? `Máximo ${maxProductos} productos por venta: ya agregaste todos los productos activos del catálogo.`
    : undefined
  const didInitRef = useRef(false)
  useEffect(() => {
    if (!didInitRef.current && productos.data?.length) {
      didInitRef.current = true
      // Completar el catálogo tardío sin borrar lo escrito mientras fallaba la lectura.
      if (!draft) defaults.detalles.forEach((detalle, index) => {
        if (!getValues(`detalles.${index}`)) return
        const producto = `detalles.${index}.productoId` as const
        const precio = `detalles.${index}.precioUnitario` as const
        if (!getFieldState(producto).isDirty) setValue(producto, detalle.productoId)
        if (!getFieldState(precio).isDirty) setValue(precio, detalle.precioUnitario)
      })
      // Si el catálogo tiene menos de tres productos, quitar sólo filas iniciales vacías.
      if (!draft) {
        const sobrantes = getValues('detalles').flatMap((detalle, index) =>
          index >= productos.data!.length && !detalle.productoId && !detalle.cantidad && !detalle.precioUnitario ? [index] : [])
        if (sobrantes.length) remove(sobrantes)
      }
    }
  }, [productos.data, defaults, draft, getValues, getFieldState, setValue, remove])
  useEffect(() => {
    if (!clientes.data) return
    const actual = getValues('clienteId')
    if (actual && !clientes.data.some(item => item.id === actual)) {
      setValue('clienteId', '')
      setError('clienteId', { type: 'catalogo', message: 'El cliente del borrador ya no está disponible. Selecciona otro cliente.' })
    }
  }, [clientes.data, getValues, setValue, setError])
  useEffect(() => {
    if (!confirmada && volverAlCliente.current) {
      volverAlCliente.current = false
      setFocus('clienteId')
    }
  }, [confirmada, setFocus])
  const idsSeleccionados = useWatch({ control, name: 'detalles', compute: detalles => detalles.map(item => item.productoId).join('|') }).split('|')
  const productoPorId = useMemo(() => new Map((productos.data ?? []).map(item => [item.id, item])), [productos.data])
  const cargaPorProducto = useMemo(() => new Map((carga.data ?? []).map(item => [item.producto_id, item.cantidad])), [carga.data])
  const esAdmin = perfil?.rol === 'administrador'
  const errorLectura = clientes.error || productos.error || carga.error
  const cargando = clientes.isLoading || productos.isLoading || carga.isLoading
  const motivos: string[] = []
  if (!perfil) motivos.push('No hay sesión activa.')
  else if (esAdmin) motivos.push('El administrador consulta la gestión de ventas; para registrar una venta debe ingresar un vendedor con su propia cartera y carga.')
  else if (errorLectura) motivos.push('No fue posible cargar los datos de la venta. Reintenta las lecturas para continuar.')
  else if (cargando) motivos.push('Cargando los datos necesarios para registrar la venta...')
  else {
    if (!clientes.data?.length) motivos.push('Crea un cliente para continuar con la venta.')
    if (!carga.data?.some(item => item.cantidad > 0)) motivos.push('Aún no tienes carga asignada disponible; pídela a bodega antes de confirmar.')
  }
  const motivoIds = motivos.map((_, index) => `${motivoBase}-${index}`)
  async function reintentarLecturas() {
    await Promise.all([clientes, productos, carga].filter(consulta => consulta.error).map(consulta => consulta.refetch()))
  }

  function validarCarga(values: RegistrarVentaForm): { index: number; mensaje: string } | null {
    const cantidadesPorProducto = new Map<string, number>()
    for (const d of values.detalles) {
      if (!d.productoId || d.cantidad <= 0) continue
      const actual = cantidadesPorProducto.get(d.productoId) ?? 0
      cantidadesPorProducto.set(d.productoId, actual + d.cantidad)
    }
    for (const [productoId, cantidadTotal] of cantidadesPorProducto) {
      const disponible = cargaPorProducto.get(productoId)
      if (disponible === undefined) {
        const prod = productoPorId.get(productoId)
        return { index: values.detalles.findIndex(item => item.productoId === productoId), mensaje: `No tienes carga asignada de ${prod?.nombre ?? 'ese producto'}.` }
      }
      if (cantidadTotal > disponible) {
        const prod = productoPorId.get(productoId)
        return { index: values.detalles.findIndex(item => item.productoId === productoId), mensaje: `No puedes vender ${cantidadTotal} de ${prod?.nombre ?? 'este producto'}: solo tienes ${disponible} en carga.` }
      }
    }
    return null
  }

  function onSubmit(values: RegistrarVentaForm) {
    if (motivos.length) return
    if (values.detalles.length > maxProductos) return setError('detalles', { type: 'catalogo', message: `El catálogo tiene ${maxProductos} productos activos. Quita las filas adicionales antes de confirmar.` })
    const limpio = { ...values, detalles: values.detalles.filter(item => item.productoId && item.cantidad > 0) }
    if (!limpio.detalles.length) return setError('detalles.0.cantidad', { type: 'validacion', message: 'Agrega al menos un producto con cantidad mayor a 0.' }, { shouldFocus: true })
    const errCarga = validarCarga(values)
    if (errCarga) return setError(`detalles.${errCarga.index}.cantidad`, { type: 'carga', message: errCarga.mensaje }, { shouldFocus: true })
    const total = Math.max(0, limpio.detalles.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0) - limpio.descuento)
    if (total === 0) return setVentaCero(limpio)
    enviarVenta(limpio)
  }
  function enviarVenta(values: RegistrarVentaForm) {
    setVentaCero(null)
    registrar.mutate(values, {
      onSuccess: res => {
        if (res.id) {
          draftActivo.current = false
          if (storageKey) limpiarDraft(storageKey)
          setConfirmada({ id: res.id, cliente: clientes.data?.find(item => item.id === values.clienteId)?.nombre ?? 'Cliente' })
          reset(defaults)
          cerrar()
        } else if (res.error) mostrar(res.error, 'error')
      },
      onError: err => mostrar(mensajeErrorSupabase(err), 'error'),
    })
  }
  if (confirmada) return <ResumenVentaConfirmada {...confirmada} perfilId={perfil?.id ?? ''} onOtra={() => {
    draftActivo.current = true
    volverAlCliente.current = true
    setConfirmada(null)
    reset(defaults)
  }} />

  return <>
    <PersistenciaBorradorVenta storageKey={storageKey} identidad={identidad} activo={draftActivo} subscribe={subscribe} getValues={getValues} />
    <Toast toast={toast} onClose={cerrar} />
    <form onSubmit={event => void handleSubmit(onSubmit)(event)} className="min-w-0 space-y-6 pb-28 sm:pb-0" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Registrar venta</h1><p className="mt-1 text-sm text-slate-600">Elige cliente, productos y forma de pago para confirmar tu venta.</p></div>
        <button type="button" className={btnSecondary} onClick={() => navigate('/ventas')}>Cancelar</button>
      </div>
      {motivos.map((motivo, index) => <div key={motivoIds[index]}>
        {errorLectura && !esAdmin ? <div id={motivoIds[index]}><EstadoVista variante="error" mensaje="No fue posible cargar los datos de la venta. Revisa tu conexión e inténtalo de nuevo." onReintentar={() => void reintentarLecturas()} /></div>
          : cargando && !esAdmin ? <div id={motivoIds[index]}><EstadoVista variante="cargando" mensaje={motivo} /></div>
          : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p id={motivoIds[index]}>{motivo}</p>{!esAdmin && motivo.startsWith('Crea') && <Link to="/clientes" className="inline-flex min-h-11 items-center font-medium text-brand-800 underline">Crea uno primero</Link>}</div>}
      </div>)}
      <fieldset disabled={esAdmin} className="min-w-0 space-y-6 border-0 p-0">
      <section className={cardCls}>
        <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">1 · Cliente</h2>
        <div className="p-5"><CampoFormulario etiqueta="Cliente de tu cartera" error={errors.clienteId?.message}>
          {atributos => <Controller control={control} name="clienteId" render={({ field }) => <select {...atributos} {...field}><option value="">Selecciona un cliente...</option>{clientes.data?.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>} />}
        </CampoFormulario></div>
      </section>
      <section className={`${cardCls} min-w-0`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">2 · Productos</h2>
          <button type="button" className={btnSecondary} disabled={!!motivoLimite} aria-describedby={motivoLimite ? limiteId : undefined} onClick={() => append({ productoId: '', cantidad: 0, precioUnitario: 0 })}><PlusCircleIcon className="h-4 w-4" />Agregar producto</button>
          {motivoLimite && <span id={limiteId} className={errorTextCls}>{motivoLimite}</span>}
        </div>
        <div className="min-w-0 lg:overflow-x-auto"><table role="table" className="block w-full lg:table">
          <thead role="rowgroup" className="sr-only lg:not-sr-only lg:table-header-group"><tr role="row" className="bg-slate-50">{['Producto', 'Disponible', 'Cantidad', 'Precio unit.', 'Subtotal', ''].map((titulo, index) => <th role="columnheader" scope="col" key={index} className={thCls}>{titulo}</th>)}</tr></thead>
          <tbody role="rowgroup" className="block space-y-3 bg-slate-50 p-3 lg:table-row-group lg:space-y-0 lg:bg-transparent lg:p-0">{fields.map((field, index) => <FilaProductoVenta key={field.id} control={control} index={index} productos={productos.data ?? []} seleccionados={idsSeleccionados} carga={cargaPorProducto} puedeQuitar={fields.length > 1} onQuitar={() => remove(index)} />)}</tbody>
        </table></div>
        {errors.detalles?.message && <p className={`px-5 py-2 ${errorTextCls}`}>{errors.detalles.message}</p>}
      </section>
      <section className={cardCls}>
        <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">3 · Pago</h2>
        <div className="grid min-w-0 grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <CampoFormulario etiqueta="Método de pago" error={errors.metodoPago?.message}>
            {atributos => <select {...atributos} {...register('metodoPago')}>{METODOS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>}
          </CampoFormulario>
          <CampoFormulario etiqueta="Descuento (CLP)" error={errors.descuento?.message}>
            {atributos => <Controller control={control} name="descuento" render={({ field }) => <InputNumerico {...atributos} {...field} value={Number(field.value) || 0} onChange={valor => field.onChange(valor ?? 0)} conFlechas={false} />} />}
          </CampoFormulario>
          <CampoFormulario etiqueta="Observaciones" error={errors.observaciones?.message}>
            {atributos => <input {...atributos} type="text" maxLength={500} placeholder="Opcional" {...register('observaciones')} />}
          </CampoFormulario>
        </div>
      </section>
      <ResumenFormularioVenta control={control} pendiente={registrar.isPending} bloqueado={!!motivos.length} motivoId={motivoIds.join(' ') || undefined} />
      </fieldset>
    </form>
    <Dialog open={!!ventaCero} onClose={() => setVentaCero(null)} title="Confirmar venta sin cobro" description="Registrarás una venta con total $0. Revisa los precios y el descuento antes de continuar.">
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className={btnSecondary} onClick={() => setVentaCero(null)}>Volver a revisar</button>
        <button type="button" className={btnSecondary} disabled={registrar.isPending} onClick={() => { if (ventaCero) enviarVenta(ventaCero) }}>Confirmar venta por $0</button>
      </div>
    </Dialog>
  </>
}
