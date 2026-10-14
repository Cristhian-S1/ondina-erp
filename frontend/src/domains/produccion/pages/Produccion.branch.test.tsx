import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { makePerfil, renderWithProviders } from '@/test/render'
import Produccion from './Produccion'
import * as api from '../api'
import { obtenerProductos } from '../../../lib/catalog'

const location = vi.hoisted(() => ({ pathname: '/produccion/registrar' }))
vi.mock('react-router-dom', async (original) => ({ ...await original<typeof import('react-router-dom')>(), useLocation: () => location }))
vi.mock('@/lib/catalog', () => ({
  obtenerProductos: vi.fn().mockResolvedValue([{ id: 'p1', nombre: 'Agua', activo: true }]),
  obtenerTiposEmpaque: vi.fn().mockResolvedValue([]),
  obtenerSucursales: vi.fn().mockResolvedValue([{ id: 's1', nombre: 'Norte' }, { id: 's2', nombre: 'Sur' }]),
}))
vi.mock('../api', () => ({
  obtenerHistorialProduccion: vi.fn().mockResolvedValue([]),
  obtenerIndicadoresProduccion: vi.fn().mockResolvedValue([]),
  registrarIncidencia: vi.fn().mockResolvedValue(null),
  obtenerIncidencias: vi.fn().mockResolvedValue([]),
  obtenerEnvasesDisponibles: vi.fn().mockResolvedValue([]), obtenerMermas: vi.fn().mockResolvedValue([]),
  obtenerProducciones: vi.fn().mockResolvedValue([]), registrarMerma: vi.fn().mockResolvedValue(null), registrarProduccion: vi.fn().mockResolvedValue(null),
  subscribeProduccion: vi.fn(() => vi.fn()),
}))

beforeEach(() => { vi.clearAllMocks(); vi.mocked(obtenerProductos).mockResolvedValue([{ id: 'p1', nombre: 'Agua', activo: true, precio_base: 100 }]); location.pathname = '/produccion/registrar'; vi.mocked(api.obtenerProducciones).mockResolvedValue([]) })

async function selectBranch(id = 's1') {
  await screen.findByRole('option', { name: 'Norte' })
  fireEvent.change(screen.getByRole('combobox', { name: 'Sucursal' }), { target: { value: id } })
}

describe('Producción operational branch', () => {
  it.each([null])('requires an explicit administrator selection with profile branch %s', async (sucursal_id) => {
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id }) })
    expect(await screen.findByRole('combobox', { name: 'Sucursal' })).toHaveValue('')
    expect(screen.getByText(/selecciona una sucursal para trabajar/i)).toBeInTheDocument()
    expect(screen.queryByText('Cargando información...')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar producción' })).not.toBeInTheDocument()
    expect(api.obtenerProducciones).not.toHaveBeenCalled()
    expect(api.subscribeProduccion).not.toHaveBeenCalled()
  })

  it('loads the selected branch and ignores a late previous-branch response', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.obtenerProducciones>>) => void
    vi.mocked(api.obtenerProducciones).mockImplementation((id) => id === 's1' ? new Promise(r => { resolve = r }) : Promise.resolve([]))
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
    await selectBranch()
    expect(api.obtenerProducciones).toHaveBeenCalledWith('s1')
    await selectBranch('s2')
    expect(await screen.findByText('No hay producciones registradas.')).toBeInTheDocument()
    await act(async () => { resolve([{ id: 'old', sucursal_id: 's1', producto_id: 'p1', cantidad: 777, creado_en: '2026-01-01', anulado: false, creado_por: 'u', observaciones: null }]) })
    expect(screen.queryByText('777')).not.toBeInTheDocument()
    expect(api.obtenerProducciones).toHaveBeenCalledWith('s2')
  })

  it('writes to the chosen branch and resets the form when switching', async () => {
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
    await selectBranch()
    fireEvent.change(await screen.findByLabelText('Producto'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar producción' }))
    await screen.findByRole('status')
    expect(api.registrarProduccion).toHaveBeenCalledWith(expect.objectContaining({ sucursal_id: 's1', cantidad: 12 }))
    await selectBranch('s2')
    expect(await screen.findByLabelText('Cantidad')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('FX R2-07 · bloquea el selector hasta notificar el resultado de escritura', async () => {
    let resolve!: (value: string | null) => void
    vi.mocked(api.registrarProduccion).mockReturnValueOnce(new Promise(r => { resolve = r }))
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
    await selectBranch()
    fireEvent.change(await screen.findByLabelText('Producto'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar producción' }))
    await waitFor(() => expect(api.registrarProduccion).toHaveBeenCalledOnce())
    expect(screen.getByLabelText('Sucursal')).toBeDisabled()
    await act(async () => { resolve(null) })
    expect(await screen.findByText(/Producción registrada/)).toBeInTheDocument()
    expect(screen.getByLabelText('Sucursal')).not.toBeDisabled()
    await selectBranch('s2')
    expect(await screen.findByLabelText('Cantidad')).toHaveValue('')
  })

  it('writes mermas to the chosen branch', async () => {
    location.pathname = '/produccion/incidencias'
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
    await selectBranch('s2')
    fireEvent.change(await screen.findByLabelText('Producto'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Envases dañados' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar merma' }))
    await waitFor(() => expect(api.registrarMerma).toHaveBeenCalledWith(expect.objectContaining({ sucursal_id: 's2', cantidad: 2 })))
  })

  it('keeps non-admins in their assigned branch without a selector', async () => {
    renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'produccion', sucursal_id: 's1' }) })
    await screen.findByText('Nueva producción')
    expect(screen.queryByRole('combobox', { name: 'Sucursal' })).not.toBeInTheDocument()
    expect(api.obtenerProducciones).toHaveBeenCalledWith('s1')
  })
})

it('B3 · distinguishes descriptive incidents from quantified losses', async () => {
  location.pathname = '/produccion/incidencias'
  renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'produccion', sucursal_id: 's1' }) })
  fireEvent.change(await screen.findByLabelText('Descripción de la incidencia'), { target: { value: '   Filtro detenido durante el turno   ' } })
  expect(screen.getByRole('button', { name: 'Registrar merma' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Registrar incidencia' }))
  await screen.findByText('Incidencia registrada. Las existencias se mantienen.')
  expect(api.registrarIncidencia).toHaveBeenCalledWith({ sucursal_id: 's1', produccion_id: null, descripcion: 'Filtro detenido durante el turno', creado_por: 'user-1' })
  expect(api.registrarMerma).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'p1' } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Bidones dañados' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar merma' }))
  await screen.findByText('Merma registrada correctamente. Las existencias fueron actualizadas.')
  expect(api.registrarMerma).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 2, producto_id: 'p1', motivo: 'Bidones dañados' }))
})

it.each(['registrar', 'envases', 'historial', 'indicadores', 'incidencias'])('UX-13 · %s tiene título y enlaces de sección incluso antes de seleccionar sucursal', async (seccion) => {
  location.pathname = `/produccion/${seccion}`
  renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: null }) })
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Producción ·')
  const nav = screen.getByRole('navigation', { name: 'Secciones de producción' })
  expect(nav.querySelectorAll('a')).toHaveLength(5)
  const selector = await screen.findByLabelText('Sucursal')
  expect(screen.getByRole('heading', { level: 1 }).compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('UX-12 · éxito de producción utiliza una notificación cerrable', async () => {
  renderWithProviders(<Produccion />)
  await screen.findByRole('option', { name: 'Agua' })
  fireEvent.change(await screen.findByLabelText('Producto'), { target: { value: 'p1' } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '12' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar producción' }))
  await screen.findByText(/Producción registrada/)
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
  expect(screen.queryByText(/Producción registrada/)).not.toBeInTheDocument()
})

it('UX-12 · fallo de mutación conserva los campos y se cierra con Toast', async () => {
  vi.mocked(api.registrarProduccion).mockResolvedValueOnce('No hay envases vacíos suficientes.')
  renderWithProviders(<Produccion />)
  await screen.findByRole('option', { name: 'Agua' })
  fireEvent.change(await screen.findByLabelText('Producto'), { target: { value: 'p1' } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '12' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar producción' }))
  await screen.findAllByRole('alert')
  expect(screen.getByLabelText('Cantidad')).toHaveValue('12')
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('UX-02 · mermas usa una sola fila con etiquetas de tarjeta y fechas de Santiago', async () => {
  location.pathname = '/produccion/incidencias'
  vi.mocked(api.obtenerMermas).mockResolvedValueOnce([{ id: 'm1', sucursal_id: 's1', producto_id: 'p1', tipo_empaque_id: null, despacho_id: null, cantidad: 2, motivo: 'Bidón dañado', anulado: false, creado_por: 'u1', creado_en: '2026-10-13T02:15:59Z' }])
  renderWithProviders(<Produccion />)
  const motivo = await screen.findByText('Bidón dañado')
  const fila = motivo.closest('tr')!
  expect(fila).toHaveTextContent('Fecha')
  expect(fila).toHaveTextContent('Producto')
  expect(fila).toHaveTextContent('Cantidad')
  expect(fila).toHaveTextContent('Motivo')
  expect(fila).toHaveTextContent('12-10-2026 23:15')
  expect(screen.getAllByText('Bidón dañado')).toHaveLength(1)
})


it.each(['historial', 'indicadores'] as const)('A1-07 · %s comienza sin esperar productos ni lecturas de otras secciones', async (seccion) => {
  location.pathname = `/produccion/${seccion}`
  vi.mocked(obtenerProductos).mockReturnValueOnce(new Promise(() => {}))
  renderWithProviders(<Produccion />)
  expect(await screen.findByText(seccion === 'historial' ? 'No hay registros para los filtros seleccionados.' : 'No hay producción en el período.')).toBeInTheDocument()
  expect(screen.getByText('Cargando productos...')).toBeInTheDocument()
  expect(api.obtenerProducciones).not.toHaveBeenCalled()
  expect(api.obtenerMermas).not.toHaveBeenCalled()
  expect(api.obtenerIncidencias).not.toHaveBeenCalled()
})

it.each(['incidencia', 'merma'] as const)('UX-12 · fallo de %s usa Toast y conserva el formulario', async (tipo) => {
  location.pathname = '/produccion/incidencias'
  if (tipo === 'incidencia') vi.mocked(api.registrarIncidencia).mockResolvedValueOnce('No hay stock suficiente.')
  else vi.mocked(api.registrarMerma).mockResolvedValueOnce('No hay stock suficiente.')
  renderWithProviders(<Produccion />)
  await screen.findByRole('option', { name: 'Agua' })
  if (tipo === 'incidencia') fireEvent.change(screen.getByLabelText('Descripción de la incidencia'), { target: { value: 'Filtro detenido' } })
  else {
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Bidón dañado' } })
  }
  fireEvent.click(screen.getByRole('button', { name: tipo === 'incidencia' ? 'Registrar incidencia' : 'Registrar merma' }))
  expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('No hay stock suficiente.')
  expect(screen.getByLabelText(tipo === 'incidencia' ? 'Descripción de la incidencia' : 'Motivo')).toHaveValue(tipo === 'incidencia' ? 'Filtro detenido' : 'Bidón dañado')
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('FX R2-03 · el Toast se cierra automáticamente y la validación persiste', async () => {
  location.pathname = '/produccion/incidencias'
  renderWithProviders(<Produccion />)
  fireEvent.change(await screen.findByLabelText('Descripción de la incidencia'), { target: { value: 'Filtro detenido' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar incidencia' }))
  await screen.findByText('Incidencia registrada. Las existencias se mantienen.')
  vi.useFakeTimers()
  try {
    // Reabrir una notificación crea el temporizador del hook con el reloj simulado.
    fireEvent.change(screen.getByLabelText('Descripción de la incidencia'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar incidencia' }))
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Describe la incidencia')
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.getByRole('alert')).toHaveTextContent('Describe la incidencia')
    expect(screen.getByLabelText('Descripción de la incidencia')).toHaveAttribute('aria-invalid', 'true')
  } finally { vi.useRealTimers() }
})

it('conserva el formulario al consultar otra sección y limpia la notificación anterior', async () => {
  const { rerender } = renderWithProviders(<Produccion />)
  await screen.findByRole('option', { name: 'Agua' })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '12' } })
  fireEvent.change(screen.getByLabelText('Observaciones (opcional)'), { target: { value: 'Turno de mañana' } })
  // Sin producto: validación pública, sin enviar una escritura.
  fireEvent.click(screen.getByRole('button', { name: 'Registrar producción' }))
  await screen.findAllByRole('alert')
  location.pathname = '/produccion/historial'
  rerender(<Produccion />)
  await screen.findByText('Historial de producción')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  location.pathname = '/produccion/registrar'
  rerender(<Produccion />)
  expect(await screen.findByLabelText('Cantidad')).toHaveValue('12')
  expect(screen.getByLabelText('Observaciones (opcional)')).toHaveValue('Turno de mañana')
})


it('FX R2-01 · conserva el nodo de lista durante actualización pendiente', async () => {
  vi.mocked(api.obtenerIncidencias).mockResolvedValueOnce([{ id: 'i1', sucursal_id: 'suc-1', produccion_id: null, descripcion: 'Turno visible', creado_por: 'u1', creado_en: '2026-10-13T12:00:00Z' }])
  location.pathname = '/produccion/incidencias'
  renderWithProviders(<Produccion />)
  const fila = await screen.findByText('Turno visible')
  vi.mocked(api.obtenerIncidencias).mockReturnValueOnce(new Promise(() => {}))
  fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }))
  await waitFor(() => expect(api.obtenerIncidencias).toHaveBeenCalledTimes(2))
  expect(screen.getByText('Turno visible')).toBe(fila)
  expect(screen.getByText('Actualizando...')).toBeInTheDocument()
})

it.each([
  ['registrar', 'Registrar producción', 'Producto'],
  ['incidencias', 'Registrar incidencia', 'Descripción de la incidencia'],
  ['incidencias', 'Registrar merma', 'Producto'],
])('FX2 R4-11 · validación de %s persiste en campo sin Toast', async (seccion, boton, campo) => {
  location.pathname = `/produccion/${seccion}`
  renderWithProviders(<Produccion />)
  await screen.findByRole('option', { name: 'Agua' })
  fireEvent.click(screen.getByRole('button', { name: boton }))
  expect(screen.getByLabelText(campo)).toHaveAttribute('aria-invalid', 'true')
  const id = screen.getByLabelText(campo).getAttribute('aria-describedby')!
  expect(document.getElementById(id)).toHaveAttribute('role', 'alert')
  expect(screen.queryByRole('button', { name: 'Cerrar notificación' })).not.toBeInTheDocument()
  expect(document.getElementById(id)).toBeVisible()
})

it('FX R2-06 · administrador inicia en su sucursal asignada', async () => {
  renderWithProviders(<Produccion />, { perfil: makePerfil({ rol: 'administrador', sucursal_id: 's1' }) })
  await screen.findByRole('option', { name: 'Norte' })
  expect(screen.getByLabelText('Sucursal')).toHaveValue('s1')
  expect(api.obtenerProducciones).toHaveBeenCalledWith('s1')
})


it('FX R2-03 · cantidad y motivo mantienen errores asociados hasta editar el campo', async () => {
  location.pathname = '/produccion/incidencias'
  renderWithProviders(<Produccion />)
  await screen.findByRole('option', { name: 'Agua' })
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'p1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar merma' }))
  expect(screen.getByLabelText('Cantidad')).toHaveAttribute('aria-describedby', 'error-merma-cantidad')
  expect(screen.getByLabelText('Cantidad')).toHaveAttribute('aria-invalid', 'true')
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
  expect(screen.getByLabelText('Cantidad')).not.toHaveAttribute('aria-invalid')
  fireEvent.click(screen.getByRole('button', { name: 'Registrar merma' }))
  expect(screen.getByLabelText('Motivo')).toHaveAttribute('aria-describedby', 'error-merma-motivo')
  expect(screen.queryByRole('button', { name: 'Cerrar notificación' })).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Indica el motivo')
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Pérdida de producto' } })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(api.registrarMerma).not.toHaveBeenCalled()
})


it.each([
  ['Registrar incidencia', 'Descripción de la incidencia'],
  ['Registrar merma', 'Producto'],
])('FX2 R4-11 · %s enfoca el campo inválido sin repetir la validación en Toast', async (boton, nombre) => {
  location.pathname = '/produccion/incidencias'
  renderWithProviders(<Produccion />)
  await screen.findByRole('option', { name: 'Agua' })
  const campo = screen.getByLabelText(nombre)
  screen.getByRole('button', { name: boton }).focus()
  fireEvent.click(screen.getByRole('button', { name: boton }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(campo).toHaveFocus()
  expect(campo).toHaveAttribute('aria-invalid','true')
  expect(screen.queryByRole('button', { name: 'Cerrar notificación' })).not.toBeInTheDocument()
})
