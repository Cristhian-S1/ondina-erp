// Captura C3-A (Registrar venta; derivado de D2-capturar.mjs): capturas y medidas a 5 viewports vía CDP (Chrome headless). Node >= 22.
// Uso: node D2-capturar.mjs <antes|despues> [filtro] [--crear]
//   Requiere Vite en BASE (por defecto http://127.0.0.1:5196) y Supabase local con las cuentas ux-*@example.invalid.
//   
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5196'
const aqui = dirname(fileURLToPath(import.meta.url))
const [etiqueta = 'despues', filtro] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const salida = resolve(aqui, 'capturas/C3A')
mkdirSync(salida, { recursive: true })
const PASS = 'ux-local-2026'
const VIEWPORTS = [[412, 915], [375, 812], [768, 1024], [1024, 1366], [1280, 800]]
const MAX_ALTO = 6000

const perfil = mkdtempSync(join(tmpdir(), 'c3a-chrome-'))
const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--lang=es-CL', `--user-data-dir=${perfil}`, '--remote-debugging-port=9447', 'about:blank'], { stdio: 'ignore' })
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let info
for (let i = 0; i < 60 && !info; i++) { await esperar(200); try { info = await (await fetch('http://127.0.0.1:9447/json/new?about:blank', { method: 'PUT' })).json() } catch { /* aún no arranca */ } }
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


const PREPARAR = `(async () => { const h = window.__h
  await h.hasta(() => h.boton('Agregar producto'))
  await h.hasta(() => document.querySelector('select[id]') && [...document.querySelectorAll('select')].some((s) => s.options.length > 2))
  const lineas = () => document.querySelectorAll('[data-testid=linea-producto-venta]')
  while (lineas().length > 3) { [...lineas()].at(-1).querySelector('button').click(); await h.sleep(150) }
  while (lineas().length < 3) { h.boton('Agregar producto').click(); await h.sleep(250) }
  const selects = () => [...document.querySelectorAll('[data-testid=linea-producto-venta] select')]
  for (let i = 0; i < 3; i++) {
    const opt = [...selects()[i].options].find((o) => o.value && !o.disabled)
    h.poner(selects()[i], opt.value); await h.sleep(200)
  }
  const cants = [...document.querySelectorAll('[data-testid=linea-producto-venta] input')].filter((x) => /Cantidad/.test(x.labels?.[0]?.textContent ?? ''))
  ;['5', '999999', '12'].forEach((v, i) => h.poner(cants[i], v)); await h.sleep(500)
})()`

let correoActual = null
const medidas = []
await sesion('ux-vendedor@example.invalid')
for (const [w, h] of VIEWPORTS) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 })
  await ir('/ventas/registrar')
  try { await evaluar(PREPARAR) } catch (e) { console.log('  preparar falló', w, String(e.message).slice(0, 160)) }
  await esperar(400)
  const m = JSON.parse(await evaluar(MEDIR))
  const tarjeta = JSON.parse(await evaluar(`(() => { const t = document.querySelector('[data-testid=linea-producto-venta]'); const r = t.getBoundingClientRect(); return JSON.stringify({ modo: getComputedStyle(t).display === 'table-row' ? 'tabla' : 'tarjeta', altoTarjeta: Math.round(r.height), anchoContenedor: Math.round(t.closest('table').parentElement.getBoundingClientRect().width) }) })()`))
  const ok = m.sw <= m.iw
  medidas.push({ ancho: w, alto: h, scrollWidth: m.sw, innerWidth: m.iw, sinDesborde: ok, alturaDocumento: m.alto, ...tarjeta, controlesBajo44: m.chicos })
  console.log(`${w}x${h}`.padEnd(10), ok ? 'sin desborde' : `DESBORDE ${m.sw}>${m.iw}`, `docH=${m.alto}`, JSON.stringify(tarjeta), `<44: ${m.chicos.length}`)
  const alto = Math.min(MAX_ALTO, Math.max(h, m.alto))
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: alto, scale: 1 } })
  writeFileSync(join(salida, `registrar-venta-${w}x${h}-${etiqueta}.png`), Buffer.from(shot.data, 'base64'))
}
writeFileSync(join(salida, `medidas-${etiqueta}.json`), JSON.stringify(medidas, null, 1))
ws.close(); chrome.kill()
