// Captura D1-propuesta-colores.html a 412 y 1280 px vía CDP (Chrome headless). Node >= 22.
// Uso: node D1-capturar.mjs   (requiere /usr/bin/google-chrome)
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const url = 'file://' + resolve(aqui, 'D1-propuesta-colores.html')
const perfil = mkdtempSync(join(tmpdir(), 'd1-chrome-'))
const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${perfil}`, '--remote-debugging-port=9333', 'about:blank'], { stdio: 'ignore' })
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let info
for (let i = 0; i < 50 && !info; i++) { await esperar(200); try { info = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json() } catch {} }
const ws = new WebSocket(info.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m.result); pend.delete(m.id) }
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
for (const [w, h] of [[412, 915], [1280, 800]]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 })
  await cdp('Page.navigate', { url }); await esperar(800)
  const m = await cdp('Runtime.evaluate', { expression: 'JSON.stringify({sw:document.documentElement.scrollWidth,iw:innerWidth,h:document.documentElement.scrollHeight})', returnByValue: true })
  console.log(w, m.result.value)
  const { sw, iw, h: alto } = JSON.parse(m.result.value)
  if (sw > iw) console.log('ADVERTENCIA: desborde horizontal')
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: alto, scale: 1 } })
  writeFileSync(resolve(aqui, `capturas/D1/propuesta-colores-${w}x${alto}.png`), Buffer.from(shot.data, 'base64'))
}
ws.close(); chrome.kill()
