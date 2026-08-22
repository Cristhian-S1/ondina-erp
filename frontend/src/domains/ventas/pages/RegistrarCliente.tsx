import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCrearCliente } from '../hooks/useCrearCliente'
import { useVendedoresSucursal } from '../hooks/useVendedoresSucursal'
import { useAuth } from '../../../context/auth-context'
import { crearClienteSchema, type CrearClienteForm, type CrearClienteInput } from '../schemas'
import { btnPrimary, btnSecondary, errorTextCls, inputCls, labelCls } from '../../../lib/ui'
import { Toast } from '../../../components/Toast'
import { useToast } from '../../../components/toast-utils'

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
  const { toast, mostrar, cerrar } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CrearClienteForm, unknown, CrearClienteInput>({
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
        if (res.error) {
          mostrar(res.error, 'error')
          return
        }
        mostrar('Cliente registrado.', 'exito')
        setTimeout(onClose, 1500)
      },
      onError: (err) => {
        mostrar(err instanceof Error ? err.message : 'No se pudo registrar el cliente', 'error')
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
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
              <span className={errorTextCls}>
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
            <span className={errorTextCls}>{errors.nombre.message}</span>
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
            <span className={errorTextCls}>{errors.direccion.message}</span>
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

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={btnPrimary} disabled={crear.isPending}>
            {crear.isPending ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </div>
      </form>
      <Toast toast={toast} onClose={cerrar} />
    </div>
  )
}