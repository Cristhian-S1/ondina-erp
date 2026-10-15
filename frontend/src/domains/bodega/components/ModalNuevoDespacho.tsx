import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Dialog from '../../../components/Dialog'
import InputNumerico from '../../../components/InputNumerico'
import { useAuth } from '../../../context/auth-context'
import { crearDespacho } from '../api'
import { btnPrimary, btnSecondary, inputCls, labelCls } from '../../../lib/ui'
import { formatMiles, parseMiles } from '../../../lib/format'
import LineaDespacho from './LineaDespacho'
import type { RecursosDespacho } from './despachos.types'

interface LineaProducto {
  id: string
  producto_id: string
  cantidad: string
}

function nuevaLinea(): LineaProducto {
  return { id: crypto.randomUUID(), producto_id: '', cantidad: '' }
}

const CAPACIDAD_BANDEJA = 10

interface Props {
  open: boolean
  sucursalId: string
  recursos: RecursosDespacho | undefined
  errorLectura: boolean
  setOcupado: (valor: boolean) => void
  onClose: () => void
  onRegistrado: () => Promise<void>
  onActualizar: () => Promise<void>
}

export default function ModalNuevoDespacho({ open, sucursalId, recursos, errorLectura, setOcupado, onClose, onRegistrado, onActualizar }: Props) {
  const { perfil } = useAuth()
  const { vendedores = [], productos = [], tiposEmpaque = [], stockEnvases = [], cargaVendedor = [], stockBodega = [] } = recursos ?? {}
  const productosActivos = productos.filter(producto => producto.activo)
  const [vendedorId, setVendedorId] = useState('')
  const [lineas, setLineas] = useState<LineaProducto[]>(() => [nuevaLinea()])
  // Bandejas: valor manual del usuario junto al total de hielo con que se
  // escribió. Si el hielo cambia, manda el auto-cálculo (1 cada CAPACIDAD_BANDEJA).
  const [bandejasManual, setBandejasManual] = useState<{ hielo: number; valor: string } | null>(
    null,
  )
  const [enviando, actualizarEnviando] = useState(false)
  function setEnviando(valor: boolean) {
    actualizarEnviando(valor)
    setOcupado(valor)
  }
  const intento = useRef<{ contenido: string; clave: string } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [campoError, setCampoError] = useState({ id: '', intento: 0 })
  function informarError(mensaje: string, id: string) {
    setError(mensaje)
    setCampoError(prev => ({ id, intento: prev.intento + 1 }))
  }
  function atributosError(id: string) {
    return { id, 'aria-invalid': !!error && campoError.id === id || undefined, 'aria-describedby': error && campoError.id === id ? 'error-despacho' : undefined }
  }
  useLayoutEffect(() => {
    if (error) document.getElementById(campoError.id)?.focus()
  }, [error, campoError])
  useEffect(() => {
    if (open) document.getElementById('despacho-vendedor')?.focus()
  }, [open])

  const bandejaTipo = useMemo(
    () => tiposEmpaque.find((t) => t.categoria === 'uso_interno') ?? null,
    [tiposEmpaque],
  )

  const totalHieloSolicitado = useMemo(
    () =>
      lineas.reduce((sum, l) => {
        if (!l.producto_id || parseMiles(l.cantidad) <= 0) return sum
        const productoLinea = productos.find((p) => p.id === l.producto_id)
        return productoLinea?.tipo === 'hielo' ? sum + parseMiles(l.cantidad) : sum
      }, 0),
    [lineas, productos],
  )

  const bandejasSugeridas = Math.ceil(totalHieloSolicitado / CAPACIDAD_BANDEJA)
  const bandejasAuto = totalHieloSolicitado > 0 ? String(bandejasSugeridas) : ''
  const bandejasCantidad =
    bandejasManual && bandejasManual.hielo === totalHieloSolicitado
      ? bandejasManual.valor
      : bandejasAuto

  const motivoLimite = productosActivos.length === 0 ? 'No hay productos activos en el catálogo.'
    : lineas.length >= productosActivos.length ? `Máximo ${productosActivos.length} productos por despacho: ya alcanzaste el número de productos activos del catálogo.`
    : undefined
  const disponibleBandejas = stockEnvases.find(item => item.tipo_empaque_id === bandejaTipo?.id)?.cantidad ?? 0
  const errorBandejas = parseMiles(bandejasCantidad) > disponibleBandejas
    ? `Excede el stock de bandejas: disponibles ${formatMiles(disponibleBandejas)}.` : undefined

  async function registrarDespacho() {
    if (!perfil) return
    setError(null)
    setCampoError(prev => ({ ...prev, id: '' }))

    if (!sucursalId) {
      setError('Selecciona una sucursal para registrar el despacho.')
      return
    }

    if (lineas.length > productosActivos.length) {
      setError(`El catálogo tiene ${productosActivos.length} productos activos. Quita las líneas adicionales.`)
      return
    }

    const lineasValidas = lineas.filter((l) => l.producto_id && parseMiles(l.cantidad) > 0)
    if (!vendedorId || lineasValidas.length === 0) {
      informarError('Selecciona un vendedor y agrega al menos un producto.', !vendedorId ? 'despacho-vendedor' : lineas[0]?.producto_id ? `despacho-cantidad-${lineas[0].id}` : `despacho-producto-${lineas[0]?.id}`)
      return
    }

    const solicitadoPorProducto = new Map<string, number>()
    for (const l of lineasValidas) {
      const actual = solicitadoPorProducto.get(l.producto_id) ?? 0
      solicitadoPorProducto.set(l.producto_id, actual + parseMiles(l.cantidad))
    }
    for (const [productoId, solicitado] of solicitadoPorProducto) {
      const disponible = stockBodega.find((s) => s.producto_id === productoId)?.cantidad ?? 0
      if (solicitado > disponible) {
        const producto = productos.find((p) => p.id === productoId)
        informarError(
          `Stock insuficiente en bodega para ${producto?.nombre ?? 'el producto'}: ` +
            `disponible ${formatMiles(disponible)}, solicitado ${formatMiles(solicitado)}.`,
          `despacho-cantidad-${lineas.find(item => item.producto_id === productoId)?.id}`,
        )
        return
      }
    }

    const bandejas = parseMiles(bandejasCantidad)
    const envasesValidos =
      bandejaTipo && bandejas > 0 ? [{ tipo_empaque_id: bandejaTipo.id, cantidad: bandejas }] : []
    for (const l of envasesValidos) {
      const disponible = stockEnvases.find((s) => s.tipo_empaque_id === l.tipo_empaque_id)?.cantidad ?? 0
      if (l.cantidad > disponible) {
        informarError(
          `Stock insuficiente de envases para ${bandejaTipo?.nombre ?? 'el envase'}: ` +
            `disponible ${formatMiles(disponible)}, solicitado ${formatMiles(l.cantidad)}.`,
          'despacho-bandejas',
        )
        return
      }
    }

    setEnviando(true)
    const payload = {
      sucursal_id: sucursalId,
      vendedor_id: vendedorId,
      despachador_id: perfil.id,
      creado_por: perfil.id,
      lineas: lineasValidas.map((l) => ({
        producto_id: l.producto_id,
        cantidad: parseMiles(l.cantidad),
      })),
      envases: envasesValidos.map((l) => ({
        tipo_empaque_id: l.tipo_empaque_id,
        cantidad: parseMiles(String(l.cantidad)),
      })),
    }
    const contenido = JSON.stringify(payload)
    if (intento.current?.contenido !== contenido) {
      intento.current = { contenido, clave: crypto.randomUUID() }
    }
    const { error: err } = await crearDespacho({ ...payload, idempotency_key: intento.current.clave })

    if (err) {
      setError(err)
      setEnviando(false)
      return
    }

    intento.current = null
    setEnviando(false)
    onClose()
    setVendedorId('')
    setLineas([nuevaLinea()])
    setBandejasManual(null)
    await onRegistrado()
  }

  const stockDisponible = (productoId: string) =>
    stockBodega.find((s) => s.producto_id === productoId)?.cantidad ?? 0

  const cargaDelVendedor = (productoId: string) =>
    cargaVendedor.find(
      (c) => c.vendedor_id === vendedorId && c.producto_id === productoId,
    )?.cantidad ?? 0

  const cargaVendedorSeleccionado = cargaVendedor.filter((c) => c.vendedor_id === vendedorId)


  return (
    <Dialog open={open} onClose={() => { if (!enviando) { setError(null); onClose() } }} title="Nuevo despacho">
      {errorLectura && (<div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No fue posible actualizar. Se conservan los últimos datos disponibles. <button type="button" className={btnSecondary} onClick={() => void onActualizar()}>Reintentar</button></div>)}
      {error && <p id="error-despacho" role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <label className={labelCls}>
        Vendedor
        <select
          className={inputCls}
          value={vendedorId}
          {...atributosError('despacho-vendedor')}
          onChange={(e) => { setError(null); setVendedorId(e.target.value) }}
        >
          <option value="">Selecciona un vendedor...</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombres} {v.apellidos}
            </option>
          ))}
        </select>
      </label>

      {vendedorId && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Carga actual del vendedor
          </p>
          {cargaVendedorSeleccionado.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">Sin carga registrada.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {cargaVendedorSeleccionado.map((c) => (
                <li
                  key={c.producto_id}
                  className="flex items-center justify-between text-sm text-slate-700"
                >
                  <span>
                    {productos.find((p) => p.id === c.producto_id)?.nombre ?? 'Producto'}
                  </span>
                  <span className="font-semibold text-slate-900">{formatMiles(c.cantidad)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Productos del despacho</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'}
          </span>
        </div>
        <ul className="space-y-3">
          {lineas.map((linea, index) => {
            const solicitado = lineas.filter(item => item.producto_id === linea.producto_id)
              .reduce((total, item) => total + parseMiles(item.cantidad), 0)
            const errorCantidad = linea.producto_id && solicitado > stockDisponible(linea.producto_id)
              ? `Excede el stock en bodega: disponibles ${formatMiles(stockDisponible(linea.producto_id))}.` : undefined
            return <LineaDespacho key={linea.id} indice={index} lineaId={linea.id}
              productoId={linea.producto_id} cantidad={linea.cantidad} productos={productosActivos}
              productosEnOtrasLineas={lineas.filter((item, i) => i !== index && item.producto_id).map(item => item.producto_id)}
              disponible={stockDisponible}
              cargaVendedor={vendedorId && linea.producto_id ? cargaDelVendedor(linea.producto_id) : undefined}
              errorCantidad={errorCantidad}
              atributosProducto={atributosError(`despacho-producto-${linea.id}`)}
              atributosCantidad={atributosError(`despacho-cantidad-${linea.id}`)}
              onProducto={productoId => {
                setError(null)
                setLineas(prev => prev.map(item => item.id === linea.id ? { ...item, producto_id: productoId } : item))
              }}
              onCantidad={valor => {
                setError(null)
                setLineas(prev => prev.map(item => item.id === linea.id ? { ...item, cantidad: valor === undefined ? '' : String(valor) } : item))
              }}
              onQuitar={() => setLineas(prev => prev.filter(item => item.id !== linea.id))} />
          })}
        </ul>
        <button type="button" className={`${btnSecondary} w-full sm:w-auto`} disabled={!!motivoLimite}
          aria-describedby={motivoLimite ? 'limite-productos-despacho' : undefined}
          onClick={() => setLineas(prev => prev.length < productosActivos.length ? [...prev, nuevaLinea()] : prev)}>
          + Agregar producto
        </button>
        {motivoLimite && <p id="limite-productos-despacho" className="text-xs text-slate-600">{motivoLimite}</p>}
      </div>

      <div className="space-y-2 rounded-xl border border-slate-300 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-800">Bandejas del despacho</h3>
        {!bandejaTipo ? (
          <p className="text-sm text-slate-600">No hay tipos de envase configurados.</p>
        ) : (
          <>
            <div className="max-w-[10rem]">
              <label htmlFor="despacho-bandejas" className={labelCls}>Bandejas</label>
              <InputNumerico {...atributosError('despacho-bandejas')} value={bandejasCantidad} error={errorBandejas}
                onChange={valor => {
                  setError(null)
                  setBandejasManual({ hielo: totalHieloSolicitado, valor: valor === undefined ? '' : String(valor) })
                }} />
            </div>
            <p className="text-xs text-slate-600">
              Se completan solas: 1 bandeja cada {CAPACIDAD_BANDEJA} bolsas de hielo.
            </p>
            {totalHieloSolicitado > 0 && parseMiles(bandejasCantidad) !== bandejasSugeridas && (
              <p className="text-xs text-amber-800">Sugerido: {formatMiles(bandejasSugeridas)}</p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          className={btnSecondary}
          onClick={() => { if (!enviando) { setError(null); onClose() } }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={enviando}
          onClick={() => void registrarDespacho()}
        >
          {enviando ? 'Registrando...' : 'Registrar despacho'}
        </button>
      </div>
    </Dialog>
  )
}
