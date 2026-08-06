import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../../context/auth-context'
import { useClientesRuta } from '../hooks/useClientesRuta'
import { useProductosVenta } from '../hooks/useProductosVenta'
import { useRegistrarVenta } from '../hooks/useRegistrarVenta'
import { registrarVentaSchema, type RegistrarVentaForm } from '../schemas'
import type { ProductoVenta } from '../types'
import {
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  tdCls,
  thCls,
} from '../../../lib/ui'
import { PlusCircleIcon, ShoppingCartIcon } from '../../../components/icons'

const METODOS: { value: 'efectivo' | 'transferencia'; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
]

function fmtCLP(n: number) {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
}

export default function RegistrarVenta() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const clientes = useClientesRuta()
  const productos = useProductosVenta()
  const registrar = useRegistrarVenta()

  const [ventaId, setVentaId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RegistrarVentaForm>({
    resolver: zodResolver(registrarVentaSchema),
    defaultValues: {
      clienteId: '',
      metodoPago: 'efectivo',
      descuento: 0,
      observaciones: '',
      detalles: [{ productoId: '', cantidad: 1, precioUnitario: 0, envasesRecibidos: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'detalles' })

  const productoPorId = useMemo(() => {
    const m = new Map<string, ProductoVenta>()
    for (const p of productos.data ?? []) m.set(p.id, p)
    return m
  }, [productos.data])

  function onChangeProducto(index: number, id: string) {
    const prod = productoPorId.get(id)
    if (prod) setValue(`detalles.${index}.precioUnitario`, prod.precio_base)
  }

  const detalles = useWatch({ control, name: 'detalles' })
  const descuento = useWatch({ control, name: 'descuento' })
  const totalPreview = useMemo(() => {
    const sub = (detalles ?? []).reduce(
      (sum, d) => sum + (Number(d?.cantidad) || 0) * (Number(d?.precioUnitario) || 0),
      0,
    )
    return Math.max(0, sub - (Number(descuento) || 0))
  }, [detalles, descuento])

  function onSubmit(values: RegistrarVentaForm) {
    registrar.mutate(values, {
      onSuccess: (res) => {
        if (res.id) {
          setVentaId(res.id)
          reset()
        }
      },
    })
  }

  if (ventaId) {
    return (
      <div className="space-y-6">
        <div className={`${cardCls} mx-auto max-w-xl p-8 text-center`}>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <ShoppingCartIcon className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Venta registrada</h1>
          <p className="mt-2 text-sm text-slate-500">
            Se creó la venta con folio interno{' '}
            <span className="font-mono text-slate-900">{ventaId}</span>.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/ventas/registrar" className={btnPrimary} onClick={() => setVentaId(null)}>
              Registrar otra venta
            </Link>
            <Link to="/ventas" className={btnSecondary}>
              Volver al resumen
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registrar venta</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cliente, productos y pago. La venta se confirma en una sola operación.
          </p>
        </div>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => navigate('/ventas')}
        >
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
              <span className="mt-1 block text-xs text-red-600">
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
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              append({ productoId: '', cantidad: 1, precioUnitario: 0, envasesRecibidos: 0 })
            }
          >
            <PlusCircleIcon className="h-4 w-4" />
            Agregar producto
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className={thCls}>Producto</th>
                <th className={thCls}>Cantidad</th>
                <th className={thCls}>Precio unit.</th>
                <th className={thCls}>Envases recibidos</th>
                <th className={thCls}>Subtotal</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map((field, index) => {
                const d = detalles?.[index]
                const subtotal =
                  (Number(d?.cantidad) || 0) * (Number(d?.precioUnitario) || 0)
                return (
                  <tr key={field.id}>
                    <td className={tdCls}>
                      <select
                        className={inputCls}
                        {...register(`detalles.${index}.productoId` as const)}
                        onChange={(e) => onChangeProducto(index, e.target.value)}
                      >
                        <option value="">Selecciona...</option>
                        {productos.data?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.tipo_empaque ? `(${p.tipo_empaque.nombre})` : ''}
                          </option>
                        ))}
                      </select>
                      {errors.detalles?.[index]?.productoId && (
                        <span className="mt-1 block text-xs text-red-600">
                          {errors.detalles[index]?.productoId?.message}
                        </span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={`${inputCls} w-24`}
                        {...register(`detalles.${index}.cantidad` as const)}
                      />
                      {errors.detalles?.[index]?.cantidad && (
                        <span className="mt-1 block text-xs text-red-600">
                          {errors.detalles[index]?.cantidad?.message}
                        </span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={`${inputCls} w-28`}
                        {...register(`detalles.${index}.precioUnitario` as const)}
                      />
                    </td>
                    <td className={tdCls}>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={`${inputCls} w-28`}
                        {...register(`detalles.${index}.envasesRecibidos` as const)}
                      />
                    </td>
                    <td className={`${tdCls} font-semibold`}>{fmtCLP(subtotal)}</td>
                    <td className={tdCls}>
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
        {errors.detalles && !Array.isArray(errors.detalles) && (
          <p className="px-5 py-2 text-xs text-red-600">
            {(errors.detalles as { message?: string }).message ?? 'Revisa los productos'}
          </p>
        )}
        {errors.detalles?.message && (
          <p className="px-5 py-2 text-xs text-red-600">{errors.detalles.message}</p>
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
              step={1}
              className={inputCls}
              {...register('descuento')}
            />
            {errors.descuento && (
              <span className="mt-1 block text-xs text-red-600">
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
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium text-slate-900">
                {fmtCLP(
                  (detalles ?? []).reduce(
                    (s, d) => s + (Number(d.cantidad) || 0) * (Number(d.precioUnitario) || 0),
                    0,
                  ),
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="text-slate-500">Descuento</dt>
              <dd className="font-medium text-slate-900">−{fmtCLP(Number(descuento) || 0)}</dd>
            </div>
            <div className="flex justify-between gap-6 border-t border-slate-100 pt-1">
              <dt className="text-slate-700 font-semibold">Total a cobrar</dt>
              <dd className="text-lg font-bold text-slate-900">{fmtCLP(totalPreview)}</dd>
            </div>
          </dl>

          <div className="flex flex-col items-end gap-2">
            {registrar.data?.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {registrar.data.error}
              </p>
            )}
            {registrar.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
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
              El descuento de carga y el total los calcula la base de datos.
            </p>
          </div>
        </div>
      </section>

      {!perfil && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          No hay sesión activa.
        </p>
      )}
    </form>
  )
}