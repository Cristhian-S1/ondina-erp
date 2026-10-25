// Local-only browser check for HU-29: bodega losses (/mermas) and the daily
// seller reconciliation (/cuadre-diario). The app is served by `npm run dev`
// from frontend/ and every Auth, REST and RPC request is intercepted here with
// synthetic data, so no backend is required. The only allowed writes are the
// `registrar_merma_bodega` and `anular_merma_bodega` RPC POSTs; any other
// non-GET under `/rest/v1/` fails the run.
//
// Chrome is the locally installed binary. If Playwright is not resolvable from
// node_modules, point HU29_PLAYWRIGHT_MODULE at an installed module:
//   HU29_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

let chromium
try {
  ({ chromium } = await import(process.env.HU29_PLAYWRIGHT_MODULE ?? 'playwright'))
} catch (error) {
  console.error('Playwright is not resolvable. Set HU29_PLAYWRIGHT_MODULE to an installed playwright/index.mjs.')
  throw error
}

const base = process.env.HU29_BASE_URL ?? 'http://127.0.0.1:5193'
const supabase = process.env.HU29_SUPABASE_URL ?? 'http://127.0.0.1:54321'
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'HU29_BASE_URL must be local')
assert.match(supabase, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'HU29_SUPABASE_URL must be local')
const baseOrigin = new URL(base).origin
const supabaseOrigin = new URL(supabase).origin

const out = fileURLToPath(new URL('../../docs/archive/audits/2026-10-25/frontend/hu29/', import.meta.url))
mkdirSync(out, { recursive: true })

const USER_BODEGA = '00000000-0000-4000-8000-000000000029'
const USER_ADMIN = '00000000-0000-4000-8000-000000000030'
const SUCURSAL_ID = '00000000-0000-4000-8000-000000000001'
const SUCURSAL_2_ID = '00000000-0000-4000-8000-000000000002'
const VENDEDOR_ACTIVO = '00000000-0000-4000-8000-000000000101'
const VENDEDOR_INACTIVO = '00000000-0000-4000-8000-000000000102'
const PRODUCTO_AGUA = '44444444-4444-4444-8444-444444444444'
const PRODUCTO_HIELO = '55555555-5555-4555-8555-555555555555'
const PRODUCTO_RETIRADO = '44444444-4444-4444-8444-444444444445'
const TIPO_BANDEJA = '66666666-6666-4666-8666-666666666666'
const DESPACHO_HOY = '11111111-1111-4111-8111-111111111126'
const DETALLE_HOY = '22222222-2222-4222-8222-222222222201'
const MERMA_PRODUCTO = '33333333-3333-4333-8333-333333333301'
const MERMA_ENVASE = '33333333-3333-4333-8333-333333333302'
const MERMA_ANULADA = '33333333-3333-4333-8333-333333333303'
const EMAIL_BODEGA = 'ux-hu29-bodega@example.invalid'
const EMAIL_ADMIN = 'ux-hu29-admin@example.invalid'
const RPC_REGISTRAR = '/rest/v1/rpc/registrar_merma_bodega'
const RPC_ANULAR = '/rest/v1/rpc/anular_merma_bodega'
const RPC_CUADRE = '/rest/v1/rpc/cuadre_diario_bodega'
// Read-only RPCs are POST at the HTTP level but do not mutate data.
const RPC_LECTURA = new Set([
  '/rest/v1/rpc/vendedores_sucursal',
  '/rest/v1/rpc/vendedores_historial_sucursal',
  RPC_CUADRE,
])
const ESCRITURAS_PERMITIDAS = new Set([`POST ${RPC_REGISTRAR}`, `POST ${RPC_ANULAR}`])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fechaSantiago = (fecha = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(fecha)

function sumarDias(iso, dias) {
  const fecha = new Date(`${iso}T12:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

const fechaVisible = (iso) => iso.split('-').reverse().join('-')

const perfilBodega = {
  id: USER_BODEGA,
  sucursal_id: SUCURSAL_ID,
  nombres: 'Sofía',
  apellidos: 'Bodega',
  rut: '11.111.111-1',
  telefono: null,
  rol: 'bodega',
  activo: true,
  creado_en: '2026-01-01T00:00:00Z',
}

const perfilAdmin = {
  id: USER_ADMIN,
  sucursal_id: null,
  nombres: 'Ada',
  apellidos: 'Administración',
  rut: '22.222.222-2',
  telefono: null,
  rol: 'administrador',
  activo: true,
  creado_en: '2026-01-01T00:00:00Z',
}

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
function crearSesion(perfil, email) {
  const accessToken = [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ sub: perfil.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }),
    'synthetic-signature',
  ].join('.')
  const authUser = {
    id: perfil.id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    is_anonymous: false,
  }
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'synthetic-refresh-token',
    user: authUser,
  }
}

const sesiones = {
  [EMAIL_BODEGA]: crearSesion(perfilBodega, EMAIL_BODEGA),
  [EMAIL_ADMIN]: crearSesion(perfilAdmin, EMAIL_ADMIN),
}
const usuarios = {
  [EMAIL_BODEGA]: sesiones[EMAIL_BODEGA].user,
  [EMAIL_ADMIN]: sesiones[EMAIL_ADMIN].user,
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers':
    'authorization, apikey, content-type, accept, accept-profile, content-profile, prefer, range, x-client-info, x-supabase-api-version',
  'access-control-expose-headers': 'content-range, range-unit',
  'access-control-max-age': '600',
}

function crearFixture() {
  const ahora = new Date()
  const hace = (minutos) => new Date(ahora.getTime() - minutos * 60_000).toISOString()
  return {
    perfiles: [perfilBodega, perfilAdmin],
    sucursales: [
      { id: SUCURSAL_ID, nombre: 'Sucursal Sintética', direccion: null, comuna: null, region: null, telefono: null, activa: true, creado_en: '2026-01-01T00:00:00Z' },
      { id: SUCURSAL_2_ID, nombre: 'Sucursal Sintética Dos', direccion: null, comuna: null, region: null, telefono: null, activa: true, creado_en: '2026-01-01T00:00:00Z' },
    ],
    vendedores: [{ id: VENDEDOR_ACTIVO, nombres: 'Valentina', apellidos: 'Rojas' }],
    historial: [
      { id: VENDEDOR_ACTIVO, nombres: 'Valentina', apellidos: 'Rojas', activo: true },
      { id: VENDEDOR_INACTIVO, nombres: 'Iván', apellidos: 'Retirado', activo: false },
    ],
    productos: [
      { id: PRODUCTO_AGUA, nombre: 'Agua 20L', tipo: 'agua', tipo_empaque_id: TIPO_BANDEJA, precio_base: 1000, activo: true, creado_en: '2026-01-01T00:00:00Z' },
      { id: PRODUCTO_HIELO, nombre: 'Hielo en bolsa 2kg', tipo: 'hielo', tipo_empaque_id: null, precio_base: 800, activo: true, creado_en: '2026-01-01T00:00:00Z' },
      { id: PRODUCTO_RETIRADO, nombre: 'Producto retirado', tipo: 'agua', tipo_empaque_id: null, precio_base: 500, activo: false, creado_en: '2025-01-01T00:00:00Z' },
    ],
    tiposEmpaque: [
      { id: TIPO_BANDEJA, nombre: 'Bandeja', categoria: 'uso_interno', activo: true },
    ],
    stockBodega: [
      { sucursal_id: SUCURSAL_ID, producto_id: PRODUCTO_AGUA, cantidad: 200, modificado_en: hace(5) },
      { sucursal_id: SUCURSAL_ID, producto_id: PRODUCTO_HIELO, cantidad: 100, modificado_en: hace(5) },
    ],
    stockEnvases: [
      { sucursal_id: SUCURSAL_ID, tipo_empaque_id: TIPO_BANDEJA, cantidad: 20, modificado_en: hace(5) },
    ],
    cargaVendedor: [],
    despachos: [
      {
        id: DESPACHO_HOY, sucursal_id: SUCURSAL_ID, vendedor_id: VENDEDOR_ACTIVO,
        despachador_id: USER_BODEGA, anulado: false, creado_por: USER_BODEGA,
        creado_en: ahora.toISOString(), modificado_por: null, modificado_en: null,
      },
    ],
    detalles: [
      { id: DETALLE_HOY, despacho_id: DESPACHO_HOY, producto_id: PRODUCTO_HIELO, cantidad: 6, es_ajuste: false, creado_en: ahora.toISOString() },
    ],
    mermas: [
      {
        id: MERMA_PRODUCTO, sucursal_id: SUCURSAL_ID, despacho_id: null,
        producto_id: PRODUCTO_HIELO, tipo_empaque_id: null, cantidad: 4,
        motivo: 'Se quebró una botella en bodega', anulado: false,
        creado_por: USER_BODEGA, creado_en: hace(10),
      },
      {
        id: MERMA_ENVASE, sucursal_id: SUCURSAL_ID, despacho_id: null,
        producto_id: null, tipo_empaque_id: TIPO_BANDEJA, cantidad: 2,
        motivo: 'Bandeja aplastada', anulado: false,
        creado_por: VENDEDOR_ACTIVO, creado_en: hace(20),
      },
      {
        id: MERMA_ANULADA, sucursal_id: SUCURSAL_ID, despacho_id: DESPACHO_HOY,
        producto_id: PRODUCTO_AGUA, tipo_empaque_id: null, cantidad: 1200,
        motivo: 'Derrame en el despacho', anulado: true,
        creado_por: VENDEDOR_ACTIVO, creado_en: hace(30),
      },
    ],
    cuadre: [
      {
        sucursal_id: SUCURSAL_ID, vendedor_id: VENDEDOR_ACTIVO, fecha: fechaSantiago(),
        producto_id: PRODUCTO_AGUA, despachado: 300, vendido: 280, devuelto: 10,
        mermas: 5, esperado_en_carga: 5, saldo_inicial: null, carga_actual: null,
        diferencia_carga: null, comparacion_disponible: false,
      },
      {
        sucursal_id: SUCURSAL_ID, vendedor_id: VENDEDOR_INACTIVO, fecha: fechaSantiago(),
        producto_id: PRODUCTO_HIELO, despachado: 1200, vendido: 0, devuelto: 0,
        mermas: 0, esperado_en_carga: -5, saldo_inicial: 7, carga_actual: 10,
        diferencia_carga: 0, comparacion_disponible: true,
      },
    ],
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
})

function contentRange(filas) {
  return filas.length === 0 ? '*/0' : `0-${filas.length - 1}/${filas.length}`
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function esperarHasta(condicion, timeoutMs, descripcion) {
  const limite = Date.now() + timeoutMs
  while (Date.now() < limite) {
    if (await condicion()) return
    await esperar(50)
  }
  throw new Error(`Timed out waiting for ${descripcion}`)
}

async function iniciarSesion(page, rol) {
  const email = rol === 'administrador' ? EMAIL_ADMIN : EMAIL_BODEGA
  const nombres = rol === 'administrador' ? perfilAdmin.nombres : perfilBodega.nombres
  await page.goto(`${base}/login`)
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill('ux-local-2026')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.includes('login'))
  await page.getByRole('heading', { name: `Hola, ${nombres}`, exact: true }).waitFor()
}

const results = []

async function ejecutarEscenario({ nombre, rol, ruta, viewport, registrar = 'exito', cuadre = 'datos', accion }) {
  const fixture = crearFixture()
  const context = await browser.newContext({ viewport, locale: 'es-CL', timezoneId: 'America/Santiago' })
  const page = await context.newPage()
  const estado = {
    errores: [],
    externas: [],
    peticiones: [],
    noGet: [],
    inesperadas: [],
    escrituras: [],
    rpcRegistrar: [],
    rpcAnular: [],
    rpcCuadre: [],
    respuestasMerma: new Map(),
    falloRedHecho: false,
    getMermas: 0,
    getDespachos: 0,
  }
  const checks = {}
  const failures = []
  const sufijo = `${viewport.width}x${viewport.height}`
  const modo = { registrar, cuadre }

  page.on('pageerror', (error) => estado.errores.push({ text: error.message, url: null }))
  page.on('console', (message) => {
    if (message.type() === 'error') estado.errores.push({ text: message.text(), url: message.location().url || null })
  })
  page.on('requestfailed', (request) => {
    estado.errores.push({ text: `${request.method()} ${request.url()}: ${request.failure()?.errorText}`, url: request.url() })
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.origin !== baseOrigin && url.origin !== supabaseOrigin) {
      estado.externas.push(request.url())
    }
  })

  await page.route((url) => url.origin === supabaseOrigin, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    estado.peticiones.push(`${method} ${url.pathname}`)
    if (method !== 'GET') estado.noGet.push(`${method} ${url.pathname}`)

    const json = (status, body, extra = {}) => route.fulfill({
      status,
      headers: { ...cors, 'content-type': 'application/json', ...extra },
      body: JSON.stringify(body),
    })

    if (url.pathname === '/auth/v1/token' && method === 'POST') {
      const email = String(request.postDataJSON()?.email ?? '').toLowerCase()
      const sesion = sesiones[email]
      if (!sesion) {
        await json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
        return
      }
      await json(200, sesion)
      return
    }
    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      await json(200, usuarios[EMAIL_BODEGA])
      return
    }
    if (url.pathname === '/auth/v1/logout') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    // Only the two HU-29 mutations may write. Read-only RPCs keep using POST.
    if (url.pathname.startsWith('/rest/v1/') && method !== 'GET' && !RPC_LECTURA.has(url.pathname)) {
      estado.escrituras.push(`${method} ${url.pathname}`)
    }

    if (url.pathname === RPC_REGISTRAR && method === 'POST') {
      const cuerpo = request.postDataJSON()
      estado.rpcRegistrar.push(cuerpo)
      if (modo.registrar === 'falloRed' && !estado.falloRedHecho) {
        estado.falloRedHecho = true
        await route.abort('failed')
        return
      }
      if (modo.registrar === 'errorStock') {
        await json(400, {
          code: 'P0001',
          details: null,
          hint: null,
          message: 'Stock o carga insuficiente para completar la operación.',
        })
        return
      }
      if (modo.registrar === 'lento') await esperar(600)
      const clave = cuerpo?.p_idempotency_key
      if (estado.respuestasMerma.has(clave)) {
        await json(200, estado.respuestasMerma.get(clave))
        return
      }
      const id = randomUUID()
      fixture.mermas.unshift({
        id,
        sucursal_id: cuerpo.p_sucursal_id,
        despacho_id: cuerpo.p_despacho_id,
        producto_id: cuerpo.p_producto_id,
        tipo_empaque_id: cuerpo.p_tipo_empaque_id,
        cantidad: cuerpo.p_cantidad,
        motivo: cuerpo.p_motivo,
        anulado: false,
        creado_por: rol === 'administrador' ? USER_ADMIN : USER_BODEGA,
        creado_en: new Date().toISOString(),
      })
      estado.respuestasMerma.set(clave, id)
      await json(200, id)
      return
    }

    if (url.pathname === RPC_ANULAR && method === 'POST') {
      const cuerpo = request.postDataJSON()
      estado.rpcAnular.push(cuerpo)
      const merma = fixture.mermas.find((fila) => fila.id === cuerpo?.p_merma_id)
      if (!merma) {
        await json(404, { code: 'P0001', message: 'La merma no existe.' })
        return
      }
      merma.anulado = true
      await json(200, merma.id)
      return
    }

    if (url.pathname === RPC_CUADRE && method === 'POST') {
      estado.rpcCuadre.push(request.postDataJSON())
      await json(200, modo.cuadre === 'vacio' ? [] : fixture.cuadre)
      return
    }
    if (url.pathname === '/rest/v1/rpc/vendedores_sucursal' && method === 'POST') {
      await json(200, fixture.vendedores)
      return
    }
    if (url.pathname === '/rest/v1/rpc/vendedores_historial_sucursal' && method === 'POST') {
      await json(200, fixture.historial)
      return
    }

    // PostgREST answers `.single()` with an object; supabase-js asks for it with
    // `Accept: application/vnd.pgrst.object+json`.
    const single = (request.headers().accept ?? '').includes('application/vnd.pgrst.object+json')

    if (method === 'GET' && url.pathname === '/rest/v1/perfiles') {
      const perfil = fixture.perfiles.find((fila) => fila.id === (rol === 'administrador' ? USER_ADMIN : USER_BODEGA))
      await json(200, single ? perfil : [perfil])
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/sucursales') {
      if (single || url.searchParams.has('id')) {
        const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
        const sucursal = fixture.sucursales.find((fila) => fila.id === id) ?? fixture.sucursales[0]
        await json(200, sucursal)
        return
      }
      await json(200, fixture.sucursales)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/productos') {
      await json(200, fixture.productos)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/tipos_empaque') {
      await json(200, fixture.tiposEmpaque)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/stock_bodega') {
      await json(200, fixture.stockBodega)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/stock_envases') {
      await json(200, fixture.stockEnvases)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/carga_vendedor') {
      await json(200, fixture.cargaVendedor)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/despachos') {
      estado.getDespachos += 1
      await json(200, fixture.despachos, { 'content-range': contentRange(fixture.despachos) })
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/despacho_detalles') {
      await json(200, fixture.detalles)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/mermas') {
      let filas = [...fixture.mermas]
      const despacho = url.searchParams.get('despacho_id')
      if (despacho === 'is.null') filas = filas.filter((fila) => fila.despacho_id === null)
      if (despacho === 'not.is.null') filas = filas.filter((fila) => fila.despacho_id !== null)
      const anulado = url.searchParams.get('anulado')
      if (anulado === 'eq.true') filas = filas.filter((fila) => fila.anulado)
      if (anulado === 'eq.false') filas = filas.filter((fila) => !fila.anulado)
      estado.getMermas += 1
      await json(200, filas, { 'content-range': contentRange(filas) })
      return
    }

    estado.inesperadas.push(`${method} ${url.pathname}`)
    await json(404, { message: `Unexpected synthetic request: ${method} ${url.pathname}` })
  })

  try {
    await iniciarSesion(page, rol)
    await page.goto(`${base}${ruta}`)
    await accion({ page, checks, failures, estado, fixture, modo })
  } catch (error) {
    failures.push(`Scenario threw: ${error.message}`)
  }

  const erroresEsperados = estado.errores.filter((error) => {
    if (modo.registrar === 'falloRed' && (error.url ?? '').includes(RPC_REGISTRAR)
      && /ERR_FAILED|Failed to fetch|Failed to load resource/i.test(error.text)) return true
    if (modo.registrar === 'errorStock' && (error.url ?? '').includes(RPC_REGISTRAR)
      && /status of 400|Failed to load resource/i.test(error.text)) return true
    return false
  })
  const erroresInesperados = estado.errores.filter((error) => !erroresEsperados.includes(error))
  if (erroresInesperados.length > 0) failures.push(`Browser errors: ${JSON.stringify(erroresInesperados)}`)
  if (estado.externas.length > 0) failures.push(`Requests outside 127.0.0.1: ${JSON.stringify([...new Set(estado.externas)])}`)
  if (estado.inesperadas.length > 0) failures.push(`Unexpected requests: ${JSON.stringify([...new Set(estado.inesperadas)])}`)
  const escriturasNoPermitidas = estado.escrituras.filter((escritura) => !ESCRITURAS_PERMITIDAS.has(escritura))
  if (escriturasNoPermitidas.length > 0) failures.push(`Unexpected database writes: ${JSON.stringify(escriturasNoPermitidas)}`)

  await context.close()

  const resultado = {
    scenario: nombre,
    role: rol,
    path: ruta,
    viewport: sufijo,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checks,
    rpc: { registrar: estado.rpcRegistrar, anular: estado.rpcAnular, cuadre: estado.rpcCuadre },
    reads: { mermas: estado.getMermas, despachos: estado.getDespachos },
    nonGetRequests: estado.noGet,
    requests: estado.peticiones,
    expectedConsoleErrors: erroresEsperados.map((error) => error.text),
    failures,
  }
  results.push(resultado)
  console.log(`${resultado.status} ${nombre} ${sufijo}`)
}

function comprobar(condicion, mensaje, failures) {
  if (!condicion) failures.push(mensaje)
}

async function medirLayout(page) {
  return page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
}

async function medirBoton(locator, etiqueta) {
  const caja = await locator.evaluate((elemento) => {
    const rect = elemento.getBoundingClientRect()
    return { height: Math.round(rect.height * 100) / 100, width: Math.round(rect.width * 100) / 100 }
  })
  return { control: etiqueta, tag: 'button', ...caja }
}

async function medirTablaMermas(page) {
  return page.evaluate(() => {
    const tabla = document.querySelector('table[aria-label="Mermas de la sucursal"]')
    const fila = tabla?.querySelector('tbody tr[role="row"]')
    return {
      tableDisplay: tabla ? getComputedStyle(tabla).display : null,
      rowDisplay: fila ? getComputedStyle(fila).display : null,
    }
  })
}

async function medirTablaCuadre(page) {
  return page.evaluate(() => {
    const tabla = document.querySelector('table[aria-label="Cuadre diario por vendedor y producto"]')
    const fila = tabla?.querySelector('tbody tr[role="row"]')
    const etiqueta = fila?.querySelector('td span')
    return {
      tableDisplay: tabla ? getComputedStyle(tabla).display : null,
      rowDisplay: fila ? getComputedStyle(fila).display : null,
      mobileLabelDisplay: etiqueta ? getComputedStyle(etiqueta).display : null,
    }
  })
}

async function seleccionarProducto(form, productoId) {
  await form.getByLabel('Producto', { exact: true }).selectOption(productoId)
}

async function llenarMerma(form, { producto = PRODUCTO_HIELO, cantidad = '4', motivo = 'Merma de prueba browser' } = {}) {
  await seleccionarProducto(form, producto)
  await form.getByLabel('Cantidad', { exact: true }).fill(cantidad)
  await form.getByLabel('Motivo', { exact: true }).fill(motivo)
}

function formularioMerma(page) {
  return page.getByRole('form', { name: 'Registrar merma' })
}

function tablaMermas(page) {
  return page.getByRole('table', { name: 'Mermas de la sucursal' })
}

const hoy = fechaSantiago()
const ayer = sumarDias(hoy, -1)
const hace31 = sumarDias(hoy, -31)
const hoyVisible = fechaVisible(hoy)

const viewports = [
  { width: 375, height: 812 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
]

try {
  for (const viewport of viewports) {
    const sufijo = `${viewport.width}x${viewport.height}`
    const esMovil = viewport.width < 640

    await ejecutarEscenario({
      nombre: 'registro-merma-bodega',
      rol: 'bodega',
      ruta: '/mermas',
      viewport,
      accion: async ({ page, checks, failures, estado }) => {
        const form = formularioMerma(page)
        await form.waitFor()
        const tabla = tablaMermas(page)
        await tabla.waitFor()

        checks.origenInicial = await form.getByLabel('Origen', { exact: true }).inputValue()
        checks.itemInicial = await form.getByLabel('Qué se perdió', { exact: true }).inputValue()
        if (checks.origenInicial !== 'bodega') failures.push(`Default origin was ${checks.origenInicial}`)
        if (checks.itemInicial !== 'producto') failures.push(`Default bodega item was ${checks.itemInicial}`)

        const opciones = await form.getByLabel('Producto', { exact: true }).locator('option').allTextContents()
        checks.productos = opciones
        if (opciones.some((texto) => texto.includes('Producto retirado'))) {
          failures.push('The product selector offers an inactive product')
        }

        const motivo = `Merma browser ${sufijo}`
        await llenarMerma(form, { producto: PRODUCTO_HIELO, cantidad: '4', motivo })
        const submit = form.getByRole('button', { name: 'Registrar merma', exact: true })
        const aumentar = form.getByRole('button', { name: 'Aumentar', exact: true })
        const disminuir = form.getByRole('button', { name: 'Disminuir', exact: true })
        checks.objetivos = [
          await medirBoton(submit, 'Registrar merma'),
          await medirBoton(aumentar, 'Aumentar'),
          await medirBoton(disminuir, 'Disminuir'),
        ]
        const bajos = checks.objetivos.filter((medida) => medida.height < 44)
        if (bajos.length > 0) failures.push(`Touch targets under 44px: ${JSON.stringify(bajos)}`)

        checks.layoutFormulario = await medirLayout(page)
        if (checks.layoutFormulario.scrollWidth > checks.layoutFormulario.innerWidth
          || checks.layoutFormulario.bodyScrollWidth > checks.layoutFormulario.innerWidth) {
          failures.push(`Horizontal scroll on /mermas: ${JSON.stringify(checks.layoutFormulario)}`)
        }
        checks.tabla = await medirTablaMermas(page)
        if (esMovil) {
          if (checks.tabla.tableDisplay !== 'block' || checks.tabla.rowDisplay !== 'grid') {
            failures.push(`Expected mermas cards under 640px: ${JSON.stringify(checks.tabla)}`)
          }
        } else if (checks.tabla.tableDisplay !== 'table' || checks.tabla.rowDisplay !== 'table-row') {
          failures.push(`Expected the mermas table from 640px: ${JSON.stringify(checks.tabla)}`)
        }

        await page.screenshot({ path: `${out}/01-formulario-merma-${sufijo}.png` })

        const antes = { mermas: estado.getMermas, despachos: estado.getDespachos }
        checks.registrosAntes = await page.getByText('3 registros', { exact: true }).innerText()
        await submit.click()
        await page.getByText('Merma registrada.', { exact: true }).waitFor()
        await esperarHasta(async () => await page.getByText('4 registros', { exact: true }).count() === 1, 5000,
          'the mermas list to refresh after the registration')
        await esperarHasta(() => estado.getMermas > antes.mermas, 5000, 'a mermas GET after the registration')
        await tabla.getByText(motivo).waitFor()

        checks.registrosDespues = await page.getByText('4 registros', { exact: true }).innerText()
        checks.rpc = estado.rpcRegistrar
        checks.peticionesRpc = estado.rpcRegistrar.length
        if (checks.peticionesRpc !== 1) failures.push(`Expected exactly one registrar_merma_bodega POST, saw ${checks.peticionesRpc}`)
        const cuerpo = estado.rpcRegistrar[0] ?? {}
        checks.cuerpo = cuerpo
        const clavesEsperadas = [
          'p_sucursal_id', 'p_origen', 'p_despacho_id', 'p_producto_id', 'p_tipo_empaque_id',
          'p_cantidad', 'p_motivo', 'p_idempotency_key',
        ]
        comprobar(JSON.stringify(Object.keys(cuerpo).sort()) === JSON.stringify([...clavesEsperadas].sort()),
          `Unexpected RPC argument names: ${JSON.stringify(Object.keys(cuerpo))}`, failures)
        comprobar(cuerpo.p_sucursal_id === SUCURSAL_ID, `RPC branch was ${cuerpo.p_sucursal_id}`, failures)
        comprobar(cuerpo.p_origen === 'bodega', `RPC origin was ${cuerpo.p_origen}`, failures)
        comprobar(cuerpo.p_despacho_id === null, 'RPC p_despacho_id was not an explicit null', failures)
        comprobar(cuerpo.p_producto_id === PRODUCTO_HIELO, `RPC product was ${cuerpo.p_producto_id}`, failures)
        comprobar(cuerpo.p_tipo_empaque_id === null, 'RPC p_tipo_empaque_id was not an explicit null', failures)
        comprobar(cuerpo.p_cantidad === 4, `RPC quantity was ${cuerpo.p_cantidad}`, failures)
        comprobar(cuerpo.p_motivo === motivo, `RPC reason was ${cuerpo.p_motivo}`, failures)
        comprobar(UUID.test(cuerpo.p_idempotency_key ?? ''), `Idempotency key is not a UUID: ${cuerpo.p_idempotency_key}`, failures)

        checks.formularioReiniciado = {
          producto: await form.getByLabel('Producto', { exact: true }).inputValue(),
          cantidad: await form.getByLabel('Cantidad', { exact: true }).inputValue(),
          motivo: await form.getByLabel('Motivo', { exact: true }).inputValue(),
        }
        if (checks.formularioReiniciado.producto !== '' || checks.formularioReiniciado.cantidad !== ''
          || checks.formularioReiniciado.motivo !== '') {
          failures.push(`The form was not reset after success: ${JSON.stringify(checks.formularioReiniciado)}`)
        }

        checks.filas = await tabla.getByRole('row').count()
        checks.refresco = {
          mermasGetAntes: antes.mermas,
          mermasGetDespues: estado.getMermas,
          despachosGetAntes: antes.despachos,
          despachosGetDespues: estado.getDespachos,
        }
        await page.screenshot({ path: `${out}/02-mermas-actualizadas-${sufijo}.png`, fullPage: true })
      },
    })

    await ejecutarEscenario({
      nombre: 'cuadre-diario',
      rol: 'bodega',
      ruta: '/cuadre-diario',
      viewport,
      accion: async ({ page, checks, failures, estado }) => {
        await page.getByRole('heading', { name: 'Cuadre diario', exact: true }).waitFor()
        const tabla = page.getByRole('table', { name: 'Cuadre diario por vendedor y producto' })
        await tabla.waitFor()

        checks.desde = await page.locator('#cuadre-desde').inputValue()
        checks.hasta = await page.locator('#cuadre-hasta').inputValue()
        if (checks.desde !== hoy || checks.hasta !== hoy) {
          failures.push(`The default range is not today (${hoy}): ${checks.desde}..${checks.hasta}`)
        }
        checks.rpc = estado.rpcCuadre
        checks.peticionesRpc = estado.rpcCuadre.length
        if (checks.peticionesRpc !== 1) failures.push(`Expected one cuadre_diario_bodega POST on load, saw ${checks.peticionesRpc}`)
        const cuerpo = estado.rpcCuadre[0] ?? {}
        checks.cuerpo = cuerpo
        comprobar(JSON.stringify(Object.keys(cuerpo).sort())
          === JSON.stringify(['p_desde', 'p_hasta', 'p_sucursal_id', 'p_vendedor_id'].sort()),
        `Unexpected cuadre argument names: ${JSON.stringify(Object.keys(cuerpo))}`, failures)
        comprobar(cuerpo.p_sucursal_id === SUCURSAL_ID, `Cuadre branch was ${cuerpo.p_sucursal_id}`, failures)
        comprobar(cuerpo.p_desde === hoy && cuerpo.p_hasta === hoy, `Cuadre range was ${cuerpo.p_desde}..${cuerpo.p_hasta}`, failures)
        comprobar(cuerpo.p_vendedor_id === null, 'Cuadre p_vendedor_id was not an explicit null', failures)

        checks.estilos = await medirTablaCuadre(page)
        if (esMovil) {
          if (checks.estilos.tableDisplay !== 'block' || checks.estilos.rowDisplay !== 'grid'
            || checks.estilos.mobileLabelDisplay !== 'block') {
            failures.push(`Expected cuadre cards under 640px: ${JSON.stringify(checks.estilos)}`)
          }
        } else if (checks.estilos.tableDisplay !== 'table' || checks.estilos.rowDisplay !== 'table-row'
          || checks.estilos.mobileLabelDisplay !== 'none') {
          failures.push(`Expected the cuadre table from 640px: ${JSON.stringify(checks.estilos)}`)
        }

        checks.comparacionNoDisponible = await tabla.getByText('Comparación no disponible', { exact: true }).count()
        if (checks.comparacionNoDisponible !== 1) {
          failures.push(`Expected one "Comparación no disponible" row, saw ${checks.comparacionNoDisponible}`)
        }
        checks.comparacionDisponible = {
          saldoInicial: await page.getByText(/Saldo inicial:\s*7/).count(),
          cargaActual: await page.getByText(/Carga actual \(hoy\):\s*10/).count(),
          diferencia: await page.getByText(/Diferencia:\s*0/).count(),
        }
        if (checks.comparacionDisponible.saldoInicial !== 1 || checks.comparacionDisponible.cargaActual !== 1
          || checks.comparacionDisponible.diferencia !== 1) {
          failures.push(`Comparison values were not rendered: ${JSON.stringify(checks.comparacionDisponible)}`)
        }

        checks.inactivo = {
          fila: await tabla.getByText(/Iván Retirado \(inactivo\)/).count(),
          opcion: await page.getByRole('option', { name: 'Iván Retirado (inactivo)', exact: true }).count(),
        }
        if (checks.inactivo.fila !== 1 || checks.inactivo.opcion !== 1) {
          failures.push(`The inactive seller is not labeled from the historical roster: ${JSON.stringify(checks.inactivo)}`)
        }

        const actualizar = page.getByRole('button', { name: 'Actualizar', exact: true })
        checks.objetivos = [await medirBoton(actualizar, 'Actualizar')]
        const bajos = checks.objetivos.filter((medida) => medida.height < 44)
        if (bajos.length > 0) failures.push(`Touch targets under 44px: ${JSON.stringify(bajos)}`)

        checks.layout = await medirLayout(page)
        if (checks.layout.scrollWidth > checks.layout.innerWidth
          || checks.layout.bodyScrollWidth > checks.layout.innerWidth) {
          failures.push(`Horizontal scroll on /cuadre-diario: ${JSON.stringify(checks.layout)}`)
        }
        await page.screenshot({ path: `${out}/03-cuadre-${sufijo}.png`, fullPage: true })

        const consultasAntes = estado.rpcCuadre.length
        await page.locator('#cuadre-desde').fill(hace31)
        await page.getByText('El rango no puede superar 31 días.', { exact: true }).waitFor()
        checks.rangoInvalido = {
          mensaje: await page.getByText('El rango no puede superar 31 días.', { exact: true }).innerText(),
          guia: await page.getByText('Corrige el rango de fechas para consultar el cuadre.', { exact: true }).count(),
          consultas: estado.rpcCuadre.length - consultasAntes,
        }
        if (checks.rangoInvalido.guia !== 1) failures.push('The invalid-range guidance is missing')
        if (checks.rangoInvalido.consultas !== 0) failures.push('A range over 31 days still queried the cuadre RPC')
        await page.screenshot({ path: `${out}/04-cuadre-rango-${sufijo}.png`, fullPage: true })

        await page.locator('#cuadre-desde').fill(ayer)
        await esperarHasta(() => estado.rpcCuadre.length === consultasAntes + 1, 5000, 'the valid range query')
        const corregido = estado.rpcCuadre.at(-1) ?? {}
        checks.rangoCorregido = corregido
        if (corregido.p_desde !== ayer || corregido.p_hasta !== hoy) {
          failures.push(`Corrected range sent ${corregido.p_desde}..${corregido.p_hasta}`)
        }
        await page.getByText('El rango no puede superar 31 días.', { exact: true }).waitFor({ state: 'detached' })
      },
    })

    await ejecutarEscenario({
      nombre: 'anulacion-administrador',
      rol: 'administrador',
      ruta: '/mermas',
      viewport,
      accion: async ({ page, checks, failures, estado }) => {
        const form = formularioMerma(page)
        await form.waitFor()
        const tabla = tablaMermas(page)
        await tabla.waitFor()

        // The branch label wraps its select, so its computed label text includes the
        // options; locate the control by the branch option it offers instead.
        const selectorSucursal = page.locator('select').filter({
          has: page.getByRole('option', { name: 'Sucursal Sintética', exact: true }),
        })
        checks.sucursal = {
          visible: await selectorSucursal.count(),
          opciones: await selectorSucursal.locator('option').allTextContents(),
        }
        if (checks.sucursal.visible !== 1 || checks.sucursal.opciones.length < 2) {
          failures.push(`Administration does not get the branch selector: ${JSON.stringify(checks.sucursal)}`)
        }

        const botones = tabla.getByRole('button', { name: /^Anular merma de/ })
        checks.botonesAntes = await botones.count()
        checks.columnas = await tabla.getByRole('columnheader', { name: 'Acción', exact: true }).count()
        if (checks.botonesAntes !== 2) failures.push(`Expected 2 active-loss "Anular" buttons, saw ${checks.botonesAntes}`)
        if (checks.columnas !== 1) failures.push('The admin table is missing the "Acción" column')
        const anular = botones.first()
        checks.objetivos = [await medirBoton(anular, 'Anular')]

        await anular.click()
        const dialogo = page.getByRole('dialog', { name: 'Anular merma', exact: true })
        await dialogo.waitFor()
        const confirmar = dialogo.getByRole('button', { name: 'Anular merma', exact: true })
        checks.objetivos.push(await medirBoton(confirmar, 'Anular merma (confirmar)'))
        const bajos = checks.objetivos.filter((medida) => medida.height < 44)
        if (bajos.length > 0) failures.push(`Touch targets under 44px: ${JSON.stringify(bajos)}`)

        checks.layoutDialogo = await medirLayout(page)
        if (checks.layoutDialogo.scrollWidth > checks.layoutDialogo.innerWidth
          || checks.layoutDialogo.bodyScrollWidth > checks.layoutDialogo.innerWidth) {
          failures.push(`Horizontal scroll with the cancellation dialog open: ${JSON.stringify(checks.layoutDialogo)}`)
        }
        await page.screenshot({ path: `${out}/05-anular-modal-${sufijo}.png` })

        await confirmar.click()
        await dialogo.getByText('Indica el motivo de la anulación.', { exact: true }).waitFor()
        checks.anulacionesTrasMotivoVacio = estado.rpcAnular.length
        if (checks.anulacionesTrasMotivoVacio !== 0) failures.push('The cancellation ran without its own reason')

        await dialogo.getByLabel('Motivo de la anulación', { exact: true }).fill('Error de conteo')
        await confirmar.click()
        await page.getByText('Merma anulada.', { exact: true }).waitFor()
        await dialogo.waitFor({ state: 'hidden' })
        await esperarHasta(async () => await botones.count() === checks.botonesAntes - 1, 5000,
          'the mermas list to refresh after the cancellation')
        await esperarHasta(async () => await tabla.getByText('Anulada', { exact: true }).count() === 2, 5000,
          'the cancelled loss to show as anulada')

        checks.rpc = estado.rpcAnular
        checks.peticionesRpc = estado.rpcAnular.length
        if (checks.peticionesRpc !== 1) failures.push(`Expected exactly one anular_merma_bodega POST, saw ${checks.peticionesRpc}`)
        const cuerpo = estado.rpcAnular[0] ?? {}
        checks.cuerpo = cuerpo
        comprobar(JSON.stringify(Object.keys(cuerpo).sort()) === JSON.stringify(['p_merma_id', 'p_motivo'].sort()),
          `Unexpected cancellation argument names: ${JSON.stringify(Object.keys(cuerpo))}`, failures)
        comprobar(cuerpo.p_merma_id === MERMA_PRODUCTO, `Cancelled loss was ${cuerpo.p_merma_id}`, failures)
        comprobar(cuerpo.p_motivo === 'Error de conteo', `Cancellation reason was ${cuerpo.p_motivo}`, failures)
        checks.registrar = estado.rpcRegistrar.length
        if (checks.registrar !== 0) failures.push('The admin cancellation also registered a new loss')

        checks.botonesDespues = await botones.count()
        checks.estados = await tabla.getByText('Anulada', { exact: true }).count()
        await page.screenshot({ path: `${out}/06-anulada-${sufijo}.png`, fullPage: true })
      },
    })
  }

  await ejecutarEscenario({
    nombre: 'reintento-tras-fallo-red',
    rol: 'bodega',
    ruta: '/mermas',
    viewport: { width: 1280, height: 800 },
    registrar: 'falloRed',
    accion: async ({ page, checks, failures, estado }) => {
      const form = formularioMerma(page)
      await form.waitFor()
      const tabla = tablaMermas(page)
      await tabla.waitFor()
      const motivo = 'Merma reintentada tras fallo de red'
      const submit = form.getByRole('button', { name: 'Registrar merma', exact: true })
      await llenarMerma(form, { producto: PRODUCTO_AGUA, cantidad: '2', motivo })

      await submit.click()
      const alerta = form.getByRole('alert')
      await alerta.waitFor()
      checks.mensajeFallo = (await alerta.innerText()).replace(/\s+/g, ' ').trim()
      if (!checks.mensajeFallo) failures.push('The network failure did not surface an error')
      checks.claveTrasFallo = estado.rpcRegistrar[0]?.p_idempotency_key
      checks.formularioTrasFallo = {
        producto: await form.getByLabel('Producto', { exact: true }).inputValue(),
        cantidad: await form.getByLabel('Cantidad', { exact: true }).inputValue(),
        motivo: await form.getByLabel('Motivo', { exact: true }).inputValue(),
      }
      if (checks.formularioTrasFallo.producto !== PRODUCTO_AGUA
        || checks.formularioTrasFallo.cantidad !== '2'
        || checks.formularioTrasFallo.motivo !== motivo) {
        failures.push(`The form lost its values after the network failure: ${JSON.stringify(checks.formularioTrasFallo)}`)
      }

      await submit.click()
      await page.getByText('Merma registrada.', { exact: true }).waitFor()
      await esperarHasta(async () => await page.getByText('4 registros', { exact: true }).count() === 1, 5000,
        'the mermas list to refresh after the retry')
      await tabla.getByText(motivo).waitFor()

      checks.claves = estado.rpcRegistrar.map((cuerpo) => cuerpo.p_idempotency_key)
      checks.peticionesRpc = estado.rpcRegistrar.length
      if (checks.peticionesRpc !== 2) failures.push(`Expected the failed submit plus one retry, saw ${checks.peticionesRpc}`)
      if (checks.claves[0] !== checks.claves[1]) failures.push(`The retry changed the idempotency key: ${JSON.stringify(checks.claves)}`)
      if (!UUID.test(checks.claves[0] ?? '')) failures.push(`Idempotency key is not a UUID: ${checks.claves[0]}`)
      if (checks.claveTrasFallo !== checks.claves[0]) failures.push('The first recorded key does not match the retry')
      await page.screenshot({ path: `${out}/07-reintento-red-1280x800.png`, fullPage: true })
    },
  })

  await ejecutarEscenario({
    nombre: 'doble-click',
    rol: 'bodega',
    ruta: '/mermas',
    viewport: { width: 1280, height: 800 },
    registrar: 'lento',
    accion: async ({ page, checks, failures, estado }) => {
      const form = formularioMerma(page)
      await form.waitFor()
      await tablaMermas(page).waitFor()
      const motivo = 'Merma con doble clic'
      const submit = form.getByRole('button', { name: 'Registrar merma', exact: true })
      await llenarMerma(form, { producto: PRODUCTO_HIELO, cantidad: '3', motivo })

      await submit.dblclick()
      await page.getByText('Merma registrada.', { exact: true }).waitFor()
      await esperar(800)

      checks.peticionesRpc = estado.rpcRegistrar.length
      checks.claves = estado.rpcRegistrar.map((cuerpo) => cuerpo.p_idempotency_key)
      if (checks.peticionesRpc !== 1) failures.push(`A double click sent ${checks.peticionesRpc} requests`)
      if (!checks.claves.every((clave) => UUID.test(clave ?? ''))) failures.push('A double-click request lacked a UUID key')
      await page.screenshot({ path: `${out}/08-doble-click-1280x800.png`, fullPage: true })
    },
  })

  await ejecutarEscenario({
    nombre: 'validacion-cliente',
    rol: 'bodega',
    ruta: '/mermas',
    viewport: { width: 1280, height: 800 },
    accion: async ({ page, checks, failures, estado }) => {
      const form = formularioMerma(page)
      await form.waitFor()
      await tablaMermas(page).waitFor()
      const submit = form.getByRole('button', { name: 'Registrar merma', exact: true })
      const cantidad = form.getByLabel('Cantidad', { exact: true })
      const motivo = form.getByLabel('Motivo', { exact: true })

      await seleccionarProducto(form, PRODUCTO_HIELO)
      await cantidad.fill('3')
      await submit.click()
      await form.getByText('Indica el motivo de la merma.', { exact: true }).waitFor()
      checks.motivoVacio = {
        mensaje: await form.getByText('Indica el motivo de la merma.', { exact: true }).innerText(),
        peticiones: estado.rpcRegistrar.length,
      }
      if (checks.motivoVacio.peticiones !== 0) failures.push('A blank reason reached the database')
      await page.screenshot({ path: `${out}/09-validacion-motivo-1280x800.png` })

      await motivo.fill('Prueba de validación')
      await cantidad.fill('0')
      checks.cantidadCero = await cantidad.inputValue()
      await submit.click()
      await form.getByText('Ingresa una cantidad mayor que cero.', { exact: true }).waitFor()
      checks.cantidadNoPositiva = {
        mensaje: await form.getByText('Ingresa una cantidad mayor que cero.', { exact: true }).innerText(),
        peticiones: estado.rpcRegistrar.length,
        motivo: await motivo.inputValue(),
        producto: await form.getByLabel('Producto', { exact: true }).inputValue(),
      }
      if (checks.cantidadNoPositiva.peticiones !== 0) failures.push('A non-positive quantity reached the database')
      await page.screenshot({ path: `${out}/10-validacion-cantidad-1280x800.png` })
    },
  })

  await ejecutarEscenario({
    nombre: 'error-stock-servidor',
    rol: 'bodega',
    ruta: '/mermas',
    viewport: { width: 1280, height: 800 },
    registrar: 'errorStock',
    accion: async ({ page, checks, failures, estado }) => {
      const form = formularioMerma(page)
      await form.waitFor()
      await tablaMermas(page).waitFor()
      const motivo = 'Merma sin saldo suficiente'
      const submit = form.getByRole('button', { name: 'Registrar merma', exact: true })
      await llenarMerma(form, { producto: PRODUCTO_HIELO, cantidad: '9999', motivo })

      await submit.click()
      const alerta = form.getByRole('alert')
      await alerta.waitFor()
      checks.mensaje = (await alerta.innerText()).replace(/\s+/g, ' ').trim()
      checks.mensajeEsperado = 'No hay stock o carga suficiente para registrar la merma.'
      if (checks.mensaje !== checks.mensajeEsperado) failures.push(`Unexpected stock-error message: ${checks.mensaje}`)
      checks.formulario = {
        producto: await form.getByLabel('Producto', { exact: true }).inputValue(),
        cantidad: await form.getByLabel('Cantidad', { exact: true }).inputValue(),
        motivo: await form.getByLabel('Motivo', { exact: true }).inputValue(),
      }
      if (checks.formulario.producto !== PRODUCTO_HIELO || checks.formulario.cantidad !== '9.999'
        || checks.formulario.motivo !== motivo) {
        failures.push(`The form lost its values after the stock error: ${JSON.stringify(checks.formulario)}`)
      }
      checks.peticionesRpc = estado.rpcRegistrar.length
      if (checks.peticionesRpc !== 1) failures.push(`Expected one rejected registrar_merma_bodega POST, saw ${checks.peticionesRpc}`)
      checks.registros = await page.getByText('3 registros', { exact: true }).count()
      if (checks.registros !== 1) failures.push('A rejected loss altered the list total')
      await page.screenshot({ path: `${out}/11-error-stock-1280x800.png` })
    },
  })

  await ejecutarEscenario({
    nombre: 'sin-anular-bodega',
    rol: 'bodega',
    ruta: '/mermas',
    viewport: { width: 1280, height: 800 },
    accion: async ({ page, checks, failures }) => {
      const tabla = tablaMermas(page)
      await tabla.waitFor()
      checks.acciones = await tabla.getByRole('button', { name: /^Anular merma de/ }).count()
      checks.columna = await tabla.getByRole('columnheader', { name: 'Acción', exact: true }).count()
      checks.anularTexto = await tabla.getByRole('button', { name: 'Anular', exact: true }).count()
      if (checks.acciones !== 0 || checks.columna !== 0 || checks.anularTexto !== 0) {
        failures.push(`Bodega sees the cancellation action: ${JSON.stringify(checks)}`)
      }
      await page.screenshot({ path: `${out}/12-sin-anular-bodega-1280x800.png`, fullPage: true })
    },
  })

  await ejecutarEscenario({
    nombre: 'cuadre-vacio',
    rol: 'bodega',
    ruta: '/cuadre-diario',
    viewport: { width: 1280, height: 800 },
    cuadre: 'vacio',
    accion: async ({ page, checks, failures, estado }) => {
      await page.getByRole('heading', { name: 'Cuadre diario', exact: true }).waitFor()
      const mensaje = `No hay movimientos entre ${hoyVisible} y ${hoyVisible}.`
      await page.getByText(mensaje, { exact: true }).waitFor()
      checks.mensaje = await page.getByText(mensaje, { exact: true }).innerText()
      checks.tabla = await page.getByRole('table', { name: 'Cuadre diario por vendedor y producto' }).count()
      checks.peticionesRpc = estado.rpcCuadre.length
      if (checks.tabla !== 0) failures.push('The empty cuadre still rendered a table')
      if (checks.peticionesRpc !== 1) failures.push(`Expected one empty-range query, saw ${checks.peticionesRpc}`)
      await page.screenshot({ path: `${out}/13-cuadre-vacio-1280x800.png`, fullPage: true })
    },
  })
} finally {
  await browser.close()
}

const failures = results.flatMap((result) => result.failures.map((failure) => `${result.scenario} ${result.viewport}: ${failure}`))
const passed = results.filter((result) => result.status === 'PASS').length
const summary = {
  total: results.length,
  passed,
  failed: results.length - passed,
  viewports: viewports.map((viewport) => `${viewport.width}x${viewport.height}`),
  syntheticToday: hoy,
}
const evidence = {
  generatedAt: new Date().toISOString(),
  base,
  supabaseOrigin,
  summary,
  allowedWrites: [...ESCRITURAS_PERMITIDAS],
  readRpcs: [...RPC_LECTURA],
  results,
  failures,
}
writeFileSync(`${out}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`)

const report = {
  generatedAt: evidence.generatedAt,
  task: 'HU-29 — registro de mermas de bodega y cuadre diario (verificación de navegador)',
  base,
  supabaseOrigin,
  browser: 'Google Chrome (local /usr/bin/google-chrome)',
  playwrightModule: process.env.HU29_PLAYWRIGHT_MODULE ?? 'playwright',
  summary,
  allowedWrites: [...ESCRITURAS_PERMITIDAS],
  readRpcs: [...RPC_LECTURA],
  scenarios: results.map(({ scenario, role, path, viewport, status, checks, failures: fallos }) => ({
    scenario, role, path, viewport, status, checks, failures: fallos,
  })),
  failures,
  defects: failures.map((failure) => ({ description: failure, screenshot: null })),
}
writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`)

console.log(`\n${passed}/${results.length} scenarios passed across ${summary.viewports.join(', ')}`)
writeFileSync(`${out}/results.txt`, `${results.map((result) => `${result.status} ${result.scenario} ${result.viewport}`).join('\n')}\n`)
console.log(`${out}/results.txt`)
assert.deepEqual(failures, [], 'HU-29 bodega losses and daily reconciliation browser check')
