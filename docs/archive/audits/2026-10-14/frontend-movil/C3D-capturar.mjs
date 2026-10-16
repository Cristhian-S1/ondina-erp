// Captura C3-A (Registrar venta; derivado de D2-capturar.mjs): capturas y medidas a 5 viewports vía CDP (Chrome headless). Node >= 22.
// Uso: node D2-capturar.mjs <antes|despues> [filtro] [--crear]
//   Requiere Vite en BASE (por defecto http://127.0.0.1:5197) y Supabase local con las cuentas ux-*@example.invalid.
//   
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5197'
const aqui = dirname(fileURLToPath(import.meta.url))
const [etiqueta = 'despues', filtro] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const salida = resolve(aqui, 'capturas/C3D')
mkdirSync(salida, { recursive: true })
const PASS = 'ux-local-2026'
const VIEWPORTS = [[412, 915], [375, 812]]
const MAX_ALTO = 6000

const perfil = mkdtempSync(join(tmpdir(), 'c3d-chrome-'))
const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--lang=es-CL', `--user-data-dir=${perfil}`, '--remote-debugging-port=9448', 'about:blank'], { stdio: 'ignore' })
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let info
for (let i = 0; i < 60 && !info; i++) { await esperar(200); try { info = await (await fetch('http://127.0.0.1:9448/json/new?about:blank', { method: 'PUT' })).json() } catch { /* aún no arranca */ } }
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


const ESC = [
  { n: 'menu-movil', ruta: '/', prep: `(async () => { const h = window.__h; await h.sleep(1200); const b = document.querySelector('button[aria-label*="enú" i], button[aria-label*="menu" i]'); b.click(); await h.sleep(600) })()` },
  { n: 'gastos-vacio', ruta: '/gastos', prep: `window.__h.sleep(1800)` },
  { n: 'clientes-vacio', ruta: '/clientes', prep: `window.__h.sleep(1800)` },
]
const medidas = []
await sesion('ux-vendedor@example.invalid')
for (const e of ESC) for (const [w, h] of VIEWPORTS) {
  if (e.n !== 'menu-movil' && w !== 412) continue
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true })
  await ir(e.ruta)
  try { await evaluar(e.prep) } catch (x) { console.log('prep falló', e.n, String(x.message).slice(0, 120)) }
  await esperar(400)
  const m = JSON.parse(await evaluar(MEDIR))
  const botones = await evaluar(`document.querySelectorAll('nav[aria-label*="aginaci"] button').length`)
  medidas.push({ vista: e.n, ancho: w, scrollWidth: m.sw, innerWidth: m.iw, sinDesborde: m.sw <= m.iw, botonesPaginacion: botones, controlesBajo44: m.chicos })
  console.log(e.n.padEnd(16), `${w}x${h}`, m.sw <= m.iw ? 'sin desborde' : 'DESBORDE', 'pag-botones=' + botones, '<44:', m.chicos.length, JSON.stringify(m.chicos.slice(0, 3)))
  const shot = await cdp('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(salida, `${e.n}-${w}x${h}-${etiqueta}.png`), Buffer.from(shot.data, 'base64'))
}
writeFileSync(join(salida, `medidas-${etiqueta}.json`), JSON.stringify(medidas, null, 1))
ws.close(); chrome.kill()
