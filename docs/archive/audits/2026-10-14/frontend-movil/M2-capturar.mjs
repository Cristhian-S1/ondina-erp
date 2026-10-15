// Captura M2 (Bodega móvil + barrido #86): capturas y medidas a 5 viewports vía CDP (Chrome headless). Node >= 22.
// Uso: node M2-capturar.mjs <antes|despues> [filtro] [--crear]
//   Requiere Vite en BASE (por defecto http://127.0.0.1:5195) y Supabase local con las cuentas ux-*@example.invalid.
//   --crear: antes de capturar crea (por la UI) un despacho con 3 productos + bandejas para Devoluciones.
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5195'
const aqui = dirname(fileURLToPath(import.meta.url))
const [etiqueta = 'despues', filtro] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const crear = process.argv.includes('--crear')
const salida = resolve(aqui, 'capturas/M2')
mkdirSync(salida, { recursive: true })
const PASS = 'ux-local-2026'
const VIEWPORTS = [[412, 915], [375, 812], [768, 1024], [1024, 1366], [1280, 800]]
const MAX_ALTO = 6000

const perfil = mkdtempSync(join(tmpdir(), 'm2-chrome-'))
const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--lang=es-CL', `--user-data-dir=${perfil}`, '--remote-debugging-port=9444', 'about:blank'], { stdio: 'ignore' })
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let info
for (let i = 0; i < 60 && !info; i++) { await esperar(200); try { info = await (await fetch('http://127.0.0.1:9444/json/new?about:blank', { method: 'PUT' })).json() } catch { /* aún no arranca */ } }
const ws = new WebSocket(info.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); const p = pend.get(m.id); if (p) { pend.delete(m.id); p(m) } }
const cdp = (method, params = {}) => new Promise((r, rej) => { const n = ++id; pend.set(n, (m) => (m.error ? rej(new Error(m.error.message)) : r(m.result))); ws.send(JSON.stringify({ id: n, method, params })) })
const evaluar = async (expresion) => {
  const r = await cdp('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result.value
}

const AYUDAS = `window.__h = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async hasta(fn, t = 10000) { const s = Date.now(); while (Date.now() - s < t) { const v = fn(); if (v) return v; await this.sleep(100) } throw new Error('timeout: ' + fn.toString().slice(0, 120)) },
  poner(el, v) { const p = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })) },
  boton(texto, raiz = document) { return [...raiz.querySelectorAll('button,a')].find((b) => b.textContent.trim().startsWith(texto)) },
}`

const MEDIR = `(() => {
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab]'
  const chicos = []
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[inert]') || el.closest('dialog:not([open])')) continue
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width <= 1 || r.height <= 1) continue
    if (r.width < 43.5 || r.height < 43.5) chicos.push({ tag: el.tagName.toLowerCase(), nombre: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) })
  }
  return JSON.stringify({ sw: document.documentElement.scrollWidth, iw: innerWidth, alto: document.documentElement.scrollHeight, chicos })
})()`

async function ir(ruta) {
  await cdp('Page.navigate', { url: BASE + ruta })
  await esperar(900)
  await evaluar(AYUDAS)
}

async function sesion(correo) {
  await cdp('Page.navigate', { url: BASE + '/login' })
  await esperar(700)
  await evaluar('localStorage.clear(); sessionStorage.clear()')
  await cdp('Page.navigate', { url: BASE + '/login' })
  await esperar(900)
  await evaluar(AYUDAS)
  await evaluar(`(async () => { const h = window.__h
    const em = await h.hasta(() => document.querySelector('input[type=email]'))
    h.poner(em, ${JSON.stringify(correo)})
    h.poner(document.querySelector('input[type=password]'), ${JSON.stringify(PASS)})
    document.querySelector('form button[type=submit]').click()
    await h.hasta(() => !location.pathname.startsWith('/login'), 15000)
  })()`)
  await esperar(1200)
}


// Escenarios: { nombre, rol (correo), ruta, preparar (JS async en página), modal: bool }
const LISTA_CREA_DESPACHO = `(async () => { const h = window.__h
  h.boton('Nuevo despacho').click()
  const d = await h.hasta(() => document.querySelector('dialog[open]'))
  const vend = await h.hasta(() => d.querySelector('select'))
  await h.hasta(() => vend.options.length > 1)
  h.poner(vend, vend.options[1].value); await h.sleep(200)
  const n = 3
  for (let i = 1; i < n; i++) { h.boton('+ Agregar producto', d).click(); await h.sleep(150) }
  const selects = () => [...d.querySelectorAll('select')].filter((s) => /^despacho-producto-/.test(s.id))
  await h.hasta(() => selects().length === n)
  for (let i = 0; i < n; i++) {
    const s = selects()[i]
    const opt = [...s.options].find((o) => o.value && !o.disabled)
    h.poner(s, opt.value); await h.sleep(150)
  }
  const cants = () => [...d.querySelectorAll('input')].filter((x) => /^despacho-cantidad-/.test(x.id))
  const vals = ['4', '6', '12']
  cants().forEach((c, i) => h.poner(c, vals[i])); await h.sleep(300)
})()`

const ESCENARIOS = [
  { nombre: 'despachos-nuevo-3-productos', correo: 'ux-bodega@example.invalid', ruta: '/despachos', modal: true, preparar: LISTA_CREA_DESPACHO },
  { nombre: 'despachos-lista', correo: 'ux-bodega@example.invalid', ruta: '/despachos', preparar: `(async () => { const h = window.__h; await h.hasta(() => document.querySelector('h1')); const b = [...document.querySelectorAll('ul li > button[aria-expanded]')][0]; b?.click(); await h.sleep(300) })()` },
  { nombre: 'devoluciones-detalle', correo: 'ux-bodega@example.invalid', ruta: '/devoluciones', preparar: `(async () => { const h = window.__h
      await h.hasta(() => document.querySelector('aside ul li button'))
      const bs = [...document.querySelectorAll('aside ul li button')]
      const b = bs.find((x) => window.__M2_DESPACHO && x.textContent.includes('#' + window.__M2_DESPACHO)) ?? bs[0]
      b.click(); await h.sleep(500) })()`, despacho: true },
  { nombre: 'stock-productos', correo: 'ux-bodega@example.invalid', ruta: '/stock', preparar: `(async () => { const h = window.__h; await h.hasta(() => document.querySelector('table')); })()` },
  { nombre: 'stock-envases', correo: 'ux-bodega@example.invalid', ruta: '/stock', preparar: `(async () => { const h = window.__h; await h.hasta(() => document.querySelector('table')); h.boton('Envases').click(); await h.sleep(500) })()` },
  { nombre: 'ranking', correo: 'ux-vendedor@example.invalid', ruta: '/ranking-vendedores', preparar: `window.__h.sleep(1200)` },
  { nombre: 'mi-comision', correo: 'ux-vendedor@example.invalid', ruta: '/mi-comision', preparar: `window.__h.sleep(1200)` },
  { nombre: 'carga', correo: 'ux-vendedor@example.invalid', ruta: '/carga', preparar: `window.__h.sleep(1200)` },
  { nombre: 'clientes', correo: 'ux-vendedor@example.invalid', ruta: '/clientes', preparar: `window.__h.sleep(1200)` },
  { nombre: 'gastos', correo: 'ux-vendedor@example.invalid', ruta: '/gastos', preparar: `window.__h.sleep(1200)` },
]

let despachoId = null
if (crear) {
  await sesion('ux-bodega@example.invalid')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true })
  await ir('/despachos')
  await evaluar(LISTA_CREA_DESPACHO)
  await evaluar(`(async () => { const h = window.__h; const d = document.querySelector('dialog[open]'); h.boton('Registrar despacho', d).click(); await h.hasta(() => !document.querySelector('dialog[open]'), 15000) })()`)
  console.log('despacho creado por la UI')
}

const medidas = []
let correoActual = null
for (const esc of ESCENARIOS) {
  if (filtro && !esc.nombre.includes(filtro)) continue
  if (esc.correo !== correoActual) { await sesion(esc.correo); correoActual = esc.correo }
  if (esc.despacho) {
    // Último despacho con ≥ 3 detalles del día (el creado con --crear, o el más reciente)
    despachoId = process.env.M2_DESPACHO ?? null
  }
  for (const [w, h] of VIEWPORTS) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 })
    await ir(esc.ruta)
    if (despachoId) await evaluar(`window.__M2_DESPACHO = ${JSON.stringify(despachoId)}`)
    try { await evaluar(esc.preparar) } catch (e) { console.log('  preparar falló:', esc.nombre, w, String(e.message).slice(0, 160)) }
    await esperar(400)
    const m = JSON.parse(await evaluar(MEDIR))
    const ok = m.sw <= m.iw
    medidas.push({ vista: esc.nombre, ancho: w, alto: h, scrollWidth: m.sw, innerWidth: m.iw, sinDesborde: ok, alturaDocumento: m.alto, controlesBajo44: m.chicos })
    console.log(esc.nombre.padEnd(30), `${w}x${h}`.padEnd(10), ok ? 'sin desborde' : `DESBORDE ${m.sw}>${m.iw}`, `docH=${m.alto}`, `<44: ${m.chicos.length}`)
    const nombre = join(salida, `${esc.nombre}-${w}x${h}-${etiqueta}.png`)
    if (esc.modal) {
      const alto = await evaluar(`(document.querySelector('dialog[open]')?.scrollHeight ?? 0)`)
      const nuevoAlto = Math.min(MAX_ALTO, Math.max(h, alto + 40))
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: nuevoAlto, deviceScaleFactor: 1, mobile: w < 600 })
      await esperar(300)
      const shot = await cdp('Page.captureScreenshot', { format: 'png' })
      writeFileSync(nombre, Buffer.from(shot.data, 'base64'))
    } else {
      const alto = Math.min(MAX_ALTO, Math.max(h, m.alto))
      const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: alto, scale: 1 } })
      writeFileSync(nombre, Buffer.from(shot.data, 'base64'))
    }
  }
}
writeFileSync(join(salida, `medidas-${etiqueta}${filtro ? '-' + filtro : ''}.json`), JSON.stringify(medidas, null, 1))
ws.close(); chrome.kill()
