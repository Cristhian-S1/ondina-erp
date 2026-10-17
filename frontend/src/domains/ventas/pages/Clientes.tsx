import { useState } from 'react'
import { useAuth } from '../../../context/auth-context'
import SucursalSelector from '../../../components/SucursalSelector'
import { useVendedoresSucursal } from '../hooks/useVendedoresSucursal'
import { useCarteraPaginada } from '../hooks/useCarteraPaginada'
import Paginacion from '../../../components/Paginacion'
import EstadoVista from '../../../components/EstadoVista'
import { fmtFecha } from '../../../lib/format'
import { btnPrimary, cardCls, inputCls, labelCls, tdCls, thCls } from '../../../lib/ui'
import { PlusCircleIcon, UsersIcon } from '../../../components/icons'
import RegistrarCliente from './RegistrarCliente'

const TIPO_ETIQUETA: Record<string, string> = {
  mayorista: 'Mayorista',
  minorista: 'Minorista',
  ocasional: 'Ocasional',
}

const TIPO_CLASE: Record<string, string> = {
  mayorista: 'bg-sky-100 text-sky-700',
  minorista: 'bg-brand-50 text-brand-800',
  ocasional: 'bg-slate-100 text-slate-600',
}

export default function Clientes() {
  const { perfil } = useAuth()
  return <ClientesCartera key={`${perfil?.id}:${perfil?.rol}`} />
}

function ClientesCartera() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'administrador'
  const [sucursalId, setSucursalId] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const vendedores = useVendedoresSucursal(sucursalId)
  const consulta = useCarteraPaginada(sucursalId, vendedorId)
  const { data, isLoading, error, refetch } = consulta
  const faltaSeleccion = esAdmin && (!sucursalId || !vendedorId)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-600">
            {esAdmin
              ? 'Cartera de clientes por vendedor: elige sucursal y vendedor.'
              : 'Cartera de clientes de tu ruta.'}
          </p>
        </div>
        <button type="button" className={btnPrimary} disabled={faltaSeleccion || (esAdmin && (!!vendedores.error || vendedores.isLoading))} onClick={() => setModalOpen(true)}>
          <PlusCircleIcon className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      {esAdmin && <div className="grid gap-4 sm:grid-cols-2">
        <SucursalSelector value={sucursalId} onChange={(id) => { setSucursalId(id); setVendedorId(''); setModalOpen(false) }} />
        <div className="space-y-2">
          <label className={labelCls}>Vendedor responsable
            <select className={inputCls} value={vendedorId} disabled={!sucursalId || vendedores.isLoading || !!vendedores.error}
              onChange={(event) => { setVendedorId(event.target.value); setModalOpen(false) }}>
              <option value="">Selecciona un vendedor...</option>
              {vendedores.data?.map((v) => <option key={v.id} value={v.id}>{v.nombres} {v.apellidos}</option>)}
            </select>
          </label>
          {vendedores.isLoading && <p role="status" className="text-sm text-slate-600">Cargando vendedores...</p>}
          {vendedores.error ? <EstadoVista variante="error" mensaje="No fue posible cargar los vendedores." onReintentar={() => void vendedores.refetch()} /> : sucursalId && vendedores.isSuccess && vendedores.data.length === 0 && <p className="text-sm text-slate-600">No hay vendedores activos en esta sucursal.</p>}
        </div>
      </div>}

      {faltaSeleccion ? (
        <EstadoVista variante="vacio" mensaje="Selecciona una sucursal y un vendedor para consultar su cartera." />
      ) : error ? (
        <EstadoVista
          variante="error"
          mensaje="No se pudo cargar la cartera. Revisa tu conexión e inténtalo de nuevo."
          onReintentar={() => void refetch()}
        />
      ) : isLoading ? (
        <EstadoVista variante="cargando" mensaje="Cargando clientes..." />
      ) : !data || data.length === 0 ? (
        <div className={cardCls}>
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <UsersIcon className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm text-slate-600">
              {esAdmin ? 'Este vendedor aún no tiene clientes en su ruta.' : 'No tienes clientes en tu ruta.'}
            </p>
            <button
              type="button"
              className={`${btnPrimary} mt-4`}
              onClick={() => setModalOpen(true)}
            >
              <PlusCircleIcon className="h-4 w-4" />
              {esAdmin ? 'Registrar primer cliente del vendedor' : 'Registrar primer cliente'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <section className={`${cardCls} hidden sm:block`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className={thCls}>Nombre</th>
                    <th className={thCls}>Tipo</th>
                    <th className={thCls}>Dirección</th>
                    <th className={thCls}>Teléfono</th>
                    <th className={thCls}>Registrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td className={tdCls}>
                        <p className="font-medium text-slate-900">{c.nombre}</p>
                        {c.numero_local && (
                          <p className="text-xs text-slate-600">Local {c.numero_local}</p>
                        )}
                      </td>
                      <td className={tdCls}>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            TIPO_CLASE[c.tipo] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {TIPO_ETIQUETA[c.tipo] ?? c.tipo}
                        </span>
                      </td>
                      <td className={tdCls}>{c.direccion}</td>
                      <td className={tdCls}>{c.telefono ?? '—'}</td>
                      <td className={tdCls}>{fmtFecha(c.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Mobile: cards */}
          <ul className="space-y-3 sm:hidden">
            {data.map((c) => (
              <li key={c.id} className={cardCls}>
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="font-medium text-slate-900">{c.nombre}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      TIPO_CLASE[c.tipo] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {TIPO_ETIQUETA[c.tipo] ?? c.tipo}
                  </span>
                </div>
                <dl className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Dirección</dt>
                    <dd className="text-right text-slate-900">{c.direccion}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Teléfono</dt>
                    <dd className="text-right text-slate-900">{c.telefono ?? '—'}</dd>
                  </div>
                  {c.numero_local && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Local</dt>
                      <dd className="text-right text-slate-900">{c.numero_local}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Registrado</dt>
                    <dd className="text-right text-slate-900">{fmtFecha(c.creado_en)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      {!faltaSeleccion && <Paginacion pagina={consulta.pagina} total={consulta.total} onCambiar={consulta.setPagina} cargando={consulta.isFetching} etiqueta="Paginación de clientes" />}
      <RegistrarCliente key={`${sucursalId}:${vendedorId}`} open={modalOpen} onClose={() => setModalOpen(false)} sucursalId={sucursalId} vendedorId={vendedorId} onCreated={setVendedorId} />
    </div>
  )
}