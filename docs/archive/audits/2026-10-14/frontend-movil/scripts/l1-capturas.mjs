#!/usr/bin/env node
// L1 browser verification, derived from the unchanged Q1 CDP driver.
// Captures login, seller home, administrator page and the mobile/tablet drawer.
// Checks overflow, 44 px targets, CSS/logo requests, logo dimensions and focus.
// Usage: node <this-file> --base http://127.0.0.1:5193 --stage despues
// Optional: --out <directory>, --port <CDP port>, --chrome <executable>.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import net from 'node:net'

const TMP_ROOT = existsSync('/tmp/opencode') ? '/tmp/opencode' : process.env.TMPDIR || '/tmp'
const VIEWPORTS = [
  { w: 412, h: 915 },
  { w: 375, h: 812 },
  { w: 768, h: 1024 },
  { w: 1024, h: 1366 },
  { w: 1280, h: 800 },
]
const USERS = {
  vendedor: { email: 'ux-vendedor@example.invalid', password: 'ux-local-2026' },
  admin: { email: 'ux-admin@example.invalid', password: 'ux-local-2026' },
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findRoot(startDir) {
  let d = startDir
  while (d !== '/' && d !== '.') {
    if (existsSync(join(d, 'frontend', 'package.json'))) return d
    d = dirname(d)
  }
  throw new Error('No se encontró la raíz del repo.')
}
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    if (!raw.startsWith('--')) continue
    const eq = raw.indexOf('=')
    if (eq >= 0) out[raw.slice(2)] = raw.slice(eq + 1)
    else out[raw.slice(2)] = argv[++i] ?? 'true'
  }
  return out
}
function connectCdp(wsUrl) {
  return new Promise((open, reject) => {
    const ws = new WebSocket(wsUrl)
    let nextId = 0
    const pending = new Map()
    ws.addEventListener('open', () => {
      open({
        send(method, params = {}, sessionId = null) {
          return new Promise((res, rej) => {
            const id = ++nextId
            pending.set(id, (msg) => {
              pending.delete(id)
              if (msg.error) rej(new Error(`${method}: ${JSON.stringify(msg.error)}`))
              else res(msg.result)
            })
            const message = { id, method, params }
            if (sessionId) message.sessionId = sessionId
            ws.send(JSON.stringify(message))
          })
        },
        close() { try { ws.close() } catch {} },
      })
    })
    ws.addEventListener('message', (ev) => {
      let msg
      try { msg = JSON.parse(String(ev.data)) } catch { return }
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    })
    ws.addEventListener('error', () => reject(new Error('CDP: error de WebSocket')))
  })
}
async function cdpEval(page, expr, timeoutMs = 20_000) {
  const t0 = Date.now()
  for (;;) {
    try {
      const res = await page.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (res?.result) return res.result
    } catch (err) {
      if (Date.now() - t0 > timeoutMs) throw err
    }
    if (Date.now() - t0 > timeoutMs) throw new Error('cdpEval: timeout')
    await sleep(400)
  }
}
async function estadoRuta(page) {
  const { value } = await cdpEval(page, `JSON.stringify({path: location.pathname, listo: !!document.querySelector('input[type="email"]'), authed: Object.keys(localStorage).some(k => k.includes('-auth-token'))})`)
  try { return JSON.parse(value) } catch { return { path: '?', listo: false, authed: false } }
}
async function esperar(cond, page, { timeoutMs = 45_000, cada = 500, mensaje = 'timeout' } = {}) {
  const t0 = Date.now()
  for (;;) {
    const st = await estadoRuta(page).catch(() => ({ path: '?', listo: false, authed: false }))
    if (cond(st)) return st
    if (Date.now() - t0 > timeoutMs) throw new Error(`${mensaje} (estado=${JSON.stringify(st)})`)
    await sleep(cada)
  }
}
async function iniciarSesion(browser, base, user) {
  const { targetId } = await browser.send('Target.createTarget', { url: `${base}/login` })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  const page = { targetId, sessionId, send: (m, p) => browser.send(m, p, sessionId) }
  await esperar((s) => s.listo, page, { mensaje: 'El formulario de login no apareció' })
  const driver = `(async () => {
    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const usados = ${JSON.stringify(user)};
    setVal(document.querySelector('input[type="email"],input[type="text"]'), usados.email);
    setVal(document.querySelector('input[type="password"]'), usados.password);
    setTimeout(() => document.querySelector('button[type="submit"]').click(), 50);
    return 'ok';
  })()`
  await cdpEval(page, driver)
  await esperar((st) => st.authed && st.path === '/', page, { mensaje: 'El login no concluyó' })
  await browser.send('Target.closeTarget', { targetId }).catch(() => {})
  return true
}
const limpiarSesion = async (page, base) => {
  await page.send('Runtime.evaluate', { expression: `localStorage.clear(); location.href = ${JSON.stringify(`${base}/login`)}; 'ok'`, awaitPromise: true, returnByValue: true }).catch(() => {})
  await esperar((st) => st.listo && !st.authed, page, { mensaje: 'La sesión no se limpió' })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const repoRoot = findRoot(resolve(new URL(import.meta.url).pathname))
  const base = args.base || 'http://127.0.0.1:5183'
  const stage = args.stage || 'despues'
  const outDir = resolve(args.out || join(repoRoot, 'docs', 'archive', 'audits', '2026-10-14', 'frontend-movil', 'capturas', 'L1'))
  mkdirSync(outDir, { recursive: true })

  const port = args.port ? Number(args.port) : await new Promise((res, rej) => {
    const try_ = (p) => {
      const srv = net.createServer().once('error', () => try_(p + 1))
      srv.once('listening', () => srv.close(() => res(p)))
      srv.listen(p, '127.0.0.1')
    }
    try_(9300)
  })
  const profileDir = join(TMP_ROOT, `q1-capturas-profile-${Date.now()}`)
  const chromeProc = spawn(
    args.chrome || '/usr/bin/google-chrome',
    ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, `--window-size=${VIEWPORTS.at(-1).w + 120},${VIEWPORTS.at(-1).h + 120}`, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  )
  const cerrar = async () => {
    try { chromeProc?.kill('SIGTERM') } catch {}
    await sleep(500)
    try { chromeProc?.kill('SIGKILL') } catch {}
    rmSync(profileDir, { recursive: true, force: true })
  }
  process.on('SIGINT', async () => { await cerrar(); process.exit(130) })

  let ws = null
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      ws = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json())?.webSocketDebuggerUrl
    } catch {}
    if (!ws) await sleep(500)
  }
  if (!ws) { await cerrar(); throw new Error('Chrome headless no quedó a la escucha en CDP.') }
  const browser = await connectCdp(ws)

  const crear = async (url, vp) => {
    // about:blank primero: la emulación de viewport debe aplicarse ANTES de navegar.
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
    const page = { targetId, sessionId, send: (m, p) => browser.send(m, p, sessionId) }
    await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 768 })
    await page.send('Page.enable', {})
    await page.send('Page.navigate', { url })
    return page
  }
  const resultados = []
  const jsonEval = async (scope, expr) => {
    for (let intento = 0; intento < 5; intento++) {
      try {
        const res = await scope.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
        if (res?.result?.value !== undefined) return JSON.parse(res.result.value)
      } catch {}
      await sleep(500)
    }
    throw new Error('jsonEval: sin valor tras 5 intentos')
  }
  const listo = async (scope, timeoutMs = 20_000) => {
    const t0 = Date.now()
    for (;;) {
      try {
        const res = await scope.send('Runtime.evaluate', { expression: 'document.readyState === "complete" && document.documentElement.scrollWidth > 0', returnByValue: true })
        if (res?.result?.value === true) return true
      } catch {}
      if (Date.now() - t0 > timeoutMs) throw new Error('la página no quedó lista')
      await sleep(500)
    }
  }
  const medir = async (page, vp, vista, nombre) => {
    await listo(page)
    const estado = await jsonEval(page, `JSON.stringify({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      scrollH: document.documentElement.scrollHeight,
      innerH: window.innerHeight })`)
    const objetivos = await jsonEval(page, `JSON.stringify((() => {
      const hallados = [];
      for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=option]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
          hallados.push({ tag: el.tagName.toLowerCase(), texto: (String(el.textContent || el.getAttribute('aria-label') || el.name || el.placeholder || '')).slice(0, 40), min: Math.round(Math.min(r.width, r.height)) });
          if (hallados.length >= 5) break;
        }
      }
      return hallados;
    })())`)
    const resources = await jsonEval(page, `JSON.stringify({
      inlineCss: document.querySelectorAll('style[data-bundle-css]').length,
      imageRequests: performance.getEntriesByType('resource').filter(x => /logo-[^/]+\\.jpg/.test(x.name)).map(x => x.name),
      cssRequests: performance.getEntriesByType('resource').filter(x => /\\.css(?:$|\\?)/.test(x.name)).map(x => x.name),
      logoSource: document.querySelector('aside img')?.getAttribute('src') ?? null,
      logoWidth: document.querySelector('aside img')?.getBoundingClientRect().width ?? null,
      logoHeight: document.querySelector('aside img')?.getBoundingClientRect().height ?? null,
      drawerHidden: document.querySelector('aside')?.getAttribute('aria-hidden') ?? null
    })`)
    const shot = await page.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(outDir, nombre), Buffer.from(shot.data, 'base64'))
    const fila = { vista, viewport: `${vp.w}x${vp.h}`, archivo: nombre, ...estado, ...resources, objetivosTactilesLt44: objetivos }
    resultados.push(fila)
    console.log(`${nombre}: scrollW=${estado.scrollW} innerW=${estado.innerW} overflow=${estado.scrollW > estado.innerW} objetivos<44=${objetivos.length}`)
  }

  const verificacion = resultados
  const control = await crear(`${base}/login`, VIEWPORTS.at(-1))
  await esperar((s) => s.listo || s.authed, control, { mensaje: 'no cargó la pestaña de control' })
  try {
    // 1) Vistas login (sin sesión): pestaña de control limpia la sesión previa.
    for (const vp of VIEWPORTS) {
      await limpiarSesion(control, base)
      const page = await crear(`${base}/login`, vp)
      try {
        await esperar((s) => s.listo && !s.authed, page, { mensaje: 'login no renderizó' })
        await sleep(700)
        await medir(page, vp, 'login', `login-${vp.w}x${vp.h}-${stage}.png`)
      } finally {
        await browser.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {})
      }
    }

    // 2) Vistas portada (autenticada como vendedor): una sesión para todas las corridas.
    await limpiarSesion(control, base)
    await iniciarSesion(browser, base, USERS.vendedor)
    for (const vp of VIEWPORTS) {
      const page = await crear(`${base}/`, vp)
      try {
        await sleep(1800)
        await medir(page, vp, 'portada', `portada-${vp.w}x${vp.h}-${stage}.png`)
        if (vp.w < 1024) {
          await cdpEval(page, `document.querySelector('[aria-controls="menu-lateral"]').click()`)
          await sleep(500)
          await medir(page, vp, 'drawer', `drawer-${vp.w}x${vp.h}-${stage}.png`)
          await cdpEval(page, `document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}))`)
          await sleep(400)
          const restored = await jsonEval(page, `JSON.stringify({
            closed: document.querySelector('aside').getAttribute('aria-hidden') === 'true',
            focusRestored: document.activeElement?.getAttribute('aria-controls') === 'menu-lateral'
          })`)
          if (!restored.closed || !restored.focusRestored) throw new Error('Drawer did not close and restore focus')
        }

      } finally {
        await browser.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {})
      }
    }
    await limpiarSesion(control, base)
    await iniciarSesion(browser, base, USERS.admin)
    for (const vp of VIEWPORTS) {
      const page = await crear(`${base}/administracion`, vp)
      try {
        await sleep(1800)
        await medir(page, vp, 'administracion', `administracion-${vp.w}x${vp.h}-${stage}.png`)
      } finally {
        await browser.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {})
      }
    }
    writeFileSync(join(outDir, `verificacion-viewport-${stage}.json`), JSON.stringify(verificacion, null, 2) + '\n')
  } finally {
    await browser.send('Target.closeTarget', { targetId: control.targetId }).catch(() => {})
    browser.close()
    await cerrar()
  }

  const faltas = resultados.filter((r) => r.scrollW > r.innerW || r.objetivosTactilesLt44.length ||
    (stage === 'despues' && (r.cssRequests.length || (r.drawerHidden === 'true' && r.imageRequests.length) ||
      (r.drawerHidden !== null && (r.logoWidth !== 40 || r.logoHeight !== 40)))))
  console.log(`Capturas: ${resultados.length}; con hallazgos: ${faltas.length}`)
  process.exitCode = faltas.length ? 2 : 0
}

main().catch((err) => {
  console.error('q1-capturas: ERROR', err)
  process.exit(1)
})
