// Local-only browser check for OND-c07.24: the mobile drawer must stay closed
// after 412 -> 1280 -> 412 px without a reload.
//
// The app is served by `npm run dev` from frontend/ and every Supabase request is
// intercepted here with synthetic data, so no backend is required and no write
// can reach a real project. Chrome is the locally installed binary.
//
// If Playwright is not resolvable from node_modules, point
// C07_24_PLAYWRIGHT_MODULE at an installed module (same pattern as c3b.visual.mjs):
//   C07_24_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { chromium } = await import(process.env.C07_24_PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.C07_24_BASE_URL ?? 'http://127.0.0.1:5190'
const supabase = process.env.C07_24_SUPABASE_URL ?? 'http://127.0.0.1:54321'
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'C07_24_BASE_URL must be local')
assert.match(supabase, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'C07_24_SUPABASE_URL must be local')
const supabaseOrigin = new URL(supabase).origin

const out = fileURLToPath(new URL('../../docs/archive/audits/2026-10-25/frontend/c07-24/', import.meta.url))
mkdirSync(out, { recursive: true })

const USER_ID = '00000000-0000-4000-8000-000000000024'
const SUCURSAL_ID = '00000000-0000-4000-8000-000000000001'
const EMAIL = 'ux-menu@example.invalid'

const perfil = {
  id: USER_ID,
  sucursal_id: SUCURSAL_ID,
  nombres: 'Sofía',
  apellidos: 'Prueba',
  rut: '11.111.111-1',
  telefono: '+56 9 0000 0000',
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

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
})
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'es-CL' })
const page = await context.newPage()

const errors = []
const writes = []
const unexpected = []
const apiRequests = []
const failures = []
const results = []

page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('requestfailed', (request) => {
  errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`)
})

await page.route((url) => url.origin === supabaseOrigin, async (route) => {
  const request = route.request()
  const url = new URL(request.url())
  const method = request.method()

  if (method === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: cors })
    return
  }

  apiRequests.push(`${method} ${url.pathname}`)

  const json = (status, body) => route.fulfill({
    status,
    headers: { ...cors, 'content-type': 'application/json' },
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

  if (url.pathname.startsWith('/rest/v1/') && method !== 'GET') {
    writes.push(`${method} ${url.pathname}`)
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

  unexpected.push(`${method} ${url.pathname}`)
  await json(404, { message: `Unexpected synthetic request: ${method} ${url.pathname}` })
})

async function settle() {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'))
}

async function menuState() {
  return page.evaluate(() => {
    const aside = document.querySelector('#menu-lateral')
    const toggle = document.querySelector('button[aria-controls="menu-lateral"]')
    const rect = aside?.getBoundingClientRect()
    return {
      expanded: toggle?.getAttribute('aria-expanded') ?? null,
      hidden: aside?.getAttribute('aria-hidden') ?? null,
      inert: aside?.hasAttribute('inert') ?? false,
      role: aside?.getAttribute('role') ?? null,
      left: rect ? Math.round(rect.left) : null,
      right: rect ? Math.round(rect.right) : null,
      width: rect ? Math.round(rect.width) : null,
      overlay: !!document.querySelector('div.fixed.inset-0'),
      dialog: !!document.querySelector('[role="dialog"]'),
    }
  })
}

async function layoutState() {
  return page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    heading: document.querySelector('main h1')?.textContent?.trim() ?? null,
  }))
}

function step(name, viewport, state) {
  results.push({ step: name, viewport, ...state })
  return state
}

try {
  await page.goto(`${base}/login`)
  await page.locator('#login-email').fill(EMAIL)
  await page.locator('#login-password').fill('ux-local-2026')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.includes('login'))
  await page.getByRole('heading', { name: 'Hola, Sofía' }).waitFor()

  await page.setViewportSize({ width: 412, height: 915 })
  await settle()
  const initial = step('initial-mobile', '412x915', await menuState())
  if (initial.expanded !== 'false' || initial.hidden !== 'true' || initial.right > 0) {
    failures.push('Drawer is not initially closed at 412x915')
  }

  await page.getByRole('button', { name: 'Alternar menú lateral' }).click()
  await settle()
  await page.screenshot({ path: `${out}/01-drawer-open-412x915.png` })
  const open = step('drawer-open', '412x915', await menuState())
  if (open.expanded !== 'true' || open.role !== 'dialog' || open.dialog !== true) {
    failures.push('Drawer did not open as a dialog at 412x915')
  }
  if (open.left !== 0) failures.push(`Drawer is not on-screen when open: left=${open.left}`)

  await page.setViewportSize({ width: 1280, height: 800 })
  await settle()
  await page.screenshot({ path: `${out}/02-desktop-1280x800.png` })
  const desktop = step('desktop-after-resize', '1280x800', await menuState())
  if (desktop.left !== 0 || desktop.width !== 256) failures.push('Desktop sidebar is not visible at 1280x800')
  if (desktop.dialog || desktop.role === 'dialog') failures.push('Mobile dialog semantics remain at 1280x800')
  if (desktop.expanded !== 'true') failures.push('Desktop sidebar is not reported expanded at 1280x800')

  await page.setViewportSize({ width: 412, height: 915 })
  await settle()
  await page.screenshot({ path: `${out}/03-back-to-mobile-412x915.png` })
  const back = step('back-to-mobile', '412x915', await menuState())
  if (back.expanded !== 'false') failures.push('Menu button still reports expanded after returning to mobile')
  if (back.hidden !== 'true') failures.push('Drawer is not aria-hidden after returning to mobile')
  if (!back.inert) failures.push('Drawer is not inert after returning to mobile')
  if (back.right > 0) failures.push(`Drawer is still on-screen after returning to mobile: right=${back.right}`)
  if (back.overlay) failures.push('Drawer overlay is still rendered after returning to mobile')
  if (back.dialog) failures.push('Drawer still exposes dialog semantics after returning to mobile')

  for (const [width, height, file] of [
    [375, 812, '04-375x812.png'],
    [768, 1024, '05-768x1024.png'],
  ]) {
    await page.setViewportSize({ width, height })
    await settle()
    await page.screenshot({ path: `${out}/${file}` })
    const layout = step('layout', `${width}x${height}`, {
      ...(await menuState()),
      ...(await layoutState()),
      screenshot: file,
    })
    if (layout.scrollWidth > layout.innerWidth) {
      failures.push(`Horizontal overflow at ${width}x${height}: ${layout.scrollWidth} > ${layout.innerWidth}`)
    }
    if (layout.heading !== 'Hola, Sofía') failures.push(`Dashboard did not render at ${width}x${height}`)
    if (layout.expanded !== 'false' || layout.right > 0) failures.push(`Drawer is open at ${width}x${height}`)
  }
} finally {
  await browser.close()
}

const evidence = {
  generatedAt: new Date().toISOString(),
  base,
  supabaseOrigin,
  results,
  errors,
  writes,
  unexpected,
  apiRequests,
  failures,
}
writeFileSync(`${out}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`)
console.log(JSON.stringify(evidence, null, 2))

assert.deepEqual(errors, [], 'Browser errors')
assert.deepEqual(writes, [], 'Unexpected database mutation')
assert.deepEqual(unexpected, [], 'Unexpected synthetic request')
assert.deepEqual(failures, [], 'OND-c07.24 mobile menu check')
