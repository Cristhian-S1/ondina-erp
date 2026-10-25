// Local-only browser check for HU-26: add products to a dispatch while its
// adjustment window is open. The app is served by `npm run dev` from frontend/
// and every Auth, REST and RPC request is intercepted here with synthetic data,
// so no backend is required. The only allowed write is the `ajustar_despacho`
// RPC POST; any other non-GET under `/rest/v1/` fails the run.
//
// Chrome is the locally installed binary. If Playwright is not resolvable from
// node_modules, point HU26_PLAYWRIGHT_MODULE at an installed module:
//   HU26_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { chromium } = await import(process.env.HU26_PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.HU26_BASE_URL ?? 'http://127.0.0.1:5192'
const supabase = process.env.HU26_SUPABASE_URL ?? 'http://127.0.0.1:54321'
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'HU26_BASE_URL must be local')
assert.match(supabase, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'HU26_SUPABASE_URL must be local')
const supabaseOrigin = new URL(supabase).origin

const out = fileURLToPath(new URL('../../docs/archive/audits/2026-10-25/frontend/hu26/', import.meta.url))
mkdirSync(out, { recursive: true })

const USER_ID = '00000000-0000-4000-8000-000000000026'
const SUCURSAL_ID = '00000000-0000-4000-8000-000000000001'
const VENDEDOR_ID = '00000000-0000-4000-8000-000000000101'
const DESPACHO_ID = '11111111-1111-4111-8111-111111111126'
const DETALLE_ORIGINAL_ID = '22222222-2222-4222-8222-222222222201'
const DETALLE_AJUSTE_ID = '22222222-2222-4222-8222-222222222202'
const PRODUCTO_AGUA = '44444444-4444-4444-8444-444444444444'
const PRODUCTO_HIELO = '55555555-5555-4555-8555-555555555555'
const TIPO_BANDEJA = '66666666-6666-4666-8666-666666666666'
const TIPO_BIDON = '77777777-7777-4777-8777-777777777777'
const EMAIL = 'ux-hu26@example.invalid'
const RPC_AJUSTE = '/rest/v1/rpc/ajustar_despacho'
// Read-only RPCs are POST at the HTTP level but do not mutate data.
const RPC_LECTURA = new Set([
  '/rest/v1/rpc/vendedores_sucursal',
  '/rest/v1/rpc/vendedores_historial_sucursal',
])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const perfil = {
  id: USER_ID,
  sucursal_id: SUCURSAL_ID,
  nombres: 'Sofía',
  apellidos: 'Bodega',
  rut: '11.111.111-1',
  telefono: null,
  rol: 'bodega',
  activo: true,
  creado_en: '2026-01-01T00:00:00Z',
}

const sucursal = {
  id: SUCURSAL_ID,
  nombre: 'Sucursal Sintética',
  direccion: null,
  comuna: null,
  region: null,
  telefono: null,
  activa: true,
  creado_en: '2026-01-01T00:00:00Z',
}

const vendedor = { id: VENDEDOR_ID, nombres: 'Valentina', apellidos: 'Rojas' }

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const accessToken = [
  encode({ alg: 'HS256', typ: 'JWT' }),
  encode({ sub: USER_ID, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }),
  'synthetic-signature',
].join('.')

const authUser = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: EMAIL,
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  is_anonymous: false,
}

const session = {
  access_token: accessToken,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'synthetic-refresh-token',
  user: authUser,
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers':
    'authorization, apikey, content-type, accept, accept-profile, content-profile, prefer, range, x-client-info, x-supabase-api-version',
  'access-control-expose-headers': 'content-range, range-unit',
  'access-control-max-age': '600',
}

// `minutos` drives the client-side window hint: 2 is inside the 15-minute
// window, 30 is outside it. The database remains the real authority.
function crearFixture(minutos) {
  const creadoEn = new Date(Date.now() - minutos * 60_000).toISOString()
  return {
    ventanaExpiraEn: new Date(Date.parse(creadoEn) + 15 * 60_000).toISOString(),
    despacho: {
      id: DESPACHO_ID,
      sucursal_id: SUCURSAL_ID,
      vendedor_id: VENDEDOR_ID,
      despachador_id: USER_ID,
      anulado: false,
      creado_por: USER_ID,
      creado_en: creadoEn,
      modificado_por: null,
      modificado_en: null,
    },
    detalles: [
      {
        id: DETALLE_ORIGINAL_ID,
        despacho_id: DESPACHO_ID,
        producto_id: PRODUCTO_AGUA,
        cantidad: 12,
        es_ajuste: false,
        creado_en: creadoEn,
      },
    ],
    envases: [
      {
        id: '33333333-3333-4333-8333-333333333301',
        despacho_id: DESPACHO_ID,
        tipo_empaque_id: TIPO_BANDEJA,
        cantidad: 2,
        es_ajuste: false,
        creado_en: creadoEn,
      },
    ],
    productos: [
      { id: PRODUCTO_AGUA, nombre: 'Agua 20L', tipo: 'agua', tipo_empaque_id: TIPO_BIDON, precio_base: 1000, activo: true, creado_en: '2026-01-01T00:00:00Z' },
      { id: PRODUCTO_HIELO, nombre: 'Hielo en bolsa 2kg', tipo: 'hielo', tipo_empaque_id: null, precio_base: 800, activo: true, creado_en: '2026-01-01T00:00:00Z' },
    ],
    tiposEmpaque: [
      { id: TIPO_BANDEJA, nombre: 'Bandeja', categoria: 'uso_interno', activo: true },
      { id: TIPO_BIDON, nombre: 'Bidón 20L', categoria: 'retornable', activo: true },
    ],
    stockBodega: [
      { sucursal_id: SUCURSAL_ID, producto_id: PRODUCTO_AGUA, cantidad: 200, modificado_en: creadoEn },
      { sucursal_id: SUCURSAL_ID, producto_id: PRODUCTO_HIELO, cantidad: 100, modificado_en: creadoEn },
    ],
    stockEnvases: [
      { sucursal_id: SUCURSAL_ID, tipo_empaque_id: TIPO_BANDEJA, cantidad: 20, modificado_en: creadoEn },
      { sucursal_id: SUCURSAL_ID, tipo_empaque_id: TIPO_BIDON, cantidad: 30, modificado_en: creadoEn },
    ],
    cargaVendedor: [
      { vendedor_id: VENDEDOR_ID, producto_id: PRODUCTO_AGUA, cantidad: 5, modificado_en: creadoEn },
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

async function iniciarSesion(page) {
  await page.goto(`${base}/login`)
  await page.locator('#login-email').fill(EMAIL)
  await page.locator('#login-password').fill('ux-local-2026')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.includes('login'))
  await page.getByRole('heading', { name: `Hola, ${perfil.nombres}`, exact: true }).waitFor()
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function esperarHasta(condicion, timeoutMs, descripcion) {
  const limite = Date.now() + timeoutMs
  while (Date.now() < limite) {
    if (condicion()) return
    await esperar(50)
  }
  throw new Error(`Timed out waiting for ${descripcion}`)
}

const results = []

async function ejecutarEscenario({ nombre, minutos, modoRpc, viewport, accion }) {
  const fixture = crearFixture(minutos)
  const context = await browser.newContext({ viewport, locale: 'es-CL' })
  const page = await context.newPage()
  const observado = {
    errores: [],
    escrituras: [],
    inesperadas: [],
    peticiones: [],
    noGet: [],
    rpc: [],
    conteos: { despachos: 0, detalles: 0 },
  }
  const respuestasPorClave = new Map()
  const checks = {}
  const failures = []

  page.on('pageerror', (error) => observado.errores.push({ text: error.message, url: null }))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      observado.errores.push({ text: message.text(), url: message.location().url || null })
    }
  })
  page.on('requestfailed', (request) => {
    observado.errores.push({ text: `${request.method()} ${request.url()}: ${request.failure()?.errorText}`, url: request.url() })
  })

  await page.route((url) => url.origin === supabaseOrigin, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    observado.peticiones.push(`${method} ${url.pathname}`)
    if (method !== 'GET') observado.noGet.push(`${method} ${url.pathname}`)

    const json = (status, body, extra = {}) => route.fulfill({
      status,
      headers: { ...cors, 'content-type': 'application/json', ...extra },
      body: JSON.stringify(body),
    })

    if (url.pathname === '/auth/v1/token' && method === 'POST') {
      await json(200, session)
      return
    }
    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      await json(200, authUser)
      return
    }
    if (url.pathname === '/auth/v1/logout') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    // Every REST mutation other than the expected adjustment RPC is a failure.
    // Seller lookups are read-only RPCs despite using POST.
    if (url.pathname.startsWith('/rest/v1/') && method !== 'GET' && !RPC_LECTURA.has(url.pathname)) {
      observado.escrituras.push(`${method} ${url.pathname}`)
    }

    if (url.pathname === RPC_AJUSTE && method === 'POST') {
      const cuerpo = request.postDataJSON()
      observado.rpc.push(cuerpo)
      if (modoRpc === 'expirada') {
        await json(400, {
          code: 'P0001',
          details: null,
          hint: null,
          message: 'La ventana de ajuste del despacho expiró.',
        })
        return
      }
      if (modoRpc === 'lento') await esperar(600)
      const clave = cuerpo?.p_idempotency_key
      if (respuestasPorClave.has(clave)) {
        await json(200, respuestasPorClave.get(clave))
        return
      }
      const lineas = Array.isArray(cuerpo?.p_lineas) ? cuerpo.p_lineas : []
      const ids = []
      for (const linea of lineas) {
        ids.push(DETALLE_AJUSTE_ID)
        fixture.detalles.push({
          id: DETALLE_AJUSTE_ID,
          despacho_id: cuerpo.p_despacho_id,
          producto_id: linea.producto_id,
          cantidad: linea.cantidad,
          es_ajuste: true,
          creado_en: new Date().toISOString(),
        })
      }
      const respuesta = {
        despacho_id: cuerpo?.p_despacho_id,
        lineas_agregadas: ids,
        ventana_expira_en: fixture.ventanaExpiraEn,
      }
      respuestasPorClave.set(clave, respuesta)
      await json(200, respuesta)
      return
    }

    if (url.pathname === '/rest/v1/rpc/vendedores_sucursal' && method === 'POST') {
      await json(200, [vendedor])
      return
    }
    if (url.pathname === '/rest/v1/rpc/vendedores_historial_sucursal' && method === 'POST') {
      await json(200, [{ ...vendedor, activo: true }])
      return
    }

    // PostgREST answers `.single()` with an object; supabase-js asks for it with
    // `Accept: application/vnd.pgrst.object+json`.
    const single = (request.headers().accept ?? '').includes('application/vnd.pgrst.object+json')

    if (method === 'GET' && url.pathname === '/rest/v1/perfiles') {
      await json(200, single ? perfil : [perfil])
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/sucursales') {
      await json(200, single ? sucursal : [sucursal])
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
      observado.conteos.despachos += 1
      await json(200, [fixture.despacho], { 'content-range': contentRange([fixture.despacho]) })
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/despacho_detalles') {
      observado.conteos.detalles += 1
      await json(200, fixture.detalles)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/despacho_envases') {
      await json(200, fixture.envases)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/devoluciones_productos') {
      await json(200, [])
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/devoluciones_envases') {
      await json(200, [])
      return
    }

    observado.inesperadas.push(`${method} ${url.pathname}`)
    await json(404, { message: `Unexpected synthetic request: ${method} ${url.pathname}` })
  })

  try {
    await iniciarSesion(page)
    await page.goto(`${base}/despachos`)
    await accion({ page, checks, failures, observado })
  } catch (error) {
    failures.push(`Scenario threw: ${error.message}`)
  }

  // Chrome logs the deliberate HTTP 400 of the expired-window scenario as a
  // console error; anything else is a finding.
  const erroresEsperados = modoRpc === 'expirada'
    ? observado.errores.filter((error) => error.url?.includes(RPC_AJUSTE) && /status of 400/.test(error.text))
    : []
  const erroresInesperados = observado.errores.filter((error) => !erroresEsperados.includes(error))
  if (erroresInesperados.length > 0) failures.push(`Browser errors: ${JSON.stringify(erroresInesperados)}`)
  const escriturasInesperadas = observado.escrituras.filter((w) => w !== `POST ${RPC_AJUSTE}`)
  if (escriturasInesperadas.length > 0) failures.push(`Unexpected database writes: ${JSON.stringify(escriturasInesperadas)}`)
  if (observado.inesperadas.length > 0) failures.push(`Unexpected requests: ${JSON.stringify(observado.inesperadas)}`)

  await context.close()

  results.push({
    scenario: nombre,
    viewport: `${viewport.width}x${viewport.height}`,
    modoRpc,
    checks,
    nonGetRequests: observado.noGet,
    expectedConsoleErrors: erroresEsperados.map((error) => error.text),
    failures,
  })
}

function historialDespachos(page) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Últimos despachos', exact: true }) })
}

async function expandirDespacho(page) {
  await page.getByRole('heading', { name: 'Despachos', exact: true }).waitFor()
  const lista = historialDespachos(page)
  await lista.getByRole('button', { name: /Valentina Rojas/ }).waitFor()
  await lista.getByRole('button', { name: /Valentina Rojas/ }).click()
  const detalle = page.locator(`#despacho-${DESPACHO_ID}`)
  await detalle.waitFor()
  return { lista, detalle }
}

function dialogoAjuste(page) {
  return page.getByRole('dialog', { name: 'Agregar productos al despacho', exact: true })
}

async function abrirAjuste(page) {
  const { lista, detalle } = await expandirDespacho(page)
  const accion = detalle.getByRole('button', { name: 'Agregar productos', exact: true })
  await accion.waitFor()
  await accion.click()
  const dialogo = dialogoAjuste(page)
  await dialogo.waitFor()
  return { lista, detalle, accion, dialogo }
}

async function llenarUnaLinea(dialogo) {
  await dialogo.getByLabel('Producto', { exact: true }).selectOption(PRODUCTO_HIELO)
  await dialogo.getByLabel('Cantidad', { exact: true }).fill('4')
  const cantidad = await dialogo.getByLabel('Cantidad', { exact: true }).inputValue()
  assert.equal(cantidad, '4', 'Quantity field did not accept 4')
}

function layoutsDePagina() {
  return {
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }
}

async function medirControles(scope) {
  return scope.locator('button, select, input').evaluateAll((elementos) => elementos
    .filter((elemento) => elemento.getClientRects().length > 0)
    .map((elemento) => {
      const rect = elemento.getBoundingClientRect()
      const etiqueta = elemento.getAttribute('aria-label')
        ?? elemento.labels?.[0]?.textContent?.trim()
        ?? elemento.textContent?.trim()
        ?? elemento.tagName
      return {
        control: etiqueta.replace(/\s+/g, ' ').slice(0, 60),
        tag: elemento.tagName.toLowerCase(),
        height: Math.round(rect.height * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
      }
    }))
}

async function medirBoton(locator, etiqueta) {
  const rect = await locator.evaluate((elemento) => {
    const caja = elemento.getBoundingClientRect()
    return { height: Math.round(caja.height * 100) / 100, width: Math.round(caja.width * 100) / 100 }
  })
  return { control: etiqueta, tag: 'button', ...rect }
}

const viewports = [
  { width: 412, height: 915 },
  { width: 1280, height: 800 },
]

try {
  for (const viewport of viewports) {
    const sufijo = `${viewport.width}x${viewport.height}`

    await ejecutarEscenario({
      nombre: 'ajuste-exitoso',
      minutos: 2,
      modoRpc: 'exito',
      viewport,
      accion: async ({ page, checks, failures, observado }) => {
        const { detalle, dialogo } = await abrirAjuste(page)

        checks.pista = (await dialogo.getByText(/ventana de ajuste/).innerText()).replace(/\s+/g, ' ').trim()
        if (!/Quedan \d+ min \d{2} s de la ventana de ajuste \(aprox\.\)\./.test(checks.pista)) {
          failures.push(`Unexpected window hint: ${checks.pista}`)
        }

        await llenarUnaLinea(dialogo)
        await page.screenshot({ path: `${out}/01-formulario-ajuste-${sufijo}.png` })

        const antes = { despachos: observado.conteos.despachos, detalles: observado.conteos.detalles }
        await dialogo.getByRole('button', { name: 'Agregar al despacho', exact: true }).click()

        await page.getByText('Productos agregados al despacho.', { exact: true }).waitFor()
        await dialogo.waitFor({ state: 'hidden' })
        await detalle.getByText(/Ajuste ·/).waitFor()
        await esperarHasta(
          () => observado.conteos.despachos > antes.despachos && observado.conteos.detalles > antes.detalles,
          5000,
          'the dispatch list and detail queries to refresh',
        )

        checks.rpc = observado.rpc
        checks.peticionesRpc = observado.rpc.length
        if (checks.peticionesRpc !== 1) failures.push(`Expected exactly one ajustar_despacho POST, saw ${checks.peticionesRpc}`)
        const cuerpo = observado.rpc[0] ?? {}
        checks.p_despacho_id = cuerpo.p_despacho_id
        checks.p_lineas = cuerpo.p_lineas
        checks.p_idempotency_key = cuerpo.p_idempotency_key
        if (cuerpo.p_despacho_id !== DESPACHO_ID) failures.push(`RPC dispatch id was ${cuerpo.p_despacho_id}`)
        assert.deepEqual(cuerpo.p_lineas, [{ producto_id: PRODUCTO_HIELO, cantidad: 4 }])
        if (!UUID.test(cuerpo.p_idempotency_key ?? '')) failures.push(`Idempotency key is not a UUID: ${cuerpo.p_idempotency_key}`)

        checks.detalle = (await detalle.innerText()).replace(/\s+/g, ' ').trim()
        if (!checks.detalle.includes('Hielo en bolsa 2kg')) failures.push('Adjusted product is missing from the dispatch detail')
        if (!checks.detalle.includes('Ajuste ·')) failures.push('Adjusted line is not marked "Ajuste"')
        if (!checks.detalle.includes('Agua 20L')) failures.push('Original dispatch line is missing after the refresh')

        checks.refresco = {
          despachosGetAntes: antes.despachos,
          despachosGetDespues: observado.conteos.despachos,
          detallesGetAntes: antes.detalles,
          detallesGetDespues: observado.conteos.detalles,
        }

        await page.screenshot({ path: `${out}/02-ajuste-aplicado-${sufijo}.png`, fullPage: true })
      },
    })

    await ejecutarEscenario({
      nombre: 'ventana-cerrada',
      minutos: 30,
      modoRpc: 'exito',
      viewport,
      accion: async ({ page, checks, failures, observado }) => {
        const { detalle } = await expandirDespacho(page)

        await detalle.getByText('La ventana de ajuste de este despacho está cerrada.', { exact: true }).waitFor()
        checks.accionVisible = await detalle.getByRole('button', { name: 'Agregar productos', exact: true }).count()
        checks.peticionesRpc = observado.rpc.length
        if (checks.accionVisible !== 0) failures.push('A 30-minute-old dispatch still offers "Agregar productos"')
        if (checks.peticionesRpc !== 0) failures.push('A closed-window dispatch sent an adjustment request')

        await page.screenshot({ path: `${out}/03-ventana-cerrada-${sufijo}.png`, fullPage: true })
      },
    })

    await ejecutarEscenario({
      nombre: 'ventana-expirada-servidor',
      minutos: 2,
      modoRpc: 'expirada',
      viewport,
      accion: async ({ page, checks, failures, observado }) => {
        const { dialogo } = await abrirAjuste(page)
        await llenarUnaLinea(dialogo)
        await dialogo.getByRole('button', { name: 'Agregar al despacho', exact: true }).click()

        const alerta = dialogo.getByRole('alert')
        await alerta.waitFor()
        checks.mensaje = (await alerta.innerText()).replace(/\s+/g, ' ').trim()
        checks.dialogoAbierto = await dialogo.isVisible()
        checks.cantidad = await dialogo.getByLabel('Cantidad', { exact: true }).inputValue()
        checks.producto = await dialogo.getByLabel('Producto', { exact: true }).inputValue()
        checks.peticionesRpc = observado.rpc.length

        if (checks.mensaje !== 'La ventana de ajuste del despacho expiró. Ya no se pueden agregar productos.') {
          failures.push(`Unexpected expired-window message: ${checks.mensaje}`)
        }
        if (!checks.dialogoAbierto) failures.push('The adjustment dialog closed after the database rejected the adjustment')
        if (checks.cantidad !== '4' || checks.producto !== PRODUCTO_HIELO) failures.push('The form lost its values after the rejected adjustment')
        if (checks.peticionesRpc !== 1) failures.push(`Expected one rejected ajustar_despacho POST, saw ${checks.peticionesRpc}`)

        await page.screenshot({ path: `${out}/04-error-ventana-${sufijo}.png` })

        await dialogo.getByRole('button', { name: 'Cancelar', exact: true }).click()
        await dialogo.getByRole('button', { name: 'Cancelar', exact: true }).waitFor({ state: 'detached' })
        checks.cerradoTrasCancelar = !(await dialogo.isVisible())
        if (!checks.cerradoTrasCancelar) failures.push('The adjustment dialog could not be closed after the error')
      },
    })

    await ejecutarEscenario({
      nombre: 'doble-click',
      minutos: 2,
      modoRpc: 'lento',
      viewport,
      accion: async ({ page, checks, failures, observado }) => {
        const { dialogo } = await abrirAjuste(page)
        await llenarUnaLinea(dialogo)

        await dialogo.getByRole('button', { name: 'Agregar al despacho', exact: true }).dblclick()
        await page.getByText('Productos agregados al despacho.', { exact: true }).waitFor()
        await esperar(800)

        checks.peticionesRpc = observado.rpc.length
        checks.claves = observado.rpc.map((cuerpo) => cuerpo.p_idempotency_key)
        checks.clavesUnicas = [...new Set(checks.claves)]
        if (checks.peticionesRpc === 1) {
          checks.resultado = 'one request'
        } else if (checks.peticionesRpc === 2 && checks.clavesUnicas.length === 1) {
          checks.resultado = 'two requests with the same idempotency key'
        } else {
          checks.resultado = 'unexpected request pattern'
          failures.push(`Double click produced ${checks.peticionesRpc} requests with ${checks.clavesUnicas.length} distinct keys`)
        }
        if (!checks.claves.every((clave) => UUID.test(clave ?? ''))) failures.push('A double-click request did not carry a UUID key')

        await page.screenshot({ path: `${out}/05-doble-click-${sufijo}.png`, fullPage: true })
      },
    })
  }

  await ejecutarEscenario({
    nombre: 'sin-desborde-y-objetivos-tactiles',
    minutos: 2,
    modoRpc: 'exito',
    viewport: { width: 375, height: 812 },
    accion: async ({ page, checks, failures }) => {
      const { detalle, accion, dialogo } = await abrirAjuste(page)

      const conDialogo = await page.evaluate(layoutsDePagina)
      checks.layout = conDialogo
      if (conDialogo.scrollWidth > conDialogo.innerWidth) {
        failures.push(`Horizontal scroll at 375x812 with the dialog open: ${conDialogo.scrollWidth} > ${conDialogo.innerWidth}`)
      }

      const medidas = [
        await medirBoton(accion, 'Agregar productos'),
        ...await medirControles(dialogo),
      ]
      checks.objetivos = medidas
      const bajos = medidas.filter((medida) => medida.height < 44)
      if (bajos.length > 0) failures.push(`Touch targets under 44px: ${JSON.stringify(bajos)}`)

      await page.screenshot({ path: `${out}/06-375x812-ajuste.png` })
      await dialogo.getByRole('button', { name: 'Cancelar', exact: true }).click()
      await dialogo.getByRole('button', { name: 'Cancelar', exact: true }).waitFor({ state: 'detached' })

      const sinDialogo = await page.evaluate(layoutsDePagina)
      checks.layoutCerrado = sinDialogo
      if (sinDialogo.scrollWidth > sinDialogo.innerWidth) {
        failures.push(`Horizontal scroll at 375x812: ${sinDialogo.scrollWidth} > ${sinDialogo.innerWidth}`)
      }
      checks.detalleVisible = await detalle.isVisible()
      if (!checks.detalleVisible) failures.push('Dispatch detail disappeared after closing the adjustment dialog')

      await page.screenshot({ path: `${out}/07-375x812-lista.png`, fullPage: true })
    },
  })
} finally {
  await browser.close()
}

const failures = results.flatMap((result) => result.failures.map((failure) => `${result.scenario} ${result.viewport}: ${failure}`))
const evidence = {
  generatedAt: new Date().toISOString(),
  base,
  supabaseOrigin,
  results,
  failures,
}
writeFileSync(`${out}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`)
console.log(JSON.stringify(evidence, null, 2))

assert.deepEqual(failures, [], 'HU-26 dispatch adjustment browser check')
