import type { Dispatch, SetStateAction } from 'react'
import type { FiltroDia, RecursosDespacho } from './despachos.types'
import InputFecha from '../../../components/InputFecha'

const OPCIONES_DIA: Array<[FiltroDia, string]> = [
  ['hoy', 'Hoy'],
  ['ayer', 'Ayer'],
  ['7d', '7 días'],
  ['todo', 'Todo'],
]

interface Props {
  esAdmin: boolean
  diaFiltro: FiltroDia
  fechaSeleccionada: string
  vendedorFiltro: string
  vendedores: RecursosDespacho['vendedores']
  setDiaFiltro: Dispatch<SetStateAction<FiltroDia>>
  setFechaSeleccionada: (valor: string) => void
  setVendedorFiltro: (valor: string) => void
  setDespachoExpandido: (valor: string | null) => void
}

export default function FiltrosHistorialDespachos({ esAdmin, diaFiltro, fechaSeleccionada, vendedorFiltro,
  vendedores, setDiaFiltro, setFechaSeleccionada, setVendedorFiltro, setDespachoExpandido }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {OPCIONES_DIA.filter(([valor]) => esAdmin || valor === 'hoy').map(
          ([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              className={
                diaFiltro === valor
                  ? 'min-h-11 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white'
                  : 'min-h-11 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400'
              }
              onClick={() => {
                setDiaFiltro(valor)
                setFechaSeleccionada('')
                setDespachoExpandido(null)
              }}
            >
              {etiqueta}
            </button>
          ),
        )}
        {esAdmin && (
          <InputFecha
            aria-label="Fecha"
            etiquetaCalendario="Abrir calendario"
            className="min-h-11 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
            value={fechaSeleccionada}
            onChange={(e) => {
              setFechaSeleccionada(e.target.value)
              setDiaFiltro(e.target.value === '' ? 'hoy' : 'fecha')
              setDespachoExpandido(null)
            }}
          />
        )}
      </div>

      <select
        aria-label="Filtrar por vendedor"
        className="min-h-11 min-w-0 max-w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
        value={vendedorFiltro}
        onChange={(e) => {
          setVendedorFiltro(e.target.value)
          setDespachoExpandido(null)
        }}
      >
        <option value="">Todos los vendedores</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombres} {v.apellidos}
          </option>
        ))}
      </select>
    </div>

  )
}
