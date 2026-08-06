import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useGastosHoy } from '../hooks/useGastosHoy'
import { useCrearGasto } from '../hooks/useCrearGasto'
import { crearGastoSchema, type CrearGastoInput } from '../schemas'
import { btnPrimary, cardCls, fmtFecha, inputCls, labelCls } from '../../../lib/ui'

const TIPOS: { value: 'combustible' | 'averia' | 'otra'; label: string }[] = [
  { value: 'combustible', label: 'Combustible' },
  { value: 'averia', label: 'Avería' },
  { value: 'otra', label: 'Otra' },
]

function fmtMonto(n: number) {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
}

export default function Gastos() {
  const { data, isLoading } = useGastosHoy()
  const crear = useCrearGasto()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CrearGastoInput>({
    resolver: zodResolver(crearGastoSchema),
    defaultValues: { tipo: 'otra', monto: undefined as unknown as number, motivo: '' },
  })

  function onSubmit(values: CrearGastoInput) {
    crear.mutate(values, {
      onSuccess: (res) => {
        if (res.error) return
        reset({ tipo: 'otra', monto: undefined as unknown as number, motivo: '' })
      },
    })
  }

  const totalHoy = (data ?? []).filter((g) => !g.anulado).reduce((sum, g) => sum + g.monto, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gastos extras</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registra gastos de ruta del día. En esta versión no se adjuntan comprobantes.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className={`${cardCls} space-y-4 p-5`}
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className={labelCls}>
            Tipo
            <select className={inputCls} {...register('tipo')}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className={labelCls}>
            Monto (CLP)
            <input
              type="number"
              min={1}
              step={1}
              className={inputCls}
              placeholder="0"
              {...register('monto')}
            />
            {errors.monto && (
              <span className="mt-1 block text-xs text-red-600">{errors.monto.message}</span>
            )}
          </label>

          <label className={labelCls}>
            Motivo
            <input
              type="text"
              maxLength={300}
              className={inputCls}
              placeholder="Descripción breve"
              {...register('motivo')}
            />
            {errors.motivo && (
              <span className="mt-1 block text-xs text-red-600">{errors.motivo.message}</span>
            )}
          </label>
        </div>

        {crear.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {crear.error instanceof Error ? crear.error.message : 'No se pudo registrar el gasto'}
          </p>
        )}
        {crear.data?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {crear.data.error}
          </p>
        )}
        {crear.isSuccess && !crear.data?.error && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Gasto registrado.
          </p>
        )}

        <div className="flex justify-end">
          <button type="submit" className={btnPrimary} disabled={crear.isPending}>
            {crear.isPending ? 'Registrando...' : 'Registrar gasto'}
          </button>
        </div>
      </form>

      <section className={cardCls}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Gastos de hoy</h2>
          <span className="text-sm font-semibold text-slate-700">
            Total: {fmtMonto(totalHoy)}
          </span>
        </div>
        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Cargando...</p>
        ) : !data || data.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No has registrado gastos hoy.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {g.motivo}
                    {g.anulado && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                        Anulado
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {TIPOS.find((t) => t.value === g.tipo)?.label ?? g.tipo} · {fmtFecha(g.creado_en)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {fmtMonto(g.monto)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}