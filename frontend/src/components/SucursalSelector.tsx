import { useQuery } from '@tanstack/react-query'
import { obtenerSucursales } from '../lib/catalog'
import { btnSecondary, inputCls, labelCls } from '../lib/ui'

interface Props {
  value: string
  onChange: (sucursalId: string) => void
  disabled?: boolean
}

export default function SucursalSelector({ value, onChange, disabled = false }: Props) {
  const sucursales = useQuery({ queryKey: ['sucursales'], queryFn: obtenerSucursales })
  return <div className="space-y-2">
    <label className={labelCls}>Sucursal
      <select className={inputCls} value={value} disabled={disabled || sucursales.isLoading || !!sucursales.error}
        onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecciona una sucursal...</option>
        {sucursales.data?.map((sucursal) => <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>)}
      </select>
    </label>
    {sucursales.isLoading && <p role="status" className="text-sm text-slate-600">Cargando sucursales...</p>}
    {sucursales.error ? <div role="alert" className="text-sm text-red-700">
      No fue posible cargar las sucursales. Inténtalo de nuevo.
      <button type="button" className={btnSecondary} onClick={() => void sucursales.refetch()}>Reintentar sucursales</button>
    </div> : sucursales.isSuccess && sucursales.data.length === 0 && <p className="text-sm text-slate-600">No hay sucursales activas.</p>}
  </div>
}
