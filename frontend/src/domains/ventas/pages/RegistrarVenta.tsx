import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatMiles, formatMilesInput, parseMiles } from '../../../lib/format'
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
import {
  btnPrimary,
  btnSecondary,
  cardCls,
  errorTextCls,
  errorBlockCls,
  inputCls,
  inputErrorCls,
  labelCls,
  tdCls,
  thCls,
} from '../../../lib/ui'
import { PlusCircleIcon, ShoppingCartIcon } from '../../../components/icons'

const METODOS: { value: 'efectivo' | 'transferencia'; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
]

const STORAGE_PREFIX = 'ondina:draft-registrar-venta:'

const PRODUCTOS_DEFAULT = ['Bidón POL', 'Bidón PET', 'Hielo CUBO']

// HU-01: limite maximo de productos por venta
const MAX_PRODUCTOS = 6

const DETALLES_VACIOS: DetalleVentaDraft[] = PRODUCTOS_DEFAULT.map(() => ({
  productoId: '',
  cantidad: 0,
  precioUnitario: 0,
}))

function fmtCLP(n: number) {
  return formatMiles(n)
}

const draftSchema = registrarVentaSchema.extend({
  clienteId: z.string(),
  descuento: z.number().min(0),
  detalles: z.array(z.object({
    productoId: z.string(),
    cantidad: z.number().int().min(0),
    precioUnitario: z.number().min(0),
  })).min(1).max(MAX_PRODUCTOS),
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

function guardarDraft(key: string, form: RegistrarVentaFormInput) {
  try {
    sessionStorage.setItem(key, JSON.stringify(form))
  } catch {
    // noop
  }
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
      detalles: PRODUCTOS_DEFAULT.map((nombre) => {
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
  return <FormularioVenta key={perfil?.id ?? 'sin-sesion'} />
}

function FormularioVenta() {
  const { perfil } = useAuth()
  const storageKey = perfil ? `${STORAGE_PREFIX}${perfil.id}` : null
  const [draft] = useState(() => storageKey ? cargarDraft(storageKey) : null)
  const [completed, setCompleted] = useState(false)
  const navigate = useNavigate()
  const clientes = useClientesRuta()
  const productos = useProductosVenta()
  const carga = useCargaVendedor()
  const errorLectura = clientes.error || productos.error || carga.error
  const registrar = useRegistrarVenta()
  const { toast, mostrar, cerrar } = useToast()
  const clienteId = useId()

  const defaults = useMemo(
    () => construirDefaults(productos.data),
    [productos.data],
  )

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RegistrarVentaFormInput, unknown, RegistrarVentaForm>({
    resolver: zodResolver(registrarVentaSchema),
    defaultValues: draft ?? defaults,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'detalles' })

  const didInitRef = useRef(false)
  useEffect(() => {
    if (!didInitRef.current && productos.data?.length) {
      didInitRef.current = true
      reset(draft ?? defaults)
    }
  }, [productos.data, defaults, draft, reset])

  const formValues = useWatch({ control })
  const first = useWatch({ control, name: 'detalles' })
  useEffect(() => {
    if (storageKey && didInitRef.current && !completed && formValues.detalles) {
      guardarDraft(storageKey, formValues as RegistrarVentaFormInput)
    }
  }, [formValues, storageKey, completed])

  const productoPorId = useMemo(() => {
    const m = new Map<string, ProductoVenta>()
    for (const p of productos.data ?? []) m.set(p.id, p)
    return m
  }, [productos.data])

  const cargaPorProducto = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of carga.data ?? []) m.set(c.producto_id, c.cantidad)
    return m
  }, [carga.data])

  function onChangeProducto(index: number, id: string) {
    const prod = productoPorId.get(id)
    if (prod) setValue(`detalles.${index}.precioUnitario`, prod.precio_base)
  }

  const detalles = first
  const descuento = useWatch({ control, name: 'descuento' })
  const totalPreview = useMemo(() => {
    const sub = (detalles ?? []).reduce(
      (sum, d) => sum + (Number(d?.cantidad) || 0) * (Number(d?.precioUnitario) || 0),
      0,
    )
    return Math.max(0, sub - (Number(descuento) || 0))
  }, [detalles, descuento])

  function validarCarga(values: RegistrarVentaForm): string | null {
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
        return `No tienes carga asignada de ${prod?.nombre ?? 'ese producto'}.`
      }
      if (cantidadTotal > disponible) {
        const prod = productoPorId.get(productoId)
        return `No puedes vender ${cantidadTotal} de ${prod?.nombre ?? 'este producto'}: solo tienes ${disponible} en carga.`
      }
    }
    return null
  }

  function onSubmit(values: RegistrarVentaForm) {
    if (errorLectura) {
      mostrar('No fue posible cargar los datos de la venta. Inténtalo de nuevo.', 'error')
      return
    }
    const limpio = {
      ...values,
      detalles: values.detalles.filter((d) => d.productoId && d.cantidad > 0),
    }
    // HU-01: filtrar cantidad>0 porque el schema permite 0
    if (limpio.detalles.length === 0) {
      mostrar('Agrega al menos un producto con cantidad mayor a 0.', 'error')
      return
    }

    const errCarga = validarCarga(limpio)
    if (errCarga) {
      mostrar(errCarga, 'error')
      return
    }

    registrar.mutate(limpio, {
      onSuccess: (res) => {
        if (res.id) {
          setCompleted(true)
          if (storageKey) limpiarDraft(storageKey)
          reset(defaults)
          mostrar(`Venta registrada. Folio: ${res.id.substring(0, 8)}`, 'exito')
          void carga.refetch()
          setTimeout(() => navigate('/ventas'), 2000)
        } else if (res.error) {
          mostrar(res.error, 'error')
        }
      },
      onError: (err) => {
        mostrar(mensajeErrorSupabase(err), 'error')
      },
    })
  }

  return (
    <>
      <Toast toast={toast} onClose={cerrar} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Registrar venta</h1>
            <p className="mt-1 text-sm text-slate-500">
              Cliente, productos y pago. La venta se confirma en una sola operación.
            </p>
          </div>
          <button type="button" className={btnSecondary} onClick={() => navigate('/ventas')}>
            Cancelar
          </button>
        </div>

        {errorLectura && (
          <p role="alert" className={errorBlockCls}>
            No fue posible cargar los datos de la venta. Revisa tu conexión e inténtalo de nuevo.
          </p>
        )}

        {/* 1. Cliente */}
        <section className={cardCls}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">1 · Cliente</h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            <label htmlFor={clienteId} className={`${labelCls} max-w-md`}>
              Cliente de tu cartera
              <select id={clienteId} className={inputCls} {...register('clienteId')}>
                <option value="">Selecciona un cliente...</option>
                {clientes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {errors.clienteId && (
                <span className={errorTextCls}>
                  {errors.clienteId.message}
                </span>
              )}
            </label>
            {clientes.data && clientes.data.length === 0 && (
              <p className="text-xs text-slate-500">
                No tienes clientes registrados.{' '}
                <Link to="/clientes" className="font-medium text-brand-700 hover:underline">
                  Crea uno primero
                </Link>
                .
              </p>
            )}
          </div>
        </section>

        {/* 2. Detalles */}
        <section className={cardCls}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">2 · Productos</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={btnSecondary}
                disabled={fields.length >= MAX_PRODUCTOS}
                onClick={() =>
                  append({ productoId: '', cantidad: 0, precioUnitario: 0 })
                }
              >
                <PlusCircleIcon className="h-4 w-4" />
                Agregar producto
              </button>
              {fields.length >= MAX_PRODUCTOS && (
                <span className={errorTextCls}>Máximo {MAX_PRODUCTOS} productos por venta</span>
              )}
            </div>
          </div>

          {/* HU-01: tabla responsive — se transforma en tarjetas en movil con CSS */}
          <div className="overflow-x-auto p-4">
            <table className="w-full">
              <thead className="hidden sm:table-header-group">
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className={thCls}>Producto</th>
                  <th className={thCls}>Disponible</th>
                  <th className={thCls}>Cantidad</th>
                  <th className={thCls}>Precio unit.</th>
                  <th className={thCls}>Subtotal</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody className="block gap-3 sm:table sm:table-row-group sm:divide-y sm:divide-slate-100">
                {fields.map((field, index) => {
                  const d = detalles?.[index]
                  const subtotal =
                    (Number(d?.cantidad) || 0) * (Number(d?.precioUnitario) || 0)
                  const prodId = d?.productoId
                  const disponible = prodId ? cargaPorProducto.get(prodId) : undefined
                  const cantIng = Number(d?.cantidad) || 0
                  const excede = disponible !== undefined && cantIng > disponible && cantIng > 0
                  const idsSeleccionados = new Set(
                    (detalles ?? [])
                      .map((det, i) => i !== index && det?.productoId ? det.productoId : null)
                      .filter(Boolean) as string[],
                  )
                  const productoReg = register(`detalles.${index}.productoId` as const)
                  return (
                    <tr key={field.id} className="mb-3 block rounded-xl border border-slate-200 p-4 sm:mb-0 sm:table-row sm:border-0 sm:p-0">
                      <td className={`mb-2 block sm:table-cell sm:mb-0 ${tdCls}`}>
                        <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">Producto</span>
                        <select
                          aria-label={`Producto ${index + 1}`}
                          className={inputCls}
                          {...productoReg}
                          onChange={(e) => {
                            productoReg.onChange(e)
                            onChangeProducto(index, e.target.value)
                          }}
                        >
                          <option value="">Selecciona...</option>
                          {productos.data?.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={idsSeleccionados.has(p.id)}
                            >
                              {p.nombre} {p.tipo_empaque ? `(${p.tipo_empaque.nombre})` : ''}
                              {idsSeleccionados.has(p.id) ? ' (ya seleccionado)' : ''}
                            </option>
                          ))}
                        </select>
                        {errors.detalles?.[index]?.productoId && (
                          <span className={errorTextCls}>
                            {errors.detalles[index]?.productoId?.message}
                          </span>
                        )}
                      </td>
                      <td className={`mb-2 block sm:table-cell sm:mb-0 ${tdCls} text-sm font-medium`}>
                        <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">Disponible</span>
                        {disponible !== undefined ? (
                          <span className={excede ? 'text-red-600' : 'text-slate-700'}>
                            {formatMiles(disponible)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={`mb-2 block sm:table-cell sm:mb-0 ${tdCls}`}>
                        <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">Cantidad</span>
                        <Controller
                          control={control}
                          name={`detalles.${index}.cantidad` as const}
                          render={({ field }) => (
                            <input
                              aria-label={`Cantidad de ${productos.data?.find((p) => p.id === prodId)?.nombre ?? `producto ${index + 1}`}`}
                              type="text"
                              inputMode="numeric"
                              placeholder=""
                              className={`${inputCls} w-full sm:w-24 ${excede ? inputErrorCls : ''}`}
                              value={field.value ? formatMiles(field.value as number) : ''}
                              onChange={(e) => {
                                const formatted = formatMilesInput(e.target.value)
                                e.target.value = formatted
                                const numeric = parseMiles(formatted)
                                field.onChange(numeric)
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          )}
                        />
                        {excede && (
                          <span className={errorTextCls}>
                            Excede tu carga
                          </span>
                        )}
                        {errors.detalles?.[index]?.cantidad && (
                          <span className={errorTextCls}>
                            {errors.detalles[index]?.cantidad?.message}
                          </span>
                        )}
                      </td>
                      <td className={`mb-2 block sm:table-cell sm:mb-0 ${tdCls}`}>
                        <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">Precio unit.</span>
                        <Controller
                          control={control}
                          name={`detalles.${index}.precioUnitario` as const}
                          render={({ field }) => (
                            <input
                              aria-label={`Precio unitario de ${productos.data?.find((p) => p.id === prodId)?.nombre ?? `producto ${index + 1}`}`}
                              type="text"
                              inputMode="numeric"
                              placeholder=""
                              className={`${inputCls} w-full sm:w-28`}
                              value={field.value ? formatMiles(field.value as number) : ''}
                              onChange={(e) => {
                                const formatted = formatMilesInput(e.target.value)
                                e.target.value = formatted
                                const numeric = parseMiles(formatted)
                                field.onChange(numeric)
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          )}
                        />
                      </td>
                      <td className={`mb-2 block sm:table-cell sm:mb-0 ${tdCls} font-semibold`}>
                        <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">Subtotal</span>
                        {fmtCLP(subtotal)}
                      </td>
                      <td className="block sm:table-cell">
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => fields.length > 1 && remove(index)}
                          disabled={fields.length <= 1}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {errors.detalles?.message && (
            <p className={`px-5 py-2 ${errorTextCls}`}>{errors.detalles.message}</p>
          )}
        </section>

        {/* 3. Pago */}
        <section className={cardCls}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">3 · Pago</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
            <label className={labelCls}>
              Método de pago
              <select className={inputCls} {...register('metodoPago')}>
                {METODOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Descuento (CLP)
              <Controller
                control={control}
                name="descuento"
                render={({ field }) => (
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    className={inputCls}
                    value={field.value ? formatMiles(field.value as number) : '0'}
                    onChange={(e) => {
                      const formatted = formatMilesInput(e.target.value)
                      // Si queda vacio, mostrar 0
                      const display = formatted || '0'
                      e.target.value = display
                      const numeric = parseMiles(display)
                      field.onChange(numeric)
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
              {errors.descuento && (
                <span className={errorTextCls}>
                  {errors.descuento.message}
                </span>
              )}
            </label>
            <label className={labelCls}>
              Observaciones
              <input
                type="text"
                maxLength={500}
                className={inputCls}
                placeholder="Opcional"
                {...register('observaciones')}
              />
            </label>
          </div>
        </section>

        {/* 4. Resumen */}
        <section className={cardCls}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">4 · Resumen</h2>
          </div>
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-medium text-slate-900">
                  {fmtCLP(
                    (detalles ?? []).reduce(
                      (s, d) =>
                        s + (Number(d?.cantidad) || 0) * (Number(d?.precioUnitario) || 0),
                      0,
                    ),
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-slate-500">Descuento</dt>
                <dd className="font-medium text-slate-900">
                  −{fmtCLP(Number(descuento) || 0)}
                </dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-slate-100 pt-1">
                <dt className="text-slate-700 font-semibold">Total a cobrar</dt>
                <dd className="text-lg font-bold text-slate-900">{fmtCLP(totalPreview)}</dd>
              </div>
            </dl>

            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              {registrar.data?.error && (
                <p className={errorBlockCls}>
                  {registrar.data.error}
                </p>
              )}
              {registrar.error && (
                <p className={errorBlockCls}>
                  {mensajeErrorSupabase(registrar.error)}
                </p>
              )}
              <button type="submit" className={btnPrimary} disabled={registrar.isPending || !!errorLectura}>
                <ShoppingCartIcon className="h-4 w-4" />
                {registrar.isPending ? 'Registrando venta...' : 'Confirmar venta'}
              </button>
              <p className="text-xs text-slate-400">
                El total y el descuento de carga los calcula la base de datos.
              </p>
            </div>
          </div>
        </section>

        {!perfil && (
          <p className={errorBlockCls}>
            No hay sesión activa.
          </p>
        )}
      </form>
    </>
  )
}
