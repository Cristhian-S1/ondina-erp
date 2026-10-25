import { useRef, useState } from 'react'
import Dialog from '../../../components/Dialog'
import { ajustarDespacho } from '../api'
import type { ResultadoAjusteDespacho } from '../api'
import { btnPrimary, btnSecondary, errorBlockCls } from '../../../lib/ui'
import { fmtFechaHora } from '../../../lib/format'
import { ajusteDespachoSchema } from '../validacion'
import { useVentanaAjuste } from '../hooks/useVentanaAjuste'
import { formatearRestante } from '../ventanaAjuste'
import LineaDespacho from './LineaDespacho'
import type { RecursosDespacho } from './despachos.types'

interface LineaAjuste {
  id: string
  producto_id: string
  cantidad: string
}

function nuevaLinea(): LineaAjuste {
  return { id: crypto.randomUUID(), producto_id: '', cantidad: '' }
}

export interface DespachoAjustable {
  id: string
  creado_en: string
  vendedorNombre: string
}

interface Props {
  despacho: DespachoAjustable | null
  expiraEn?: string
  recursos: RecursosDespacho | undefined
  setOcupado: (valor: boolean) => void
  onClose: () => void
  onAjustado: (resultado: ResultadoAjusteDespacho | null) => Promise<void>
}

// Vive solo mientras el diálogo tiene un despacho, así el reloj parte fresco en cada apertura.
function PistaVentana({ creadoEn, expiraEn }: { creadoEn: string; expiraEn?: string }) {
  const { restanteMs, abierta, ventana } = useVentanaAjuste(creadoEn, expiraEn)
  return (
    <p className="text-xs text-slate-600">
      {abierta ? `Quedan ${formatearRestante(restanteMs)} de la ventana de ajuste${ventana ? ` de ${ventana.minutos} min` : expiraEn ? '' : ' (aprox.)'}.`
        : 'La ventana de ajuste parece cerrada; la base de datos confirma al guardar.'}
    </p>
  )
}

type ErroresLinea = Record<string, { producto?: string; cantidad?: string }>

// HU-26: formulario solo de suma. Reutiliza LineaDespacho; no hay líneas existentes que editar ni quitar.
export default function ModalAjusteDespacho({ despacho, expiraEn, recursos, setOcupado, onClose, onAjustado }: Props) {
  const { productos = [], stockBodega = [] } = recursos ?? {}
  const productosActivos = productos.filter(producto => producto.activo)
  const [lineas, setLineas] = useState<LineaAjuste[]>(() => [nuevaLinea()])
  const [despachoBorrador, setDespachoBorrador] = useState(despacho?.id ?? null)
  const [enviando, actualizarEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [erroresLinea, setErroresLinea] = useState<ErroresLinea>({})
  // Una clave por intento: un reintento del mismo contenido la reutiliza (HU-26, mismo patrón que crear_despacho).
  const intento = useRef<{ contenido: string; clave: string } | null>(null)

  // Un borrador pertenece a un despacho: al abrir otro se empieza limpio.
  if (despacho && despacho.id !== despachoBorrador) {
    setDespachoBorrador(despacho.id)
    setLineas([nuevaLinea()])
    setError(null)
    setErroresLinea({})
  }

  function setEnviando(valor: boolean) {
    actualizarEnviando(valor)
    setOcupado(valor)
  }
  function cerrar() {
    if (enviando) return
    setError(null)
    setErroresLinea({})
    onClose()
  }
  function limpiarErrores() {
    setError(null)
    setErroresLinea({})
  }
  const stockDisponible = (productoId: string) =>
    stockBodega.find(s => s.producto_id === productoId)?.cantidad ?? 0
  const motivoLimite = productosActivos.length === 0 ? 'No hay productos activos en el catálogo.'
    : lineas.length >= productosActivos.length ? `Máximo ${productosActivos.length} productos por ajuste: ya alcanzaste el número de productos activos del catálogo.`
    : undefined

  async function confirmar() {
    if (!despacho) return
    limpiarErrores()
    const validado = ajusteDespachoSchema.safeParse({
      lineas: lineas.map(({ producto_id, cantidad }) => ({ producto_id, cantidad })),
    })
    if (!validado.success) {
      const porLinea: ErroresLinea = {}
      let general: string | null = null
      for (const problema of validado.error.issues) {
        const [, indice, campo] = problema.path
        const linea = typeof indice === 'number' ? lineas[indice] : undefined
        if (!linea) { general ??= problema.message; continue }
        const actual = porLinea[linea.id] ?? {}
        if (campo === 'producto_id') actual.producto ??= problema.message
        else actual.cantidad ??= problema.message
        porLinea[linea.id] = actual
      }
      setErroresLinea(porLinea)
      setError(general)
      return
    }

    const payload = validado.data.lineas
    const contenido = JSON.stringify({ despachoId: despacho.id, payload })
    if (intento.current?.contenido !== contenido) {
      intento.current = { contenido, clave: crypto.randomUUID() }
    }
    setEnviando(true)
    const { error: err, resultado } = await ajustarDespacho(despacho.id, payload, intento.current.clave)
    if (err) {
      setError(err)
      setEnviando(false)
      return
    }
    intento.current = null
    setEnviando(false)
    setLineas([nuevaLinea()])
    onClose()
    await onAjustado(resultado)
  }

  return (
    <Dialog open={!!despacho} onClose={cerrar} title="Agregar productos al despacho"
      description="Solo se suman productos; lo ya registrado no se modifica.">
      {despacho && <>
        {despacho && (
          <p className="text-sm text-slate-700">
            {despacho.vendedorNombre} · {fmtFechaHora(despacho.creado_en)} · Despacho #{despacho.id.slice(0, 8)}
          </p>
        )}
        {despacho && <PistaVentana creadoEn={despacho.creado_en} expiraEn={expiraEn} />}
        {error && <p role="alert" className={errorBlockCls}>{error}</p>}
        <ul className="space-y-3">
          {lineas.map((linea, indice) => {
            const errores = erroresLinea[linea.id]
            return <LineaDespacho key={linea.id} indice={indice} lineaId={linea.id}
              productoId={linea.producto_id} cantidad={linea.cantidad} productos={productosActivos}
              productosEnOtrasLineas={lineas.filter((item, i) => i !== indice && item.producto_id).map(item => item.producto_id)}
              disponible={stockDisponible}
              errorProducto={errores?.producto} errorCantidad={errores?.cantidad}
              atributosProducto={{ id: `ajuste-producto-${linea.id}`, 'aria-invalid': !!errores?.producto }}
              atributosCantidad={{ id: `ajuste-cantidad-${linea.id}`, 'aria-invalid': !!errores?.cantidad }}
              onProducto={productoId => {
                limpiarErrores()
                setLineas(prev => prev.map(item => item.id === linea.id ? { ...item, producto_id: productoId } : item))
              }}
              onCantidad={valor => {
                limpiarErrores()
                setLineas(prev => prev.map(item => item.id === linea.id ? { ...item, cantidad: valor === undefined ? '' : String(valor) } : item))
              }}
              onQuitar={() => { limpiarErrores(); setLineas(prev => prev.length > 1 ? prev.filter(item => item.id !== linea.id) : [nuevaLinea()]) }} />
          })}
        </ul>
        <button type="button" className={`${btnSecondary} w-full sm:w-auto`} disabled={!!motivoLimite || enviando}
          aria-describedby={motivoLimite ? 'limite-productos-ajuste' : undefined}
          onClick={() => setLineas(prev => prev.length < productosActivos.length ? [...prev, nuevaLinea()] : prev)}>
          + Agregar producto
        </button>
        {motivoLimite && <p id="limite-productos-ajuste" className="text-xs text-slate-600">{motivoLimite}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className={btnSecondary} onClick={cerrar}>Cancelar</button>
          <button type="button" className={btnPrimary} disabled={enviando} onClick={() => void confirmar()}>
            {enviando ? 'Agregando...' : 'Agregar al despacho'}
          </button>
        </div>
      </>}
    </Dialog>
  )
}
