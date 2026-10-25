import { useRef, useState } from 'react'
import CampoFormulario from '../../../components/CampoFormulario'
import InputNumerico from '../../../components/InputNumerico'
import { fmtFechaHora } from '../../../lib/format'
import { btnPrimary, cardCls, errorBlockCls, errorTextCls } from '../../../lib/ui'
import { registrarMermaBodega } from '../api'
import type { NuevaMerma } from '../api'
import type { DespachoDelDia } from '../hooks/useMermas'
import type { OrigenMerma } from '../types'
import { mermaSchema } from '../validacion'
import { etiquetaVendedorHistorial } from '../vendedores'
import type { RecursosDespacho } from './despachos.types'

type Errores = Partial<Record<'origen' | 'despacho_id' | 'producto_id' | 'tipo_empaque_id' | 'cantidad' | 'motivo', string>>
type ItemBodega = 'producto' | 'envase'

interface Props {
  sucursalId: string
  recursos: RecursosDespacho
  despachosDelDia: DespachoDelDia[]
  errorDespachos: boolean
  setOcupado: (ocupado: boolean) => void
  onRegistrada: () => Promise<void>
}

function etiquetaDespacho({ despacho }: DespachoDelDia, recursos: RecursosDespacho) {
  const vendedor = recursos.vendedoresHistorial.find(v => v.id === despacho.vendedor_id)
  return `${vendedor ? etiquetaVendedorHistorial(vendedor) : 'Vendedor no disponible'} · ${fmtFechaHora(despacho.creado_en).split(' ')[1]} · #${despacho.id.slice(0, 8)}`
}

// HU-29: registra una merma de bodega (producto o envase vacío) o de un despacho del día (solo producto).
// El saldo, la carga y la auditoría los resuelve la base de datos; aquí no se calcula stock.
export default function FormularioMerma({ sucursalId, recursos, despachosDelDia, errorDespachos, setOcupado, onRegistrada }: Props) {
  const [origen, setOrigen] = useState<OrigenMerma>('bodega')
  const [itemBodega, setItemBodega] = useState<ItemBodega>('producto')
  const [despachoId, setDespachoId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [tipoEmpaqueId, setTipoEmpaqueId] = useState('')
  const [cantidad, setCantidad] = useState<number | undefined>(undefined)
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [enviando, setEnviandoEstado] = useState(false)
  // Guarda síncrona: dos clics antes del re-render no deben enviar dos solicitudes.
  const enCurso = useRef(false)
  // Un intento = una clave. Un reintento con el mismo contenido la reutiliza; otro contenido, una nueva.
  const intento = useRef<{ contenido: string; clave: string } | null>(null)

  const productosActivos = recursos.productos.filter(p => p.activo)
  const despachoElegido = despachosDelDia.find(d => d.despacho.id === despachoId)
  const idsProductoDespacho = [...new Set(despachoElegido?.detalles.map(d => d.producto_id) ?? [])]
  const productosDespacho = idsProductoDespacho.map(id => ({ id, nombre: recursos.productos.find(p => p.id === id)?.nombre ?? 'Producto no disponible' }))

  function editar(cambio: () => void) {
    cambio()
    setErrores({})
    setError(null)
    setExito(null)
  }
  function cambiarOrigen(valor: OrigenMerma) {
    editar(() => { setOrigen(valor); setDespachoId(''); setProductoId(''); setTipoEmpaqueId('') })
  }
  function cambiarItem(valor: ItemBodega) {
    editar(() => { setItemBodega(valor); setProductoId(''); setTipoEmpaqueId('') })
  }
  function setEnviando(valor: boolean) {
    enCurso.current = valor
    setEnviandoEstado(valor)
    setOcupado(valor)
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (enCurso.current) return
    setError(null)
    setExito(null)
    const validado = mermaSchema.safeParse({
      origen, despacho_id: despachoId, producto_id: productoId, tipo_empaque_id: tipoEmpaqueId,
      cantidad: cantidad ?? '', motivo,
    })
    if (!validado.success) {
      const porCampo: Errores = {}
      for (const problema of validado.error.issues) {
        const campo = problema.path[0] as keyof Errores
        porCampo[campo] ??= problema.message
      }
      setErrores(porCampo)
      return
    }
    setErrores({})
    const merma: NuevaMerma = { sucursal_id: sucursalId, ...validado.data }
    const contenido = JSON.stringify(merma)
    if (intento.current?.contenido !== contenido) intento.current = { contenido, clave: crypto.randomUUID() }
    setEnviando(true)
    const { error: fallo } = await registrarMermaBodega(merma, intento.current.clave)
    if (fallo) {
      // La clave se conserva: reintentar el mismo contenido repite la misma operación, no una nueva.
      setError(fallo)
      setEnviando(false)
      return
    }
    intento.current = null
    setCantidad(undefined)
    setMotivo('')
    setProductoId('')
    setTipoEmpaqueId('')
    setDespachoId('')
    setExito('Merma registrada.')
    setEnviando(false)
    await onRegistrada()
  }

  const itemEsProducto = origen === 'despacho' || itemBodega === 'producto'

  return (
    <form className={`${cardCls} min-w-0 space-y-4 p-5`} onSubmit={event => void enviar(event)} noValidate aria-label="Registrar merma">
      <h2 className="text-base font-semibold text-slate-900">Registrar merma</h2>
      {error && <p role="alert" className={errorBlockCls}>{error}</p>}
      {exito && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{exito}</p>}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <CampoFormulario etiqueta="Origen" error={errores.origen}>
          {atributos => <select {...atributos} value={origen} disabled={enviando} onChange={e => cambiarOrigen(e.target.value as OrigenMerma)}>
            <option value="bodega">Bodega</option>
            <option value="despacho">Despacho del día</option>
          </select>}
        </CampoFormulario>
        {origen === 'bodega' ? (
          <CampoFormulario etiqueta="Qué se perdió">
            {atributos => <select {...atributos} value={itemBodega} disabled={enviando} onChange={e => cambiarItem(e.target.value as ItemBodega)}>
              <option value="producto">Producto</option>
              <option value="envase">Envase vacío</option>
            </select>}
          </CampoFormulario>
        ) : (
          <CampoFormulario etiqueta="Despacho" error={errores.despacho_id}>
            {atributos => <select {...atributos} value={despachoId} disabled={enviando}
              onChange={e => editar(() => { setDespachoId(e.target.value); setProductoId('') })}>
              <option value="">Selecciona un despacho...</option>
              {despachosDelDia.map(d => <option key={d.despacho.id} value={d.despacho.id}>{etiquetaDespacho(d, recursos)}</option>)}
            </select>}
          </CampoFormulario>
        )}
        {origen === 'despacho' && errorDespachos && <p role="alert" className={`${errorTextCls} sm:col-span-2`}>No fue posible cargar los despachos del día.</p>}
        {origen === 'despacho' && !errorDespachos && despachosDelDia.length === 0 && (
          <p className="text-sm text-slate-600 sm:col-span-2">No hay despachos activos hoy para esta sucursal.</p>
        )}
        {itemEsProducto ? (
          <CampoFormulario etiqueta="Producto" error={errores.producto_id ?? errores.tipo_empaque_id}>
            {atributos => <select {...atributos} value={productoId} disabled={enviando || (origen === 'despacho' && !despachoId)}
              onChange={e => editar(() => setProductoId(e.target.value))}>
              <option value="">Selecciona producto...</option>
              {(origen === 'despacho' ? productosDespacho : productosActivos).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>}
          </CampoFormulario>
        ) : (
          <CampoFormulario etiqueta="Tipo de envase" error={errores.tipo_empaque_id ?? errores.producto_id}>
            {atributos => <select {...atributos} value={tipoEmpaqueId} disabled={enviando}
              onChange={e => editar(() => setTipoEmpaqueId(e.target.value))}>
              <option value="">Selecciona envase...</option>
              {recursos.tiposEmpaque.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>}
          </CampoFormulario>
        )}
        <CampoFormulario etiqueta="Cantidad" error={errores.cantidad}>
          {atributos => <InputNumerico {...atributos} value={cantidad} disabled={enviando}
            onChange={valor => editar(() => setCantidad(valor))} />}
        </CampoFormulario>
        <div className="sm:col-span-2">
          <CampoFormulario etiqueta="Motivo" error={errores.motivo}>
            {atributos => <textarea {...atributos} rows={3} value={motivo} disabled={enviando}
              onChange={e => editar(() => setMotivo(e.target.value))} />}
          </CampoFormulario>
        </div>
      </div>
      {origen === 'despacho' && (
        <p className="text-xs text-slate-600">Los envases dañados de un despacho se registran como devolución en estado malo, no como merma.</p>
      )}
      <button type="submit" className={`${btnPrimary} w-full sm:w-auto`} disabled={enviando}>
        {enviando ? 'Registrando...' : 'Registrar merma'}
      </button>
    </form>
  )
}
