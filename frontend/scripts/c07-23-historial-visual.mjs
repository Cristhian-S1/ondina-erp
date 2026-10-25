// Local-only browser check for OND-c07.23: Bodega history must name inactive
// sellers as `Nombre Apellido (inactivo)` while the new-dispatch selector keeps
// offering only active sellers. If the history RPC is missing the page must
// still load and fall back to the active roster.
//
// The app is served by `npm run dev` from frontend/ and every Supabase request is
// intercepted here with synthetic data, so no backend is required and no write
// can reach a real project. Chrome is the locally installed binary.
//
// If Playwright is not resolvable from node_modules, point
// C07_23_PLAYWRIGHT_MODULE at an installed module (same pattern as c3b.visual.mjs):
//   C07_23_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { chromium } = await import(process.env.C07_23_PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.C07_23_BASE_URL ?? 'http://127.0.0.1:5191'
const supabase = process.env.C07_23_SUPABASE_URL ?? 'http://127.0.0.1:54321'
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'C07_23_BASE_URL must be local')
assert.match(supabase, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'C07_23_SUPABASE_URL must be local')
const supabaseOrigin = new URL(supabase).origin

const out = fileURLToPath(new URL('../../docs/archive/audits/2026-10-25/frontend/c07-23/', import.meta.url))
mkdirSync(out, { recursive: true })

const USER_ID = '00000000-0000-4000-8000-000000000023'
const SUCURSAL_ID = '00000000-0000-4000-8000-000000000001'
const VENDEDOR_ACTIVO = '00000000-0000-4000-8000-000000000101'
const VENDEDOR_INACTIVO = '00000000-0000-4000-8000-000000000102'
const VENDEDOR_AUSENTE = '99999999-9999-4999-8999-999999999999'
const DESPACHO_ACTIVO = '11111111-1111-4111-8111-111111111111'
const DESPACHO_INACTIVO = '22222222-2222-4222-8222-222222222222'
const DESPACHO_AUSENTE = '33333333-3333-4333-8333-333333333333'
const PRODUCTO_AGUA = '44444444-4444-4444-8444-444444444444'
const PRODUCTO_HIELO = '55555555-5555-4555-8555-555555555555'
const TIPO_BANDEJA = '66666666-6666-4666-8666-666666666666'
const TIPO_BIDON = '77777777-7777-4777-8777-777777777777'
const EMAIL = 'ux-c07-23@example.invalid'
const ahora = new Date().toISOString()

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

// The login landing (Dashboard) resolves the branch name before the test
// navigates to Bodega.
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

const activo = { id: VENDEDOR_ACTIVO, nombres: 'Valentina', apellidos: 'Rojas' }
const inactivo = { id: VENDEDOR_INACTIVO, nombres: 'Bruno', apellidos: 'Soto' }

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

function crearFixture(modo) {
  const historial404 = modo === 'fallback'
  const despachos = modo === 'fallback'
    ? [
        { id: DESPACHO_ACTIVO, vendedor_id: VENDEDOR_ACTIVO },
        { id: DESPACHO_AUSENTE, vendedor_id: VENDEDOR_AUSENTE },
      ]
    : [
        { id: DESPACHO_ACTIVO, vendedor_id: VENDEDOR_ACTIVO },
        { id: DESPACHO_INACTIVO, vendedor_id: VENDEDOR_INACTIVO },
      ]

  return {
    historial404,
    vendedores: [activo],
    vendedoresHistorial: historial404 ? [] : [{ ...activo, activo: true }, { ...inactivo, activo: false }],
    despachos: despachos.map((d) => ({
      ...d,
      sucursal_id: SUCURSAL_ID,
      despachador_id: USER_ID,
      anulado: false,
      creado_por: USER_ID,
      creado_en: ahora,
      modificado_por: null,
      modificado_en: null,
    })),
    detalles: despachos.map((d, indice) => ({
      id: `88888888-8888-4888-8888-00000000000${indice}`,
      despacho_id: d.id,
      producto_id: PRODUCTO_AGUA,
      cantidad: 12,
      es_ajuste: false,
      creado_en: ahora,
    })),
    envasesDespacho: despachos.map((d, indice) => ({
      id: `99999999-9999-4999-8999-00000000000${indice}`,
      despacho_id: d.id,
      tipo_empaque_id: TIPO_BANDEJA,
      cantidad: 2,
      es_ajuste: false,
      creado_en: ahora,
    })),
    productos: [
      { id: PRODUCTO_AGUA, nombre: 'Agua 20L', tipo: 'agua', tipo_empaque_id: TIPO_BIDON, precio_base: 1000, activo: true, creado_en: '2026-01-01T00:00:00Z' },
      { id: PRODUCTO_HIELO, nombre: 'Hielo en bolsa 2kg', tipo: 'hielo', tipo_empaque_id: null, precio_base: 800, activo: true, creado_en: '2026-01-01T00:00:00Z' },
    ],
    tiposEmpaque: [
      { id: TIPO_BANDEJA, nombre: 'Bandeja', categoria: 'uso_interno', activo: true },
      { id: TIPO_BIDON, nombre: 'Bidón 20L', categoria: 'retornable', activo: true },
    ],
    stockBodega: [
      { sucursal_id: SUCURSAL_ID, producto_id: PRODUCTO_AGUA, cantidad: 200, modificado_en: ahora },
      { sucursal_id: SUCURSAL_ID, producto_id: PRODUCTO_HIELO, cantidad: 100, modificado_en: ahora },
    ],
    stockEnvases: [
      { sucursal_id: SUCURSAL_ID, tipo_empaque_id: TIPO_BANDEJA, cantidad: 20, modificado_en: ahora },
      { sucursal_id: SUCURSAL_ID, tipo_empaque_id: TIPO_BIDON, cantidad: 30, modificado_en: ahora },
    ],
    cargaVendedor: [
      { vendedor_id: VENDEDOR_ACTIVO, producto_id: PRODUCTO_AGUA, cantidad: 5, modificado_en: ahora },
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

function opciones(select) {
  return select.locator('option').evaluateAll((elements) => elements.map((element) => element.textContent?.trim() ?? ''))
}

const viewports = [
  { width: 412, height: 915 },
  { width: 1280, height: 800 },
]

const results = []

async function ejecutarEscenario({ nombre, modo, ruta, viewport, accion }) {
  const fixture = crearFixture(modo)
  const context = await browser.newContext({ viewport, locale: 'es-CL' })
  const page = await context.newPage()
  const observado = { errores: [], escrituras: [], inesperadas: [], peticiones: [] }
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

    if (url.pathname.startsWith('/rest/v1/') && method !== 'GET' && !url.pathname.startsWith('/rest/v1/rpc/vendedores_')) {
      observado.escrituras.push(`${method} ${url.pathname}`)
    }

    if (url.pathname === '/rest/v1/rpc/vendedores_sucursal' && method === 'POST') {
      await json(200, fixture.vendedores)
      return
    }
    if (url.pathname === '/rest/v1/rpc/vendedores_historial_sucursal' && method === 'POST') {
      if (fixture.historial404) {
        await json(404, {
          code: 'PGRST202',
          details: 'Could not find the function public.vendedores_historial_sucursal(p_sucursal_id) in the schema cache',
          hint: null,
          message: 'Could not find the function public.vendedores_historial_sucursal(p_sucursal_id) in the schema cache',
        })
      } else {
        await json(200, fixture.vendedoresHistorial)
      }
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
      await json(200, fixture.despachos, { 'content-range': contentRange(fixture.despachos) })
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/despacho_detalles') {
      await json(200, fixture.detalles)
      return
    }
    if (method === 'GET' && url.pathname === '/rest/v1/despacho_envases') {
      await json(200, fixture.envasesDespacho)
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
    await page.goto(`${base}${ruta}`)
    await accion({ page, checks, failures })
  } catch (error) {
    failures.push(`Scenario threw: ${error.message}`)
  }

  const erroresEsperados = fixture.historial404
    ? observado.errores.filter((error) => error.url?.includes('/rest/v1/rpc/vendedores_historial_sucursal'))
    : []
  const erroresInesperados = observado.errores.filter((error) => !erroresEsperados.includes(error))
  if (erroresInesperados.length > 0) failures.push(`Browser errors: ${JSON.stringify(erroresInesperados)}`)
  if (observado.escrituras.length > 0) failures.push(`Database writes: ${JSON.stringify(observado.escrituras)}`)
  if (observado.inesperadas.length > 0) failures.push(`Unexpected requests: ${JSON.stringify(observado.inesperadas)}`)

  await context.close()

  results.push({
    scenario: nombre,
    viewport: `${viewport.width}x${viewport.height}`,
    checks,
    failures,
  })
}

function historialDespachos(page) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Últimos despachos', exact: true }) })
}

try {
  for (const viewport of viewports) {
    const sufijo = `${viewport.width}x${viewport.height}`

    await ejecutarEscenario({
      nombre: 'despachos-con-historial',
      modo: 'principal',
      ruta: '/despachos',
      viewport,
      accion: async ({ page, checks, failures }) => {
        await page.getByRole('heading', { name: 'Despachos', exact: true }).waitFor()
        const lista = historialDespachos(page)
        await lista.getByRole('button', { name: /Valentina Rojas/ }).waitFor()
        await lista.getByRole('button', { name: /Bruno Soto \(inactivo\)/ }).waitFor()

        const filtro = page.getByLabel('Filtrar por vendedor', { exact: true })
        checks.filtro = await opciones(filtro)
        if (!checks.filtro.includes('Valentina Rojas')) failures.push('History filter does not list the active seller')
        if (!checks.filtro.includes('Bruno Soto (inactivo)')) failures.push('History filter does not name the inactive seller as (inactivo)')

        checks.historial = (await lista.innerText()).replace(/\s+/g, ' ').trim()
        if (!checks.historial.includes('Bruno Soto (inactivo)')) failures.push('History row does not show the inactive seller with (inactivo)')

        await page.screenshot({ path: `${out}/01-despachos-historial-${sufijo}.png`, fullPage: true })

        await page.getByRole('button', { name: 'Nuevo despacho', exact: true }).click()
        const modal = page.getByRole('dialog', { name: 'Nuevo despacho', exact: true })
        await modal.waitFor()
        checks.modalVendedores = await opciones(modal.locator('#despacho-vendedor'))
        if (!checks.modalVendedores.includes('Valentina Rojas')) failures.push('New dispatch selector does not list the active seller')
        if (checks.modalVendedores.some((texto) => texto.includes('Bruno'))) failures.push('New dispatch selector lists the inactive seller')
        if (checks.modalVendedores.some((texto) => texto.includes('inactivo'))) failures.push('New dispatch selector exposes an inactive label')

        await page.screenshot({ path: `${out}/02-despachos-nuevo-${sufijo}.png` })
        await modal.getByRole('button', { name: 'Cerrar', exact: true }).click()
      },
    })

    await ejecutarEscenario({
      nombre: 'devoluciones-con-historial',
      modo: 'principal',
      ruta: '/devoluciones',
      viewport,
      accion: async ({ page, checks, failures }) => {
        await page.getByRole('heading', { name: 'Devoluciones', exact: true }).waitFor()
        const lista = page.locator('main aside')
        await lista.getByRole('button', { name: /Valentina Rojas/ }).waitFor()
        await lista.getByRole('button', { name: /Bruno Soto \(inactivo\)/ }).waitFor()

        const filtro = page.getByLabel('Filtrar por vendedor', { exact: true })
        checks.filtro = await opciones(filtro)
        if (!checks.filtro.includes('Valentina Rojas')) failures.push('Return history filter does not list the active seller')
        if (!checks.filtro.includes('Bruno Soto (inactivo)')) failures.push('Return history filter does not name the inactive seller as (inactivo)')

        checks.historial = (await lista.innerText()).replace(/\s+/g, ' ').trim()
        if (!checks.historial.includes('Bruno Soto (inactivo)')) failures.push('Return history does not show the inactive seller with (inactivo)')

        await page.screenshot({ path: `${out}/03-devoluciones-historial-${sufijo}.png`, fullPage: true })
      },
    })

    await ejecutarEscenario({
      nombre: 'historial-sin-rpc',
      modo: 'fallback',
      ruta: '/despachos',
      viewport,
      accion: async ({ page, checks, failures }) => {
        await page.getByRole('heading', { name: 'Despachos', exact: true }).waitFor()
        const lista = historialDespachos(page)
        await lista.getByRole('button', { name: /Valentina Rojas/ }).waitFor()
        await lista.getByRole('button', { name: /Vendedor no disponible/ }).waitFor()

        checks.alertas = await page.locator('[role="alert"]').allTextContents()
        if (checks.alertas.length > 0) failures.push(`Error banner shown when the history RPC is missing: ${JSON.stringify(checks.alertas)}`)

        checks.historial = (await lista.innerText()).replace(/\s+/g, ' ').trim()
        if (!checks.historial.includes('Valentina Rojas')) failures.push('Fallback history does not name the active seller')
        if (!/Vendedor no disponible · ref\. 99999999/.test(checks.historial)) failures.push('Fallback history does not identify the unknown seller')

        const filtro = page.getByLabel('Filtrar por vendedor', { exact: true })
        checks.filtro = await opciones(filtro)
        if (!checks.filtro.includes('Valentina Rojas')) failures.push('Fallback filter does not list the active seller')
        if (checks.filtro.some((texto) => texto.includes('inactivo'))) failures.push('Fallback filter invented an inactive seller')

        await page.screenshot({ path: `${out}/04-despachos-sin-rpc-${sufijo}.png`, fullPage: true })
      },
    })
  }
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

assert.deepEqual(failures, [], 'OND-c07.23 inactive seller history check')
