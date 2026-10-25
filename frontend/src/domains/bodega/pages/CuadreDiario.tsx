import { useState } from 'react'
import EstadoVista from '../../../components/EstadoVista'
import InputFecha from '../../../components/InputFecha'
import { fmtFecha } from '../../../lib/format'
import { useJornadaSantiago } from '../../../lib/jornada'
import { btnSecondary, cardCls, errorTextCls, inputCls, inputErrorCls, labelCls } from '../../../lib/ui'
import AmbitoBodega from '../components/AmbitoBodega'
import TablaCuadre from '../components/TablaCuadre'
import { useCuadreDiario } from '../hooks/useCuadreDiario'
import { useDatosBodega } from '../hooks/useDatosBodega'
import { MAX_DIAS_CUADRE, rangoCuadreSchema } from '../validacion'
import { etiquetaVendedorHistorial } from '../vendedores'

export default function CuadreDiario() {
  return <AmbitoBodega>{sucursalId => <CuadreSucursal sucursalId={sucursalId} />}</AmbitoBodega>
}

function CuadreSucursal({ sucursalId }: { sucursalId: string }) {
  const jornada = useJornadaSantiago()
  const recursos = useDatosBodega(sucursalId, false)
  // El rango por defecto es la jornada en que se abre la pantalla; después manda lo que elija el usuario.
  const [inicial] = useState(jornada)
  const [desde, setDesde] = useState(inicial)
  const [hasta, setHasta] = useState(inicial)
  const [vendedorId, setVendedorId] = useState('')
  const rango = rangoCuadreSchema(jornada).safeParse({ desde, hasta })
  // Un campo muestra su primer problema (las reglas se emiten en orden de prioridad).
  const errores: Partial<Record<'desde' | 'hasta', string>> = {}
  if (!rango.success) for (const i of rango.error.issues) errores[i.path[0] as 'desde' | 'hasta'] ??= i.message
  const cuadre = useCuadreDiario(sucursalId, desde, hasta, vendedorId, rango.success)

  if (recursos.isError && !recursos.data) {
    return <EstadoVista variante="error" mensaje="No fue posible cargar los datos de bodega. Inténtalo de nuevo." onReintentar={() => void recursos.refetch()} />
  }
  if (!recursos.data) return <EstadoVista variante="cargando" />

  const campoFecha = (id: string, etiqueta: string, valor: string, cambiar: (v: string) => void, error?: string) => (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{etiqueta}</label>
      <InputFecha id={id} etiquetaCalendario={`Abrir calendario de ${etiqueta.toLowerCase()}`} value={valor} max={jornada}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputCls} ${error ? inputErrorCls : ''}`} onChange={e => cambiar(e.target.value)} />
      {error && <p id={`${id}-error`} className={errorTextCls}>{error}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cuadre diario</h1>
        <p className="mt-1 text-sm text-slate-600">
          Movimientos por vendedor, día y producto (máximo {MAX_DIAS_CUADRE} días). Cada movimiento se cuenta en su propio día y las anulaciones reexpresan los días anteriores.
        </p>
      </div>
      <section className={`${cardCls} min-w-0 space-y-4 p-5`} aria-label="Filtros del cuadre">
        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
          {campoFecha('cuadre-desde', 'Desde', desde, setDesde, errores.desde)}
          {campoFecha('cuadre-hasta', 'Hasta', hasta, setHasta, errores.hasta)}
          <div className="min-w-0">
            <label htmlFor="cuadre-vendedor" className={labelCls}>Vendedor</label>
            <select id="cuadre-vendedor" className={inputCls} value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
              <option value="">Todos los vendedores</option>
              {recursos.data.vendedoresHistorial.map(v => <option key={v.id} value={v.id}>{etiquetaVendedorHistorial(v)}</option>)}
            </select>
          </div>
        </div>
      </section>
      <section className={`${cardCls} min-w-0`} aria-label="Resultado del cuadre">
        {!rango.success ? (
          <EstadoVista variante="vacio" mensaje="Corrige el rango de fechas para consultar el cuadre." />
        ) : cuadre.isError ? (
          <EstadoVista variante="error" mensaje={cuadre.error.message} onReintentar={() => void cuadre.refetch()} />
        ) : cuadre.isPending ? (
          <EstadoVista variante="cargando" mensaje="Cargando cuadre..." />
        ) : cuadre.data.length === 0 ? (
          <div role="status"><EstadoVista variante="vacio"
            mensaje={`No hay movimientos entre ${fmtFecha(desde)} y ${fmtFecha(hasta)}${vendedorId ? ' para el vendedor seleccionado' : ''}.`} /></div>
        ) : <>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <p className="text-sm text-slate-600">{cuadre.data.length} {cuadre.data.length === 1 ? 'fila' : 'filas'}</p>
            <button type="button" className={btnSecondary} disabled={cuadre.isFetching} onClick={() => void cuadre.refetch()}>
              {cuadre.isFetching ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
          <TablaCuadre filas={cuadre.data} recursos={recursos.data} />
        </>}
      </section>
    </div>
  )
}
