import { useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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

const STORAGE_KEY = 'ondina:draft-registrar-venta'

const PRODUCTOS_DEFAULT = ['Bidón POL', 'Bidón PET', 'Hielo CUBO']

// HU-01: limite maximo de productos por venta
const MAX_PRODUCTOS = 6

const DETALLES_VACIOS: DetalleVentaDraft[] = PRODUCTOS_DEFAULT.map(() => ({
  productoId: '',
  cantidad: 0,
  precioUnitario: 0,
}))

function fmtCLP(n: number) {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
}

function cargarDraft(): Partial<RegistrarVentaForm> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<RegistrarVentaForm>
  } catch {
    return null
  }
}

function guardarDraft(form: RegistrarVentaForm) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form))
  } catch {
    // noop
  }
}

function limpiarDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

function construirDefaults(productos: ProductoVenta[] | undefined): RegistrarVentaForm {
  const draft = cargarDraft()
  const draftTieneProducto =
    !!draft?.detalles?.length && draft.detalles.some((d) => d?.productoId)
  if (draftTieneProducto) return draft as RegistrarVentaForm
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

function soloNumeros(e: React.KeyboardEvent<HTMLInputElement>) {
  const teclasPermitidas = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (teclasPermitidas.includes(e.key) || (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))) return
  if (!/^\d$/.test(e.key)) e.preventDefault()
}

export default function RegistrarVenta() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const clientes = useClientesRuta()
  const productos = useProductosVenta()
  const carga = useCargaVendedor()
  const registrar = useRegistrarVenta()
  const { toast, mostrar, cerrar } = useToast()

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
    defaultValues: defaults,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'detalles' })

  const didInitRef = useRef(false)
  useEffect(() => {
    if (!didInitRef.current && productos.data?.length) {
      didInitRef.current = true
      reset(defaults)
    }
  }, [productos.data, defaults, reset])

  const formValues = useWatch({ control })
  const first = useWatch({ control, name: 'detalles' })
  useEffect(() => {
    if (formValues && (formValues as RegistrarVentaForm).detalles) {
      guardarDraft(formValues as RegistrarVentaForm)
    }
  }, [formValues])

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
          limpiarDraft()
          reset(defaults)
          mostrar(`Venta registrada. Folio: ${res.id.substring(0, 8)}`, 'exito')
          void carga.refetch()
          setTimeout(() => navigate('/ventas'), 2000)
        } else if (res.error) {
          mostrar(res.error, 'error')
        }
      },
      onError: (err) => {
        mostrar(err instanceof Error ? err.message : 'No se pudo registrar la venta', 'error')
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

        {/* 1. Cliente */}
        <section className={cardCls}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">1 · Cliente</h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            <label className={`${labelCls} max-w-md`}>
              Cliente de tu cartera
              <select className={inputCls} {...register('clienteId')}>
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
                            {disponible}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={`mb-2 block sm:table-cell sm:mb-0 ${tdCls}`}>
                        <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">Cantidad</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          className={`${inputCls} w-full sm:w-24 ${excede ? inputErrorCls : ''}`}
                          {...register(`detalles.${index}.cantidad` as const)}
                          onKeyDown={soloNumeros}
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
                        <input
                          type="number"
                          min={0}
                          step={100}
                          inputMode="numeric"
                          className={`${inputCls} w-full sm:w-28`}
                          {...register(`detalles.${index}.precioUnitario` as const)}
                          onKeyDown={soloNumeros}
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
              <input
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                className={inputCls}
                {...register('descuento')}
                onKeyDown={soloNumeros}
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
                  {registrar.error instanceof Error
                    ? registrar.error.message
                    : 'No se pudo registrar la venta'}
                </p>
              )}
              <button type="submit" className={btnPrimary} disabled={registrar.isPending}>
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
