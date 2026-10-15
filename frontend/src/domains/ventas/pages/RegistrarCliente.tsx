import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import CampoFormulario from '../../../components/CampoFormulario'
import EstadoVista from '../../../components/EstadoVista'
import Dialog from '../../../components/Dialog'
import SucursalSelector from '../../../components/SucursalSelector'
import { useCrearCliente } from '../hooks/useCrearCliente'
import { useVendedoresSucursal } from '../hooks/useVendedoresSucursal'
import { useAuth } from '../../../context/auth-context'
import { crearClienteSchema, type CrearClienteForm, type CrearClienteInput } from '../schemas'
import { btnPrimary, btnSecondary } from '../../../lib/ui'
import { mensajeErrorSupabase } from '../../../lib/errors'
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
  sucursalId?: string
  vendedorId?: string
  onCreated?: (vendedorId: string) => void
}

export default function RegistrarCliente({ open, onClose, sucursalId: sucursalExterna, vendedorId, onCreated }: Props) {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'
  const [sucursalLocal, setSucursalLocal] = useState('')
  const sucursalId = sucursalExterna ?? sucursalLocal
  const vendedores = useVendedoresSucursal(sucursalId)
  const crear = useCrearCliente(sucursalId)
  const { toast, mostrar, cerrar } = useToast()
  const { reset: resetCreacion } = crear
  const registrado = crear.isSuccess && !crear.data?.error
  const envio = useRef(false)
  const cierreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (cierreTimer.current) clearTimeout(cierreTimer.current) }, [open])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<CrearClienteForm, unknown, CrearClienteInput>({
    resolver: zodResolver(crearClienteSchema),
    defaultValues: {
      nombre: '',
      direccion: '',
      telefono: '',
      numero_local: '',
      tipo: 'minorista',
      vendedor_id: esAdmin ? vendedorId ?? '' : perfil?.id ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      envio.current = false
      resetCreacion()
      reset({
        nombre: '',
        direccion: '',
        telefono: '',
        numero_local: '',
        tipo: 'minorista',
        vendedor_id: esAdmin ? vendedorId ?? '' : perfil?.id ?? '',
      })
    }
  }, [open, reset, resetCreacion, perfil, esAdmin, vendedorId])

  const vendedorElegido = useWatch({ control, name: 'vendedor_id' })
  const seleccionValida = !esAdmin || (!!sucursalId && !!vendedores.data?.some((v) => v.id === vendedorElegido))

  if (!open) return null

  function onSubmit(values: CrearClienteInput) {
    if (!seleccionValida || envio.current) return
    envio.current = true
    crear.mutate(values, {
      onSuccess: (res) => {
        if (res.error) {
          envio.current = false
          mostrar(res.error, 'error')
          return
        }
        onCreated?.(values.vendedor_id)
        mostrar('Cliente registrado.', 'exito')
        cierreTimer.current = setTimeout(onClose, 1500)
      },
      onError: (err) => {
        envio.current = false
        mostrar(mensajeErrorSupabase(err), 'error')
      },
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nuevo cliente">
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="space-y-4"
        noValidate
      >
        {esAdmin && sucursalExterna === undefined && <SucursalSelector value={sucursalId} onChange={(id) => { setSucursalLocal(id); setValue('vendedor_id', '') }} disabled={crear.isPending} />}
        {esAdmin && !sucursalId && <p className="text-sm text-slate-600">Selecciona una sucursal y un vendedor para registrar el cliente.</p>}
        {esAdmin && <>
          <CampoFormulario etiqueta="Vendedor responsable" error={errors.vendedor_id?.message}>
            {atributos => <select {...atributos} disabled={!sucursalId || vendedores.isLoading || !!vendedores.error || crear.isPending} {...register('vendedor_id')}>
              <option value="">Selecciona un vendedor...</option>
              {vendedores.data?.map(v => <option key={v.id} value={v.id}>{v.nombres} {v.apellidos}</option>)}
            </select>}
          </CampoFormulario>
          {vendedores.isLoading && <EstadoVista variante="cargando" mensaje="Cargando vendedores..." />}
          {sucursalId && vendedores.isSuccess && vendedores.data.length === 0 && <EstadoVista variante="vacio" mensaje="No hay vendedores activos en esta sucursal." />}
          {vendedores.error && <EstadoVista variante="error" mensaje="No fue posible cargar los vendedores. Inténtalo de nuevo." onReintentar={() => void vendedores.refetch()} />}
        </>}
        <CampoFormulario etiqueta="Nombre" error={errors.nombre?.message}>
          {atributos => <input {...atributos} type="text" autoCapitalize="words" maxLength={120} placeholder="Nombre o razón comercial" {...register('nombre')} />}
        </CampoFormulario>
        <CampoFormulario etiqueta="Dirección" error={errors.direccion?.message}>
          {atributos => <input {...atributos} type="text" maxLength={200} placeholder="Calle, número, comuna" {...register('direccion')} />}
        </CampoFormulario>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoFormulario etiqueta="Teléfono" error={errors.telefono?.message}>
            {atributos => <input {...atributos} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="Opcional" {...register('telefono')} />}
          </CampoFormulario>
          <CampoFormulario etiqueta="Nº de local" error={errors.numero_local?.message}>
            {atributos => <input {...atributos} type="text" maxLength={50} placeholder="Opcional" {...register('numero_local')} />}
          </CampoFormulario>
        </div>
        <CampoFormulario etiqueta="Tipo de cliente" error={errors.tipo?.message}>
          {atributos => <select {...atributos} {...register('tipo')}>{TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>}
        </CampoFormulario>

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={btnPrimary} disabled={registrado || crear.isPending || !seleccionValida || (esAdmin && !!vendedores.error)}>
            {crear.isPending ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </div>
      </form>
      <Toast toast={toast} onClose={cerrar} />
    </Dialog>
  )
}
