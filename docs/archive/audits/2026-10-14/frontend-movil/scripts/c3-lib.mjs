// C3 — arnés CDP compartido (Chrome headless). Node >= 22. Requiere Vite en BASE y Supabase local.
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const BASE = process.env.BASE ?? 'http://127.0.0.1:5190'
export const PASS = 'ux-local-2026'
export const VIEWPORTS = [[412, 915], [375, 812], [768, 1024], [1024, 1366], [1280, 800]]
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

export async function abrir(puerto = 9455) {
  const perfil = mkdtempSync(join(tmpdir(), 'c3-chrome-'))
  const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--lang=es-CL', `--user-data-dir=${perfil}`, `--remote-debugging-port=${puerto}`, 'about:blank'], { stdio: 'ignore' })
  let info
  for (let i = 0; i < 60 && !info; i++) { await esperar(200); try { info = await (await fetch(`http://127.0.0.1:${puerto}/json/new?about:blank`, { method: 'PUT' })).json() } catch { /* aún no arranca */ } }
  const ws = new WebSocket(info.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0; const pend = new Map(); const consola = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m); return }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consola.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)}`)
    if (m.method === 'Runtime.exceptionThrown') consola.push('pageerror: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200))
    if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) consola.push(`log-${m.params.entry.level}: ${m.params.entry.text} ${m.params.entry.url ?? ''}`.slice(0, 240))
  }
  const cdp = (method, params = {}) => new Promise((r, rej) => { const n = ++id; pend.set(n, (m) => (m.error ? rej(new Error(m.error.message)) : r(m.result))); ws.send(JSON.stringify({ id: n, method, params })) })
  await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.enable')
  const evaluar = async (expresion) => {
    const r = await cdp('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  const viewport = (w, h) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 })
  const ir = async (ruta, ms = 1100) => { await cdp('Page.navigate', { url: BASE + ruta }); await esperar(ms); await evaluar(AYUDAS) }
  const sesion = async (correo) => {
    await cdp('Page.navigate', { url: BASE + '/login' }); await esperar(700)
    await evaluar('localStorage.clear(); sessionStorage.clear()')
    await ir('/login', 900)
    await evaluar(`(async () => { const h = window.__h
      const em = await h.hasta(() => document.querySelector('input[type=email]'))
      h.poner(em, ${JSON.stringify(correo)}); h.poner(document.querySelector('input[type=password]'), ${JSON.stringify(PASS)})
      document.querySelector('form button[type=submit]').click()
      await h.hasta(() => !location.pathname.startsWith('/login'), 15000) })()`)
    await esperar(1200)
  }
  const captura = async (archivo, { modal = false, max = 5000 } = {}) => {
    const { writeFileSync } = await import('node:fs')
    const m = JSON.parse(await evaluar(MEDIR))
    const [w, h] = [m.iw, await evaluar('innerHeight')]
    let shot
    if (modal) {
      const alto = await evaluar(`(document.querySelector('dialog[open]')?.scrollHeight ?? 0)`)
      await viewport(w, Math.min(max, Math.max(h, alto + 40))); await esperar(300)
      shot = await cdp('Page.captureScreenshot', { format: 'png' }); await viewport(w, h)
    } else {
      shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(max, Math.max(h, m.alto)), scale: 1 } })
    }
    writeFileSync(archivo, Buffer.from(shot.data, 'base64'))
  }
  const medir = async () => JSON.parse(await evaluar(MEDIR))
  const cerrar = () => { try { ws.close() } catch {} chrome.kill() }
  return { cdp, evaluar, viewport, ir, sesion, medir, captura, consola, cerrar }
}

export const AYUDAS = `window.__h = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async hasta(fn, t = 10000) { const s = Date.now(); while (Date.now() - s < t) { const v = fn(); if (v) return v; await this.sleep(100) } throw new Error('timeout: ' + fn.toString().slice(0, 120)) },
  poner(el, v) { const p = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })) },
  boton(texto, raiz = document) { return [...raiz.querySelectorAll('button,a')].find((b) => b.textContent.trim().startsWith(texto)) },
}`

export const MEDIR = `(() => {
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab]'
  const chicos = []
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[inert]') || el.closest('dialog:not([open])')) continue
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width <= 1 || r.height <= 1) continue
    if (r.width < 43.5 || r.height < 43.5) chicos.push({ tag: el.tagName.toLowerCase(), nombre: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.id || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) })
  }
  return JSON.stringify({ sw: document.documentElement.scrollWidth, iw: innerWidth, alto: document.documentElement.scrollHeight, h1: (document.querySelector('h1')?.textContent ?? '').trim().slice(0, 60), ruta: location.pathname, chicos })
})()`
