import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import { renderWithProviders, makePerfil } from '@/test/render'
import RegistrarVenta from './RegistrarVenta'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/domains/ventas/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/ventas/api')>()
  return {
    ...actual,
    obtenerResumenVenta: vi.fn().mockResolvedValue({ id: 'venta-123', total: 1733 }),
    obtenerClientesRuta: vi.fn(),
    obtenerProductosVenta: vi.fn(),
    obtenerCargaVendedor: vi.fn(),
    registrarVenta: vi.fn(),
  }
})

import * as api from '@/domains/ventas/api'

const PERFIL = makePerfil({ id: 'vendedor-1' })

const PRODUCTOS = [
  { id: 'p1', nombre: 'Bidón POL', tipo: 'agua', tipo_empaque_id: 't1', precio_base: 1000, activo: true, creado_en: '2026-01-01T00:00:00Z', tipo_empaque: { id: 't1', nombre: 'Bidón 20L', categoria: 'retornable' } },
  { id: 'p2', nombre: 'Bidón PET', tipo: 'agua', tipo_empaque_id: 't1', precio_base: 1000, activo: true, creado_en: '2026-01-01T00:00:00Z', tipo_empaque: { id: 't1', nombre: 'Bidón 20L', categoria: 'retornable' } },
  { id: 'p3', nombre: 'Hielo CUBO', tipo: 'hielo', tipo_empaque_id: 't2', precio_base: 400, activo: true, creado_en: '2026-01-01T00:00:00Z', tipo_empaque: { id: 't2', nombre: 'Bolsa 2kg', categoria: 'desechable' } },
]

const CARGA = [
  { producto_id: 'p1', vendedor_id: 'vendedor-1', cantidad: 1000, modificado_en: '2026-01-01T00:00:00Z', producto: { id: 'p1', nombre: 'Bidón POL', tipo: 'agua', precio_base: 1000 } },
  { producto_id: 'p2', vendedor_id: 'vendedor-1', cantidad: 1000, modificado_en: '2026-01-01T00:00:00Z', producto: { id: 'p2', nombre: 'Bidón PET', tipo: 'agua', precio_base: 1000 } },
  { producto_id: 'p3', vendedor_id: 'vendedor-1', cantidad: 1000, modificado_en: '2026-01-01T00:00:00Z', producto: { id: 'p3', nombre: 'Hielo CUBO', tipo: 'hielo', precio_base: 400 } },
]

const CLIENTES = [
  { id: 'c1', nombre: 'Doña María', telefono: null, direccion: 'Calle 1', numero_local: null, tipo: 'minorista', activo: true, creado_en: '2026-01-01T00:00:00Z' },
]

// El desmontaje hace flush del borrador; aislar el siguiente caso después de ese cleanup.
beforeEach(() => sessionStorage.clear())

afterEach(() => {
  vi.mocked(api.obtenerClientesRuta).mockReset()
  vi.mocked(api.obtenerProductosVenta).mockReset()
  vi.mocked(api.obtenerCargaVendedor).mockReset()
  vi.mocked(api.registrarVenta).mockReset()
  vi.mocked(api.obtenerResumenVenta).mockReset().mockResolvedValue({ id: 'venta-123', total: 1733 })
  sessionStorage.clear()
})

function setup() {
  vi.mocked(api.obtenerClientesRuta).mockResolvedValue(CLIENTES)
  vi.mocked(api.obtenerProductosVenta).mockResolvedValue(PRODUCTOS)
  vi.mocked(api.obtenerCargaVendedor).mockResolvedValue(CARGA)
  vi.mocked(api.registrarVenta).mockResolvedValue({ id: 'venta-123', error: null })
}

async function renderForm() {
  setup()
  renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
  await waitFor(() => {
    expect(screen.getByText('Registrar venta')).toBeInTheDocument()
  })
  await waitFor(() => {
    const options = screen.getAllByRole('option')
    expect(options.some((o) => o.textContent?.includes('Bidón POL'))).toBe(true)
  })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled())
}

function setNativeValue(el: HTMLSelectElement | HTMLInputElement, value: string) {
  const proto = el instanceof HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  nativeSetter?.call(el, value)
  fireEvent.change(el)
}

describe('HU-01 · RegistrarVenta — productos duplicados', () => {
  it('deshabilita productos ya seleccionados en otras filas', async () => {
    await renderForm()

    const selects = screen.getAllByRole('combobox')
    // selects[0] = cliente, selects[1..3] = productos, selects[4] = metodoPago
    const row0Select = selects[1] as HTMLSelectElement
    const row1Select = selects[2] as HTMLSelectElement

    // Row 0 should have Bidón POL selected by default
    const row0Options = within(row0Select).getAllByRole('option') as HTMLOptionElement[]
    const polOptionRow0 = row0Options.find((o) => o.textContent?.includes('Bidón POL'))
    expect(polOptionRow0).toBeTruthy()
    expect(polOptionRow0!.selected).toBe(true)

    // Row 1 should have Bidón POL disabled (already selected in row 0)
    const row1Options = within(row1Select).getAllByRole('option') as HTMLOptionElement[]
    const polInRow1 = row1Options.find((o) => o.textContent?.includes('Bidón POL'))
    expect(polInRow1).toBeTruthy()
    expect(polInRow1!.disabled).toBe(true)
  })

  it('actualiza disponible al cambiar producto dinámicamente', async () => {
    await renderForm()

    const selects = screen.getAllByRole('combobox')
    const row0Select = selects[1] as HTMLSelectElement

    setNativeValue(row0Select, 'p2')

    await waitFor(() => {
      expect(screen.getAllByText('1.000').length).toBeGreaterThan(0)
    })
  })
})

describe('HU-01 · RegistrarVenta — cantidad 0', () => {
  it('no envía detalles con cantidad 0 al backend', async () => {
    await renderForm()

    const selects = screen.getAllByRole('combobox')
    const clienteSelect = selects[0] as HTMLSelectElement
    setNativeValue(clienteSelect, 'c1')

    // Cantidades ahora son textbox con formato miles (vacío = 0)
    const cantidadInputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    // Orden: row0 cantidad, row0 precio, row1 cantidad, row1 precio, row2 cantidad, row2 precio, descuento, observaciones
    const row0Cantidad = cantidadInputs[0] as HTMLInputElement
    setNativeValue(row0Cantidad, '5')

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Confirmar venta/i }) as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })

    fireEvent.click(screen.getByRole('button', { name: /Confirmar venta/i }))

    await waitFor(() => {
      expect(api.registrarVenta).toHaveBeenCalledTimes(1)
    }, { timeout: 8000 })

    const callArgs = vi.mocked(api.registrarVenta).mock.calls[0][0]
    const detallesEnviados = callArgs.p_detalles
    expect(detallesEnviados.every((d) => d.cantidad > 0)).toBe(true)
    expect(detallesEnviados.filter((d) => d.cantidad === 0).length).toBe(0)
  })
})

describe('F1 · máximo dinámico de productos activos', () => {
  it.each([7, 10])('adapta el límite a un catálogo de %i productos', async (total) => {
    setup()
    const catalogo = Array.from({ length: total }, (_, i) => ({ ...PRODUCTOS[i % 3], id: `p${i + 1}`, nombre: i < 3 ? PRODUCTOS[i].nombre : `Producto ${i + 1}` }))
    vi.mocked(api.obtenerProductosVenta).mockResolvedValue(catalogo)
    renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
    await screen.findAllByRole('option', { name: /Producto 7/ })
    const agregar = screen.getByRole('button', { name: 'Agregar producto' })
    for (let i = 3; i < total; i++) {
      expect(agregar).toBeEnabled()
      fireEvent.click(agregar)
    }
    expect(screen.getAllByRole('combobox', { name: /^Producto \d+$/ })).toHaveLength(total)
    expect(agregar).toBeDisabled()
    expect(agregar).toHaveAccessibleDescription(`Máximo ${total} productos por venta: ya agregaste todos los productos activos del catálogo.`)
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[total - 1])
    expect(agregar).toBeEnabled()
  })

  it('respeta un catálogo menor que las tres filas predeterminadas', async () => {
    setup()
    vi.mocked(api.obtenerProductosVenta).mockResolvedValue(PRODUCTOS.slice(0, 1))
    renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
    await screen.findAllByRole('option', { name: /Bidón POL/ })
    await waitFor(() => expect(screen.getAllByRole('combobox', { name: /^Producto \d+$/ })).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Agregar producto' })).toBeDisabled()
  })

  it('restaura borradores de diez productos sin el tope antiguo de seis', async () => {
    setup()
    const catalogo = Array.from({ length: 10 }, (_, i) => ({ ...PRODUCTOS[0], id: `p${i + 1}`, nombre: `Producto ${i + 1}` }))
    vi.mocked(api.obtenerProductosVenta).mockResolvedValue(catalogo)
    sessionStorage.setItem('ondina:draft-registrar-venta:vendedor-1', JSON.stringify({ clienteId: 'c1', metodoPago: 'efectivo', descuento: 0, detalles: catalogo.map(p => ({ productoId: p.id, cantidad: 2, precioUnitario: 1000 })) }))
    renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
    await screen.findByRole('option', { name: 'Doña María' })
    expect(screen.getAllByRole('combobox', { name: /^Producto \d+$/ })).toHaveLength(10)
    expect(screen.getAllByRole('textbox', { name: /^Cantidad de/ })[9]).toHaveValue('2')
  })
})

it('F1 · cantidad usa flechas y conserva el error de carga al incrementarla', async () => {
  await renderForm()
  const cantidad = screen.getByLabelText('Cantidad de Bidón POL')
  fireEvent.change(cantidad, { target: { value: '1000' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Aumentar', exact: true })[0])
  expect(cantidad).toHaveValue('1.001')
  expect(cantidad).toHaveAttribute('aria-invalid', 'true')
  expect(cantidad).toHaveAccessibleDescription('Excede tu carga')
  fireEvent.keyDown(cantidad, { key: 'ArrowDown' })
  expect(cantidad).toHaveAttribute('aria-invalid', 'false')
  expect(screen.getAllByRole('button', { name: 'Aumentar', exact: true })).toHaveLength(3)
})

describe('HU-01 · RegistrarVenta — Toast sin productos válidos', () => {
  it('muestra Toast de error al submit sin productos con cantidad > 0', async () => {
    await renderForm()

    const selects = screen.getAllByRole('combobox')
    const clienteSelect = selects[0] as HTMLSelectElement
    setNativeValue(clienteSelect, 'c1')

    // No ingresar cantidades (todas quedan en 0)
    fireEvent.click(screen.getByRole('button', { name: /Confirmar venta/i }))

    await waitFor(() => {
      expect(screen.getByText(/al menos un producto con cantidad mayor a 0/i)).toBeInTheDocument()
    })
  })
})


it('FE-10 · nombra los campos de cantidad y precio con su producto', async () => {
  await renderForm()
  expect(screen.getByRole('textbox', { name: 'Cantidad de Bidón POL' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Precio unitario de Bidón POL' })).toBeInTheDocument()
})


it.each(['obtenerClientesRuta', 'obtenerProductosVenta', 'obtenerCargaVendedor'] as const)(
  'FE-05 · conserva el formulario y bloquea la venta si falla %s', async (servicio) => {
    setup()
    vi.mocked(api[servicio]).mockRejectedValue(new Error('Fallo de consulta'))
    renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar los datos de la venta')
    const cantidad = screen.getAllByRole('textbox', { name: /Cantidad de/ })[0]
    fireEvent.change(cantidad, { target: { value: '7' } })
    expect(cantidad).toHaveValue('7')
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
    expect(api.registrarVenta).not.toHaveBeenCalled()
  },
)

describe('Accesibilidad · RegistrarVenta', () => {
  it('asocia cliente, productos por fila y método de pago a un nombre accesible', async () => {
    await renderForm()
    expect(screen.getByRole('combobox', { name: 'Cliente de tu cartera' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Producto 1' })).toHaveValue('p1')
    expect(screen.getByRole('combobox', { name: 'Producto 2' })).toHaveValue('p2')
    expect(screen.getByRole('combobox', { name: 'Producto 3' })).toHaveValue('p3')
    expect(screen.getByLabelText('Método de pago')).toBeInTheDocument()
  })
})

it('A1-12 · cliente inválido conserva nombre, descripción y foco RHF', async () => {
  await renderForm()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  await screen.findByText('Selecciona un cliente')
  const campo = screen.getByRole('combobox', { name: 'Cliente de tu cartera', exact: true })
  expect(campo).toHaveAttribute('aria-invalid', 'true')
  expect(campo).toHaveClass('border-red-400')
  expect(document.getElementById(campo.getAttribute('aria-describedby')!)).toHaveTextContent('Selecciona un cliente')
  expect(campo).toHaveFocus()
})

it.each(['sin carga', 'sin clientes', 'administrador'] as const)('UX-06/A1-17 · explica y bloquea %s antes de enviar', async (caso) => {
  setup()
  if (caso === 'sin carga') vi.mocked(api.obtenerCargaVendedor).mockResolvedValue([])
  if (caso === 'sin clientes') vi.mocked(api.obtenerClientesRuta).mockResolvedValue([])
  renderWithProviders(<RegistrarVenta />, { perfil: makePerfil({ id: 'vendedor-1', rol: caso === 'administrador' ? 'administrador' : 'vendedor' }) })
  const motivo = await screen.findByText(caso === 'sin carga' ? /pídela a bodega/i : caso === 'sin clientes' ? /crea un cliente para continuar/i : /administrador.*venta.*vendedor/i)
  const boton = screen.getByRole('button', { name: 'Confirmar venta' })
  expect(boton).toBeDisabled()
  expect(boton.getAttribute('aria-describedby')?.split(' ')).toContain(motivo.id)
  expect(api.registrarVenta).not.toHaveBeenCalled()
})

it('A1-13 · Reintentar recupera lecturas sin reenviar ventas y conserva observaciones', async () => {
  setup()
  vi.mocked(api.obtenerClientesRuta).mockRejectedValueOnce(new Error('fallo')).mockResolvedValue(CLIENTES)
  renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
  await screen.findByRole('alert')
  fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: 'Pedido pendiente' } })
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByRole('option', { name: 'Doña María' })
  expect(screen.getByLabelText('Observaciones')).toHaveValue('Pedido pendiente')
  expect(api.registrarVenta).not.toHaveBeenCalled()
})

it('UX-05/A1-06 · éxito conserva folio completo y refresca carga una sola vez', async () => {
  await renderForm()
  fireEvent.change(screen.getByLabelText('Cliente de tu cartera'), { target: { value: 'c1' } })
  fireEvent.change(screen.getByLabelText('Cantidad de Bidón POL'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  await screen.findByRole('heading', { name: 'Venta registrada' })
  expect(screen.getByLabelText('Folio de la venta')).toHaveValue('venta-123')
  expect(screen.getByRole('button', { name: 'Registrar otra venta' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ir a Ventas' })).toHaveAttribute('href', '/ventas')
  await waitFor(() => expect(api.obtenerCargaVendedor).toHaveBeenCalledTimes(2))
})

it('UX-05 · si falla el resumen conserva folio y cliente y reintenta sólo la lectura', async () => {
  await renderForm()
  vi.mocked(api.obtenerResumenVenta).mockRejectedValueOnce(new Error('fallo de red'))
  fireEvent.change(screen.getByLabelText('Cliente de tu cartera'), { target: { value: 'c1' } })
  fireEvent.change(screen.getByLabelText('Cantidad de Bidón POL'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Folio de la venta')).toHaveValue('venta-123')
  expect(screen.getByText('Doña María')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('$ 1.733')).toBeInTheDocument()
  expect(api.registrarVenta).toHaveBeenCalledTimes(1)
  expect(api.obtenerResumenVenta).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Registrar otra venta' }))
  expect(screen.getByRole('heading', { name: 'Registrar venta' })).toBeInTheDocument()
  expect(screen.getByLabelText('Cliente de tu cartera')).toHaveValue('')
  expect(screen.getByLabelText('Cantidad de Bidón POL')).toHaveValue('')
})

it('A1-12 · error de cantidad mantiene nombre e ID al corregir', async () => {
  await renderForm()
  fireEvent.change(screen.getByLabelText('Cliente de tu cartera'), { target: { value: 'c1' } })
  const cantidad = screen.getByLabelText('Cantidad de Bidón POL')
  const id = cantidad.id
  fireEvent.change(cantidad, { target: { value: '1001' } })
  expect(cantidad).toHaveAttribute('aria-invalid', 'true')
  expect(document.getElementById(cantidad.getAttribute('aria-describedby')!)).toHaveTextContent('Excede tu carga')
  fireEvent.change(cantidad, { target: { value: '2' } })
  expect(cantidad.id).toBe(id)
  expect(cantidad).toHaveAttribute('aria-invalid', 'false')
  expect(cantidad).not.toHaveAttribute('aria-describedby')
})

it('A1-13 · recuperar productos conserva cliente, cantidad y observaciones ingresados durante el fallo', async () => {
  setup()
  vi.mocked(api.obtenerProductosVenta).mockRejectedValueOnce(new Error('fallo')).mockResolvedValue(PRODUCTOS)
  renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
  await screen.findByRole('alert')
  fireEvent.change(screen.getByLabelText('Cliente de tu cartera'), { target: { value: 'c1' } })
  fireEvent.change(screen.getByLabelText('Cantidad de producto 1'), { target: { value: '7' } })
  fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: 'Conservar al reintentar' } })
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(screen.getByLabelText('Producto 1')).toHaveValue('p1'))
  expect(screen.getByLabelText('Cliente de tu cartera')).toHaveValue('c1')
  expect(screen.getByLabelText('Cantidad de Bidón POL')).toHaveValue('7')
  expect(screen.getByLabelText('Observaciones')).toHaveValue('Conservar al reintentar')
  expect(api.registrarVenta).not.toHaveBeenCalled()
})


it('FX2 R4-01 · restaura el cliente cuando las opciones del borrador llegan tarde', async () => {
  setup()
  let resolver!: (value: typeof CLIENTES) => void
  vi.mocked(api.obtenerClientesRuta).mockReturnValueOnce(new Promise(r => { resolver = r }))
  sessionStorage.setItem('ondina:draft-registrar-venta:vendedor-1', JSON.stringify({ clienteId: 'c1', metodoPago: 'efectivo', descuento: 0, observaciones: 'Restaurado', detalles: [{ productoId: 'p1', cantidad: 2, precioUnitario: 1000 }] }))
  renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
  resolver(CLIENTES)
  await screen.findByRole('option', { name: 'Doña María' })
  expect(screen.getByLabelText('Cliente de tu cartera')).toHaveValue('c1')
})

it('FX2 R4-01 · cliente ausente del catálogo se limpia y avisa sin enviarlo oculto', async () => {
  setup()
  sessionStorage.setItem('ondina:draft-registrar-venta:vendedor-1', JSON.stringify({ clienteId: 'retirado', metodoPago: 'efectivo', descuento: 0, detalles: [{ productoId: 'p1', cantidad: 2, precioUnitario: 1000 }] }))
  renderWithProviders(<RegistrarVenta />, { perfil: PERFIL })
  await screen.findByText(/El cliente del borrador ya no está disponible/)
  expect(screen.getByLabelText('Cliente de tu cartera')).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  expect(api.registrarVenta).not.toHaveBeenCalled()
})

it.each(['precio', 'descuento'])('FX2 R4-02 · total cero por %s requiere confirmación explícita', async (caso) => {
  await renderForm()
  fireEvent.change(screen.getByLabelText('Cliente de tu cartera'), { target: { value: 'c1' } })
  fireEvent.change(screen.getByLabelText('Cantidad de Bidón POL'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText(caso === 'precio' ? 'Precio unitario de Bidón POL' : 'Descuento (CLP)'), { target: { value: caso === 'precio' ? '' : '2000' } })
  await screen.findByText(/El total de la venta es \$0/)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  const dialogo = await screen.findByRole('dialog', { name: 'Confirmar venta sin cobro' })
  expect(api.registrarVenta).not.toHaveBeenCalled()
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar venta por $0' }))
  await screen.findByRole('heading', { name: 'Venta registrada' })
  expect(api.registrarVenta).toHaveBeenCalledTimes(1)
})

it.each(['vacío','exceso'])('FX2 R4-03 · %s se asocia a cantidad con foco y sin Toast duplicado', async (caso) => {
  await renderForm()
  fireEvent.change(screen.getByLabelText('Cliente de tu cartera'), { target: { value: 'c1' } })
  const cantidad = screen.getByLabelText('Cantidad de Bidón POL')
  if (caso === 'exceso') fireEvent.change(cantidad, { target: { value: '1001' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  await waitFor(() => expect(cantidad).toHaveAttribute('aria-invalid', 'true'))
  expect(cantidad).toHaveFocus()
  const mensaje = document.getElementById(cantidad.getAttribute('aria-describedby')!)!
  expect(mensaje).toHaveTextContent(caso === 'vacío' ? 'Agrega al menos un producto' : 'solo tienes 1000')
  expect(screen.queryByRole('button', { name: 'Cerrar notificación' })).not.toBeInTheDocument()
  expect(api.registrarVenta).not.toHaveBeenCalled()
})

it('FX2 R4-04 · enfoca resumen, anuncia copia fallida y devuelve foco al cliente', async () => {
  await renderForm()
  fireEvent.change(screen.getByLabelText('Cliente de tu cartera'), { target: { value: 'c1' } })
  fireEvent.change(screen.getByLabelText('Cantidad de Bidón POL'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  const titulo = await screen.findByRole('heading', { name: 'Venta registrada' })
  await waitFor(() => expect(titulo).toHaveFocus())
  expect(screen.getByRole('status')).toHaveTextContent('La venta quedó confirmada')
  vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Copiar folio' }))
    expect(await screen.findByText(/No se pudo copiar el folio/)).toHaveAttribute('role','status')
  } finally { vi.unstubAllGlobals() }
  fireEvent.click(screen.getByRole('button', { name: 'Registrar otra venta' }))
  await waitFor(() => expect(screen.getByLabelText('Cliente de tu cartera')).toHaveFocus())
})

it('FX2 R4-05 · administrador no puede editar los campos del formulario', async () => {
  setup()
  renderWithProviders(<RegistrarVenta />, { perfil: makePerfil({ rol: 'administrador' }) })
  await screen.findByText(/El administrador consulta la gestión de ventas/)
  expect(screen.getByLabelText('Cliente de tu cartera')).toBeDisabled()
  expect(screen.getByLabelText('Observaciones')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Agregar producto' })).toBeDisabled()
})
