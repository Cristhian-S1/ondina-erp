import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCrearCliente } from '../hooks/useCrearCliente'
import { useVendedoresSucursal } from '../hooks/useVendedoresSucursal'
import { useAuth } from '../../../context/auth-context'
import { crearClienteSchema, type CrearClienteInput } from '../schemas'
import { btnPrimary, btnSecondary, inputCls, labelCls } from '../../../lib/ui'

const TIPOS: { value: 'mayorista' | 'minorista' | 'ocasional'; label: string }[] = [
  { value: 'minorista', label: 'Minorista' },
  { value: 'mayorista', label: 'Mayorista' },
  { value: 'ocasional', label: 'Ocasional' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function RegistrarCliente({ open, onClose }: Props) {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'
  const vendedores = useVendedoresSucursal()
  const crear = useCrearCliente()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CrearClienteInput>({
    resolver: zodResolver(crearClienteSchema),
    defaultValues: {
      nombre: '',
      direccion: '',
      telefono: '',
      numero_local: '',
      tipo: 'minorista',
      vendedor_id: perfil?.id ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        nombre: '',
        direccion: '',
        telefono: '',
        numero_local: '',
        tipo: 'minorista',
        vendedor_id: perfil?.id ?? '',
      })
    }
  }, [open, reset, perfil])

  if (!open) return null

  function onSubmit(values: CrearClienteInput) {
    crear.mutate(values, {
      onSuccess: (res) => {
        if (res.error) return
        onClose()
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        noValidate
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Nuevo cliente</h2>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {esAdmin && (
          <label className={labelCls}>
            Vendedor responsable
            <select className={inputCls} {...register('vendedor_id')}>
              <option value="">Selecciona un vendedor...</option>
              {vendedores.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombres} {v.apellidos}
                </option>
              ))}
            </select>
            {errors.vendedor_id && (
              <span className="mt-1 block text-xs text-red-600">
                {errors.vendedor_id.message}
              </span>
            )}
          </label>
        )}

        <label className={labelCls}>
          Nombre
          <input
            type="text"
            maxLength={120}
            className={inputCls}
            placeholder="Nombre o razón comercial"
            {...register('nombre')}
          />
          {errors.nombre && (
            <span className="mt-1 block text-xs text-red-600">{errors.nombre.message}</span>
          )}
        </label>

        <label className={labelCls}>
          Dirección
          <input
            type="text"
            maxLength={200}
            className={inputCls}
            placeholder="Calle, número, comuna"
            {...register('direccion')}
          />
          {errors.direccion && (
            <span className="mt-1 block text-xs text-red-600">{errors.direccion.message}</span>
          )}
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelCls}>
            Teléfono
            <input
              type="text"
              maxLength={30}
              className={inputCls}
              placeholder="Opcional"
              {...register('telefono')}
            />
          </label>

          <label className={labelCls}>
            Nº de local
            <input
              type="text"
              maxLength={50}
              className={inputCls}
              placeholder="Opcional"
              {...register('numero_local')}
            />
          </label>
        </div>

        <label className={labelCls}>
          Tipo de cliente
          <select className={inputCls} {...register('tipo')}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {crear.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {crear.error instanceof Error ? crear.error.message : 'No se pudo registrar el cliente'}
          </p>
        )}
        {crear.data?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {crear.data.error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={btnPrimary} disabled={crear.isPending}>
            {crear.isPending ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}