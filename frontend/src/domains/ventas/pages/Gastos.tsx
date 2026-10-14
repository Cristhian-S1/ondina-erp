import { z } from 'zod'
import CampoFormulario from '../components/CampoFormulario'
import EstadoVista from '../../../components/EstadoVista'
import InputNumerico from '../../../components/InputNumerico'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useGastosHoy } from '../hooks/useGastosHoy'
import { useCrearGasto } from '../hooks/useCrearGasto'
import { crearGastoSchema, tipoGastoEnum } from '../schemas'
import { Toast } from '../../../components/Toast'
import { useToast } from '../../../components/toast-utils'
import { btnPrimary, cardCls } from '../../../lib/ui'
import { fmtFechaHora, formatMiles } from '../../../lib/format'
import { mensajeErrorSupabase } from '../../../lib/errors'

const TIPOS: { value: 'combustible' | 'averia' | 'otra'; label: string }[] = [
  { value: 'combustible', label: 'Combustible' },
  { value: 'averia', label: 'Avería' },
  { value: 'otra', label: 'Otra' },
]

function fmtMonto(n: number) {
  return `$ ${formatMiles(n)}`
}

const formularioGastoSchema = crearGastoSchema.extend({
  tipo: z.enum(['', 'combustible', 'averia', 'otra'])
    .refine(tipo => tipo !== '', 'Selecciona el tipo de gasto').pipe(tipoGastoEnum),
})
type FormularioGasto = z.input<typeof formularioGastoSchema>
type GastoValidado = z.output<typeof formularioGastoSchema>

export default function Gastos() {
  const { data, isLoading, error, refetch } = useGastosHoy()
  const crear = useCrearGasto()
  const { toast, mostrar, cerrar } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormularioGasto, unknown, GastoValidado>({
    resolver: zodResolver(formularioGastoSchema),
    defaultValues: { tipo: '', monto: undefined, motivo: '' },
  })

  function onSubmit(values: GastoValidado) {
    crear.mutate(values, {
      onSuccess: (res) => {
        if (res.error) {
          mostrar(res.error, 'error')
          return
        }
        reset({ tipo: '', monto: undefined, motivo: '' })
        mostrar('Gasto registrado.', 'exito')
      },
      onError: (err) => {
        mostrar(mensajeErrorSupabase(err), 'error')
      },
    })
  }

  const totalHoy = (data ?? []).filter((g) => !g.anulado).reduce((sum, g) => sum + g.monto, 0)

  return (
    <div className="space-y-6">
      <Toast toast={toast} onClose={cerrar} />
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
          <CampoFormulario etiqueta="Tipo" error={errors.tipo?.message}>
            {atributos => <select {...atributos} {...register('tipo')}><option value="">Selecciona un tipo...</option>{TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>}
          </CampoFormulario>
          <CampoFormulario etiqueta="Monto (CLP)" error={errors.monto?.message}>
            {atributos => <Controller control={control} name="monto" render={({ field }) => <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute top-[calc(50%+0.125rem)] left-3 -translate-y-1/2 text-sm text-slate-500">$</span>
              <InputNumerico {...atributos} {...field} className={`${atributos.className} pl-7`} value={field.value === undefined ? undefined : Number(field.value)} onChange={field.onChange} conFlechas={false} /></div>} />}
          </CampoFormulario>
          <CampoFormulario etiqueta="Motivo" error={errors.motivo?.message}>
            {atributos => <input {...atributos} type="text" maxLength={300} placeholder="Descripción breve" {...register('motivo')} />}
          </CampoFormulario>
        </div>

        <div className="flex flex-wrap justify-end">
          <button type="submit" className={btnPrimary} disabled={crear.isPending}>
            {crear.isPending ? 'Registrando...' : 'Registrar gasto'}
          </button>
        </div>
      </form>

      <section className={cardCls}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Gastos de hoy</h2>
          <span className="text-sm font-semibold text-slate-700">
            {error || isLoading ? 'Total: —' : `Total: ${fmtMonto(totalHoy)}`}
          </span>
        </div>
        {isLoading ? (
          <EstadoVista variante="cargando" mensaje="Cargando gastos..." />
        ) : error ? (
          <EstadoVista variante="error" mensaje="No fue posible cargar los gastos de hoy. Inténtalo de nuevo." onReintentar={() => void refetch()} />
        ) : !data || data.length === 0 ? (
          <EstadoVista variante="vacio" mensaje="No has registrado gastos hoy." />
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
                    {TIPOS.find((t) => t.value === g.tipo)?.label ?? g.tipo} · {fmtFechaHora(g.creado_en)}
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
