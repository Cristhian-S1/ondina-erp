#!/usr/bin/env node
// Q1 (OND-c07.21) - Medición de línea base Lighthouse 12.8.2 mobile/tablet (ondina-erp).
//
// Adaptación del método A3 (docs/archive/audits/2026-10-13/frontend-ux/scripts/run-a3-baseline.mjs)
// con los mismos invariantes:
//   1) Verifica que el servidor local de medición (servidor-local-a3.mjs) esté sirviendo en --base.
//      NO se usa `vite preview`: su CSP bloquea el Supabase local (connect-src).
//   2) Chrome headless persistente + Lighthouse 12.8.2 (npx) por combinación página × dispositivo × corrida.
//   3) Rutas autenticadas inician sesión REALMENTE por el formulario de /login (CDP); token supabase-js
//      en localStorage, `--disable-storage-reset` en esas corridas.
//   4) Escribe en --out: LHR crudos (sin capturas embebidas, .gz si el directorio supera ~1.9 MB),
//      resumen.json (medianas + corridas + auditorías con score < 1), resultados.csv (una fila por corrida)
//      y chunks.json (inventario de dist/assets; igual que A3).
//
// Novedades respecto de A3:
//   - Perfiles añadidos: móvil 412x915 (Pixel 7 aprox., dsf 2,625) y tablet 1024x1366 (iPad Pro retrato, dsf 2),
//     además de mobile (preset LH), tablet-768x1024 (A3, dsf 2) y desktop (--preset=desktop).
//   - Por cada corrida se registran las auditorías con score < 1 (excluye informative/null):
//     color-contrast (selectores exactos), unused-javascript (chunks y bytes), render-blocking-resources
//     (CSS bloqueante), offscreen-images (logo fuera de pantalla) y las demás (detalles recortados).
//
// Uso (desde la raíz del repo o worktree; requiere build + servidor-local-a3.mjs activos):
//   npm run build --prefix frontend
//   node docs/archive/audits/2026-10-14/frontend-movil/scripts/servidor-local-a3.mjs --port 5183 \
//        --supabase http://127.0.0.1:54321 &
//   node docs/archive/audits/2026-10-14/frontend-movil/scripts/run-q1-baseline.mjs \
//        --base http://127.0.0.1:5183 --runs 3 \
//        --out docs/archive/audits/2026-10-14/frontend-movil/lighthouse-base
// Requiere: Node >= 22 (WebSocket global), Google Chrome (/usr/bin/google-chrome) y
// frontend/.env.local con VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY del stack LOCAL de Supabase.

import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import net from 'node:net'

const LH_VERSION = '12.8.2'
const TMP_ROOT = existsSync('/tmp/opencode') ? '/tmp/opencode' : process.env.TMPDIR || '/tmp'
const OUT_LIMIT_BYTES = 1_900_000 // presupuesto ~2 MB para el directorio de salida

const PAGES = {
  login: { url: '/login', authed: false, user: null },
  portada: { url: '/', authed: true, user: 'vendedor' },
  administracion: { url: '/administracion', authed: true, user: 'admin' },
}
const USERS = {
  vendedor: { email: 'ux-vendedor@example.invalid', password: 'ux-local-2026' },
  bodega: { email: 'ux-bodega@example.invalid', password: 'ux-local-2026' },
  produccion: { email: 'ux-produccion@example.invalid', password: 'ux-local-2026' },
  admin: { email: 'ux-admin@example.invalid', password: 'ux-local-2026' },
}
// Flags por dispositivo. mobile espeja el preset por defecto de Lighthouse; tablet-768x1024
// espeja docs/engineering/performance.md (dsf 2, emulación móvil). Los perfiles 412x915 y
// 1024x1366 añaden la pantalla real de Pixel 7 (dsf 2,625) e iPad Pro retrato (dsf 2).
const DEVICE_FLAGS = {
  mobile: [],
  'movil-412x915': [
    '--screenEmulation.width=412',
    '--screenEmulation.height=915',
    '--screenEmulation.deviceScaleFactor=2.625',
    '--screenEmulation.mobile=true',
    '--formFactor=mobile',
  ],
  'tablet-768x1024': [
    '--screenEmulation.width=768',
    '--screenEmulation.height=1024',
    '--screenEmulation.deviceScaleFactor=2',
    '--screenEmulation.mobile=true',
    '--formFactor=mobile',
  ],
  'tablet-1024x1366': [
    '--screenEmulation.width=1024',
    '--screenEmulation.height=1366',
    '--screenEmulation.deviceScaleFactor=2',
    '--screenEmulation.mobile=true',
    '--formFactor=mobile',
  ],
  desktop: ['--preset=desktop'],
}
const CATEGORIES = ['performance', 'accessibility', 'best-practices']

// ---------------------------------------------------------------- utilidades
function findRepoRoot(startDir) {
  let d = startDir
  while (d !== '/' && d !== '.') {
    if (existsSync(join(d, 'frontend', 'package.json'))) return d
    d = dirname(d)
  }
  throw new Error('No se encontró la raíz del repo (directorio con frontend/package.json).')
}

function parseArgs(argv) {
  const out = {}
  const booleanos = new Set(['dry-run', 'skip-existing', 'no-sizes'])
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    if (!raw.startsWith('--')) continue
    const key = raw.slice(2).replace(/_(\w)/g, (m, c) => c.toUpperCase())
    if (booleanos.has(key)) out[key] = true
    else {
      const eq = raw.indexOf('=')
      if (eq >= 0) out[key] = raw.slice(eq + 1)
      else out[key] = argv[++i] ?? 'true'
    }
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fmtBytes = (n) => new Intl.NumberFormat('es-CL').format(Math.round(n))

function freePort(start) {
  return new Promise((res, rej) => {
    const try_ = (p) => {
      const srv = net.createServer().once('error', () => (p + 1 > start + 29 ? rej(new Error('Sin puerto libre.')) : try_(p + 1)))
      srv.once('listening', () => srv.close(() => res(p)))
      srv.listen(p, '127.0.0.1')
    }
    try_(start)
  })
}

// ------------------------------------------------------------- CDP (cliente)
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
        close() {
          try {
            ws.close()
          } catch {}
        },
      })
    })
    ws.addEventListener('message', (ev) => {
      let msg
      try {
        msg = JSON.parse(String(ev.data))
      } catch {
        return
      }
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
  const { value } = await cdpEval(
    page,
    `JSON.stringify({path: location.pathname, listo: !!document.querySelector('input[type="email"]'), authed: Object.keys(localStorage).some(k => k.includes('-auth-token'))})`,
  )
  try {
    return JSON.parse(value)
  } catch {
    return { path: '?', listo: false, authed: false }
  }
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

/* Inicia sesión usando el formulario real de /login (React state + click). */
async function iniciarSesion(browser, base, user) {
  const { targetId } = await browser.send('Target.createTarget', { url: `${base}/login` })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  const page = { targetId, sessionId, send: (m, p) => browser.send(m, p, sessionId) }
  try {
    await esperar((s) => s.authed || s.listo, page, { mensaje: 'no cargó /login', timeoutMs: 20_000 })
    const estadoInicial = await estadoRuta(page)
    if (estadoInicial.authed) {
      await page
        .send(
          'Runtime.evaluate',
          { expression: `localStorage.clear(); location.href = ${JSON.stringify(`${base}/login`)}; 'ok'`, awaitPromise: true, returnByValue: true },
        )
        .catch(() => {})
      await esperar((s) => s.listo && !s.authed, page, { mensaje: 'no se pudo cerrar la sesión previa' })
    }

    await esperar((st) => st.listo, page, { mensaje: 'El formulario de login no apareció' })

    const driver = `(async () => {
      const email = ${JSON.stringify(user.email)};
      const pass = ${JSON.stringify(user.password)};
      const setVal = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const input = document.querySelector('input[type="email"],input[type="text"]');
      const pw = document.querySelector('input[type="password"]');
      const btn = document.querySelector('button[type="submit"]');
      if (!input || !pw || !btn) return { ok: false, motivo: 'sin formulario', path: location.pathname };
      setVal(input, email);
      setVal(pw, pass);
      setTimeout(() => btn.click(), 50);
      return { ok: true, path: location.pathname };
    })()`
    const clic = await cdpEval(page, driver)
    if (clic.value?.ok === false) throw new Error(`Login: ${clic.value.motivo}`)

    const estado = await esperar((st) => st.authed && st.path === '/', page, {
      mensaje: 'El login no concluyó (sin token en localStorage o no navega a /)',
    })
    return { page, targetId, estado }
  } catch (err) {
    err.message = `${err.message} | usuario=${user.email}`
    await browser.send('Target.closeTarget', { targetId }).catch(() => {})
    throw err
  }
}

/* Limpia los tokens del origin y deja la pestaña de control en /login sin sesión. */
async function limpiarSesion(page, base) {
  await page
    .send(
      'Runtime.evaluate',
      { expression: `localStorage.clear(); location.href = ${JSON.stringify(`${base}/login`)}; 'ok'`, awaitPromise: true, returnByValue: true },
    )
    .catch(() => {})
  await esperar((st) => st.listo && !st.authed, page, { mensaje: 'La sesión no se limpió' })
}

// -------------------------------------------------------------- Lighthouse
function argsLh(url, rawPath, extraArgs, chrome, port) {
  return [
    '-y',
    `lighthouse@${LH_VERSION}`,
    url,
    `--chrome-path=${chrome}`,
    '--chrome-flags=--headless=new',
    '--output=json',
    `--output-path=${rawPath}`,
    '--only-categories=performance,accessibility,best-practices',
    '--max-wait-for-load=60000',
    `--port=${port}`,
    ...extraArgs,
  ]
}

function extractMetrics(lhr) {
  const scores = {}
  for (const c of CATEGORIES) scores[c] = Math.round(((lhr.categories?.[c]?.score ?? 0) || 0) * 100)
  const num = (id) => lhr.audits?.[id]?.numericValue
  return {
    scores,
    fcpMs: num('first-contentful-paint'),
    lcpMs: num('largest-contentful-paint'),
    tbtMs: num('total-blocking-time'),
    cls: lhr.audits?.['cumulative-layout-shift']?.numericValue,
    transferBytes: num('total-byte-weight'),
    requests: lhr.audits?.['network-requests']?.details?.items?.length ?? null,
    finalUrl: lhr.finalDisplayedUrl || lhr.requestedUrl,
    fetchTime: lhr.fetchTime,
    lighthouseVersion: lhr.lighthouseVersion ?? LH_VERSION,
    runtimeError: lhr.runtimeError?.message ?? null,
  }
}

// ---------- auditorías con score < 1 (detalles recortados para el informe) ----------
// Campos interesantes según la auditoría; el resto se descarta para no inflar el resumen.
const ITEM_FIELDS = new Set([
  'url', 'selector', 'snippet', 'explanation', 'totalBytes', 'wastedBytes', 'wastedMs', 'wastedPercent',
  'nodeLabel', 'path', 'subItems',
])
const ITEM_ARRAY_FIELDS = new Set(['subItems'])
const MAX_ITEMS = 8
const MAX_TEXT = 220

function recortarItem(item) {
  const out = {}
  for (const [k, v] of Object.entries(item ?? {})) {
    if (ITEM_ARRAY_FIELDS.has(k)) {
      const subs = Array.isArray(v) ? v.slice(0, 3).map((s) => Object.fromEntries(Object.entries(s?.items?.[0] ?? {}).filter(([sk]) => ITEM_FIELDS.has(sk)))) : undefined
      if (subs) out[k] = subs
      continue
    }
    if (!ITEM_FIELDS.has(k)) continue
    if (typeof v === 'string' && v.length > MAX_TEXT) out[k] = v.slice(0, MAX_TEXT) + '…'
    else out[k] = v
  }
  return out
}

function extraerAuditoriasFallidas(lhr) {
  const fallidas = []
  for (const audit of Object.values(lhr.audits ?? {})) {
    if (audit?.score === null || audit?.score === undefined || audit.score >= 1) continue
    const detalle = audit.details ?? null
    let items
    if (Array.isArray(detalle?.items) && detalle.items.length) {
      items = detalle.items.slice(0, MAX_ITEMS).map((it) => (it?.node ? { node: recortarItem(it.node), ...recortarItem(Object.fromEntries(Object.entries(it).filter(([k]) => k !== 'node'))) } : recortarItem(it)))
    } else if (Array.isArray(detalle?.items) && detalle.items.length === 0) {
      items = []
    } else if (INFO_AUDITS.has(audit.id)) {
      items = detalle?.items?.length ? undefined : undefined
    }
    const num = (k) => (typeof detalle?.[k] === 'number' ? detalle[k] : undefined)
    fallidas.push({
      id: audit.id,
      titulo: audit.title,
      score: audit.score,
      displayValue: audit.displayValue ?? null,
      wastedMs: num('overallSavingsMs'),
      wastedBytes: num('overallSavingsBytes'),
      items,
    })
  }
  return fallidas
}

const INFO_AUDITS = new Set(['accesskeys']) // marcadores de auditorías informativas

// Capturas embebidas y volúmenes de localización/stackPacks que se eliminan del LHR
// para respetar el presupuesto (~2 MB) sin tocar ninguna cifra (métricas, auditorías
// y scores quedan íntegros; solo se elimina el material de renderizado del viewer).
const SCREENSHOT_AUDITS = new Set([
  'final-screenshot',
  'thumbnail-screenshot',
  'screenshot-thumbnails',
  'full-page-screenshot',
])
function slimLhr(lhr) {
  const clonado = structuredClone(lhr)
  for (const id of SCREENSHOT_AUDITS) {
    const audit = clonado.audits?.[id]
    if (audit) delete audit.details
  }
  delete clonado.i18n
  delete clonado.stackPacks
  return clonado
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// ------------------------------------------------------------------- sizes
function walkFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, out)
    else out.push(p)
  }
  return out
}

const gzip9 = (file) => gzipSync(readFileSync(file), { level: 9 }).length
const archivoRel = (f) => (f.startsWith('assets/') ? f.slice('assets/'.length) : f)

function closure(manifest, key) {
  const ids = new Set([key])
  const walk = (k) => {
    for (const imp of manifest[k]?.imports ?? []) {
      if (!ids.has(imp)) {
        ids.add(imp)
        walk(imp)
      }
    }
  }
  walk(key)
  const archivos = new Set()
  for (const id of ids) {
    const e = manifest[id]
    if (!e) continue
    archivos.add(e.file)
    for (const css of e.css ?? []) archivos.add(css)
  }
  return { keys: [...ids], archivos: [...archivos] }
}

function leerDominios(frontendDir) {
  const dominios = new Map()
  const base = join(frontendDir, 'src', 'domains')
  if (!existsSync(base)) return dominios
  for (const dom of readdirSync(base, { withFileTypes: true })) {
    if (!dom.isDirectory()) continue
    const file = join(base, dom.name, 'index.tsx')
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    const reEl = /element:[\s\S]{0,240}?pages\.([A-Za-z0-9_]+)/g
    for (const m of text.matchAll(reEl)) {
      const antes = text.slice(0, m.index)
      const pathMatch = [...antes.matchAll(/path:\s*'([^']+)'/g)].pop()
      if (!pathMatch) continue
      const key = `src/domains/${dom.name}/pages/${m[1]}.tsx`
      if (!dominios.has(pathMatch[1])) dominios.set(pathMatch[1], { dominio: dom.name, page: m[1], key })
    }
  }
  return dominios
}

function colectarSizes(frontendDir, outDir) {
  const dist = join(frontendDir, 'dist')
  const assets = join(dist, 'assets')
  const res = { chunks: [], totales: null, bootSet: null, extrasPorRuta: null, comparacion: null }
  if (!existsSync(join(dist, 'index.html'))) {
    res.error = 'no existe dist/index.html; corre `npm run build --prefix frontend`'
    writeFileSync(join(outDir, 'chunks.json'), JSON.stringify(res, null, 2) + '\n')
    return res
  }
  for (const f of walkFiles(assets)) {
    const nombre = f.slice(assets.length + 1)
    res.chunks.push({ archivo: nombre, raw: statSync(f).size, gzip: gzip9(f) })
  }
  res.chunks.sort((a, b) => b.raw - a.raw)
  const filesJs = res.chunks.filter((c) => c.archivo.endsWith('.js'))
  const filesCss = res.chunks.filter((c) => c.archivo.endsWith('.css'))
  res.totales = {
    jsRaw: filesJs.reduce((a, c) => a + c.raw, 0),
    jsGzip: filesJs.reduce((a, c) => a + c.gzip, 0),
    cssRaw: filesCss.reduce((a, c) => a + c.raw, 0),
    cssGzip: filesCss.reduce((a, c) => a + c.gzip, 0),
    archivos: res.chunks.length,
  }

  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  const entryJs = html.match(/<script[^>]+src="([^"]+)"/)?.[1]
  const entryCss = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1]
  const budgetPath = join(frontendDir, 'bundle-budget.json')
  if (entryJs && entryCss && existsSync(budgetPath)) {
    const { baseline, headroomPercent } = JSON.parse(readFileSync(budgetPath, 'utf8'))
    const limite = (b) => b * (1 + headroomPercent / 100)
    const gzipZlib = (f) => gzipSync(readFileSync(f)).length
    const fila = (metrica, base, actual) => ({
      metrica,
      baseBytes: base,
      limiteBytes: Math.round(limite(base)),
      actualBytes: actual,
      deltaPct: +(((actual - base) / base) * 100).toFixed(2),
      estado: actual > limite(base) ? 'SUPERA' : 'OK',
    })
    const assetLocal = (url) => join(assets, url.replace(/^\/?(assets\/)?/, ''))
    res.comparacion = [
      fila('JS de entrada (gzip)', baseline.entryJsGzipBytes, gzipZlib(assetLocal(entryJs))),
      fila('CSS de entrada (gzip)', baseline.entryCssGzipBytes, gzipZlib(assetLocal(entryCss))),
      fila('Chunk JS más grande (sin comprimir)', baseline.largestJsChunkRawBytes, Math.max(...filesJs.map((c) => c.raw))),
    ]
  }

  const manifestPath = join(dist, '.vite', 'manifest.json')
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const boot = closure(manifest, 'index.html')
    const bootFiles = boot.archivos.map((f) => {
      const ruta = join(assets, archivoRel(f))
      return { archivo: archivoRel(f), raw: statSync(ruta).size, gzip: gzip9(ruta) }
    })
    res.bootSet = {
      files: bootFiles,
      rawBytes: bootFiles.reduce((a, c) => a + c.raw, 0),
      gzipBytes: bootFiles.reduce((a, c) => a + c.gzip, 0),
    }
    const bootKeys = new Set(boot.keys)
    const extras = []
    for (const [ruta, info] of leerDominios(frontendDir).entries()) {
      if (!manifest[info.key]) {
        extras.push({ ruta, dominio: info.dominio, pagina: info.page, extraGzip: 0, archivos: [], nota: 'chunk no encontrado en el manifest' })
        continue
      }
      if (bootKeys.has(info.key)) {
        extras.push({ ruta, dominio: info.dominio, pagina: info.page, extraGzip: 0, archivos: [], nota: 'página estática: se sirve en el boot set' })
        continue
      }
      const cl = closure(manifest, info.key)
      const extraArchivos = new Set()
      for (const id of cl.keys) {
        if (bootKeys.has(id)) continue
        const e = manifest[id]
        if (!e) continue
        extraArchivos.add(e.file)
        for (const css of e.css ?? []) extraArchivos.add(css)
      }
      const filas = [...extraArchivos]
        .map((f) => ({ archivo: archivoRel(f), gzip: gzip9(join(assets, archivoRel(f))) }))
        .sort((a, b) => b.gzip - a.gzip)
      extras.push({ ruta, dominio: info.dominio, pagina: info.page, extraGzip: filas.reduce((a, c) => a + c.gzip, 0), archivos: filas })
    }
    extras.sort((a, b) => b.extraGzip - a.extraGzip)
    res.extrasPorRuta = extras
  } else {
    res.bootSet = { error: 'dist/.vite/manifest.json no existe; corre `npx vite build --manifest` para boot set y extras' }
  }
  writeFileSync(join(outDir, 'chunks.json'), JSON.stringify(res, null, 2) + '\n')
  return res
}

// ------------------------------------------------------------------ corrida
async function runLighthouse({ device, page, corrida, base, chrome, port, outDir, archivo, extraArgs, log }) {
  const rawTmp = join(TMP_ROOT, `q1-lhr-${device}-${page}-r${corrida}.json`)
  const cmd = argsLh(`${base}${PAGES[page].url}`, rawTmp, extraArgs, chrome, port)
  log(`LH ${device}/${page}/run${corrida}: npx ${cmd.slice(2).join(' ')}`)
  const t0 = Date.now()
  const resultado = await new Promise((res) => {
    const p = spawn('npx', cmd, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    p.stderr.on('data', (d) => {
      stderr = (stderr + d).slice(-6000)
    })
    p.on('close', (code) => res({ code, stderr }))
  })
  const elapsedS = +((Date.now() - t0) / 1000).toFixed(1)
  const row = { device, page, run: corrida, file: archivo, elapsedS, error: null, auditoriasLt1: [] }
  if (resultado.code !== 0) {
    row.error = `lighthouse exit=${resultado.code} | stderr: ${resultado.stderr.slice(-400)}`
    log(`FALLO ${device}/${page}/run${corrida}: ${row.error}`)
    return row
  }
  try {
    const lhr = JSON.parse(readFileSync(rawTmp, 'utf8'))
    Object.assign(row, extractMetrics(lhr))
    row.auditoriasLt1 = extraerAuditoriasFallidas(lhr)
    if (page !== 'login' && /\/login\/?$/.test(row.finalUrl || '')) {
      row.error = `la sesión no sobrevivió la corrida: Lighthouse terminó en ${row.finalUrl}`
    }
    writeFileSync(join(outDir, archivo), JSON.stringify(slimLhr(lhr)))
    rmSync(rawTmp, { force: true })
  } catch (err) {
    row.error = err.message
    log(`FALLO ${device}/${page}/run${corrida}: ${err.message}`)
  }
  log(`LISTO ${device}/${page}/run${corrida} (${elapsedS}s) perf=${row.scores?.performance} a11y=${row.scores?.accessibility} bp=${row.scores?.['best-practices']} lcp=${Math.round(row.lcpMs ?? 0)} aud<1=${row.auditoriasLt1 ? row.auditoriasLt1.length : 0}`)
  return row
}

// ------------------------------------------------------------------- main
async function main() {
  const args = parseArgs(process.argv.slice(2))
  const scriptPath = resolve(new URL(import.meta.url).pathname)
  const repoRoot = findRepoRoot(dirname(scriptPath))
  const frontendDir = join(repoRoot, 'frontend')
  const outDir = resolve(args.out || join(repoRoot, 'docs', 'archive', 'audits', '2026-10-14', 'frontend-movil', 'lighthouse-base'))
  const base = args.base || 'http://127.0.0.1:5183'
  const chrome = args.chrome || '/usr/bin/google-chrome'
  const runs = Math.max(1, Number(args.runs || 3))
  const dispositivosPorDefecto = Object.keys(DEVICE_FLAGS).join(',')
  const devices = String(args.devices || dispositivosPorDefecto).split(',').map((s) => s.trim()).filter(Boolean)
  const pages = String(args.pages || 'login,portada,administracion').split(',').map((s) => s.trim()).filter(Boolean)
  const skipExisting = !!args['skip-existing']
  const dryRun = !!args['dry-run']
  const conSizes = !args['no-sizes']

  for (const d of devices) if (!DEVICE_FLAGS[d]) throw new Error(`Dispositivo desconocido: ${d} (usa: ${dispositivosPorDefecto})`)
  for (const p of pages) if (!PAGES[p]) throw new Error(`Página desconocida: ${p} (usa: ${Object.keys(PAGES).join(', ')})`)

  mkdirSync(outDir, { recursive: true })
  const logPath = join(outDir, 'ejecucion.log')
  const log = (line) => {
    const stamp = new Date().toISOString()
    writeFileSync(logPath, `[${stamp}] ${line}\n`, { flag: 'a' })
    console.log(`[${stamp}] ${line}`)
  }
  log(`Q1 baseline: base=${base} devices=${devices.join(',')} pages=${pages.join(',')} runs=${runs} out=${outDir}`)

  const envPath = join(frontendDir, '.env.local')
  if (!existsSync(envPath)) throw new Error('Falta frontend/.env.local (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY del Supabase LOCAL).')
  const envText = readFileSync(envPath, 'utf8')
  if (!/VITE_SUPABASE_URL=/.test(envText) || !/VITE_SUPABASE_ANON_KEY=/.test(envText)) {
    throw new Error('frontend/.env.local no declara VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }
  if (!existsSync(join(frontendDir, 'dist', 'index.html'))) {
    throw new Error('Falta dist/index.html; corre `npm run build --prefix frontend` antes de medir.')
  }

  if (conSizes) {
    colectarSizes(frontendDir, outDir)
    log(`chunks.json escrito en ${outDir}`)
  }

  if (dryRun) {
    const tmpLh = join(TMP_ROOT, 'q1-lhr-dry.json')
    for (const p of pages) {
      for (const d of devices) {
        const extra = [...DEVICE_FLAGS[d], ...(PAGES[p].authed ? ['--disable-storage-reset'] : [])]
        log(`[dry-run] npx ${argsLh(`${base}${PAGES[p].url}`, tmpLh, extra, chrome, 9222).join(' ')}`)
      }
    }
    log('dry-run ok')
    return
  }

  // Espera el servidor de medición.
  let ok = false
  for (let i = 0; i < 45; i++) {
    try {
      const r = await fetch(`${base}/login`)
      if (r.ok) {
        ok = true
        break
      }
    } catch {}
    await sleep(700)
  }
  if (!ok) throw new Error(`El servidor de medición no responde en ${base}. Levántalo con servidor-local-a3.mjs --port 5183`)
  log(`Servidor de medición OK en ${base}`)

  // Chrome headless persistente, perfil limpio por invocación.
  const port = await freePort(9222)
  const profileDir = join(TMP_ROOT, `q1-chrome-profile-${Date.now()}`)
  mkdirSync(profileDir, { recursive: true })
  log(`Chrome headless en puerto CDP ${port} (perfil ${profileDir})`)
  const chromeProc = spawn(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--window-size=1400,1000',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  )
  const cierreChrome = async () => {
    try {
      chromeProc?.kill('SIGTERM')
    } catch {}
    await sleep(700)
    try {
      chromeProc?.kill('SIGKILL')
    } catch {}
    rmSync(profileDir, { recursive: true, force: true })
  }
  process.on('SIGINT', async () => {
    await cierreChrome()
    process.exit(130)
  })

  let versionWs = null
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      versionWs = await r.json()
      if (versionWs?.webSocketDebuggerUrl) break
    } catch {}
    await sleep(500)
  }
  if (!versionWs?.webSocketDebuggerUrl) {
    await cierreChrome()
    throw new Error('Chrome headless no quedó a la escucha en CDP.')
  }

  const browser = await connectCdp(versionWs.webSocketDebuggerUrl)
  const runRows = []
  const fallos = []
  const t0Total = Date.now()

  const registroCorrida = async (device, page, corrida, archivo, extraArgs) => {
    try {
      const row = await runLighthouse({ device, page, corrida, base, chrome, port, outDir, archivo, extraArgs, log })
      runRows.push(row)
      if (row.error) fallos.push(`${device}/${page}/run${corrida}: ${row.error}`)
    } catch (err) {
      fallos.push(`${device}/${page}/run${corrida}: ${err.message}`)
      log(`FALLO ${device}/${page}/run${corrida}: ${err.message}`)
    }
  }
  const reutilizarSiExiste = (device, page, corrida, archivo) => {
    const destino = join(outDir, archivo)
    if (!(skipExisting && existsSync(destino))) return false
    log(`skip-existing: ${archivo}`)
    try {
      const existente = JSON.parse(readFileSync(destino, 'utf8'))
      runRows.push({ device, page, run: corrida, file: archivo, reutilizado: true, auditoriasLt1: [], ...extractMetrics(existente) })
    } catch {
      fallos.push(`${archivo}: archivo existente ilegible`)
    }
    return true
  }

  // Pestaña de control: limpia localStorage y la cache HTTP entre corridas.
  const { targetId: controlTargetId } = await browser.send('Target.createTarget', { url: `${base}/login` })
  const controlSession = (await browser.send('Target.attachToTarget', { targetId: controlTargetId, flatten: true })).sessionId
  const control = { targetId: controlTargetId, sessionId: controlSession, send: (m, p) => browser.send(m, p, controlSession) }
  await esperar((s) => s.listo || s.authed, control, { mensaje: 'no cargó la pestaña de control', timeoutMs: 30_000 })
  await control.send('Network.enable', {})
  const limpiarCacheHttp = async () => {
    await control.send('Network.clearBrowserCache', {})
  }

  try {
    // 1) Corridas anónimas de /login (storage limpio entre corridas).
    if (pages.includes('login')) {
      for (const d of devices) {
        for (let r = 1; r <= runs; r++) {
          const archivo = `${d}-login-run${r}.lhr.json`
          if (reutilizarSiExiste(d, 'login', r, archivo)) continue
          await limpiarSesion(control, base)
          await registroCorrida(d, 'login', r, archivo, DEVICE_FLAGS[d])
        }
      }
    }

    // 2) Rutas autenticadas: una sesión por usuario.
    const usuarios = [...new Set(pages.filter((p) => PAGES[p].authed).map((p) => PAGES[p].user))]
    for (const usuario of usuarios) {
      const paginasUsuario = pages.filter((p) => PAGES[p].authed && PAGES[p].user === usuario)
      const sesion = await iniciarSesion(browser, base, USERS[usuario])
      log(`Sesión iniciada como ${usuario} (${USERS[usuario].email})`)
      try {
        for (const p of paginasUsuario) {
          for (const d of devices) {
            for (let r = 1; r <= runs; r++) {
              const archivo = `${d}-${p}-run${r}.lhr.json`
              if (reutilizarSiExiste(d, p, r, archivo)) continue
              await limpiarCacheHttp()
              await registroCorrida(d, p, r, archivo, [...DEVICE_FLAGS[d], '--disable-storage-reset'])
            }
          }
        }
      } finally {
        await browser.send('Target.closeTarget', { targetId: sesion.targetId }).catch(() => {})
      }
    }
  } finally {
    await browser.send('Target.closeTarget', { targetId: controlTargetId }).catch(() => {})
    browser.close()
    await cierreChrome()
  }

  // 3) resumen.json con medianas por dispositivo × página + auditorías fallidas por corrida.
  const porPar = new Map()
  for (const row of runRows) {
    const k = `${row.device}:${row.page}`
    if (!porPar.has(k)) porPar.set(k, [])
    porPar.get(k).push(row)
  }
  const medianas = {}
  for (const [k, lista] of porPar) {
    const [device, page] = k.split(':')
    const m = { runs: lista.length }
    for (const c of CATEGORIES) m[c] = median(lista.map((x) => x.scores?.[c] ?? 0))
    m.fcpMs = median(lista.map((x) => x.fcpMs ?? 0))
    m.lcpMs = median(lista.map((x) => x.lcpMs ?? 0))
    m.tbtMs = median(lista.map((x) => x.tbtMs ?? 0))
    m.cls = median(lista.map((x) => x.cls ?? 0))
    m.transferBytes = median(lista.map((x) => x.transferBytes ?? 0))
    medianas[device] = medianas[device] || {}
    medianas[device][page] = m
  }
  writeFileSync(
    join(outDir, 'resumen.json'),
    JSON.stringify(
      {
        generado: new Date().toISOString(),
        base,
        runs,
        lighthouseVersion: LH_VERSION,
        metodo: {
          categorias: CATEGORIES.join(','),
          dispositivos: DEVICE_FLAGS,
          autenticacion: 'sesión real por el formulario de /login (CDP sobre el Chrome persistente); token supabase-js en localStorage',
          flagsAutenticadas: ['--disable-storage-reset', '+ Network.clearBrowserCache (CDP) antes de cada corrida: cache HTTP fría'],
          servidor: 'servidor-local-a3.mjs (static dist + cabeceras vercel.json con connect-src += Supabase local; NO vite preview)',
        },
        runs: runRows,
        medianas,
        fallos,
      },
      null,
      2,
    ) + '\n',
  )

  // 3b) resultados.csv: una fila por corrida (scores y fallidas por id).
  const idsAuditorias = [...new Set(runRows.flatMap((row) => (row.auditoriasLt1 ?? []).map((a) => a.id)))].sort()
  const csv = [
    ['dispositivo', 'pagina', 'corrida', 'perf', 'a11y', 'bestPractices', 'fcpMs', 'lcpMs', 'tbtMs', 'cls', 'transferBytes', 'elapsedS', 'error', ...idsAuditorias].join(','),
  ]
  for (const r of runRows) {
    const fallidas = new Set((r.auditoriasLt1 ?? []).map((a) => a.id))
    csv.push(
      [
        r.device, r.page, r.run, r.scores?.performance ?? '', r.scores?.accessibility ?? '', r.scores?.['best-practices'] ?? '',
        Math.round(r.fcpMs ?? 0), Math.round(r.lcpMs ?? 0), Math.round(r.tbtMs ?? 0), (r.cls ?? 0).toFixed(3),
        Math.round(r.transferBytes ?? 0), r.elapsedS ?? '', (r.error ?? '').replaceAll(',', ';'),
        ...idsAuditorias.map((id) => (fallidas.has(id) ? 1 : '')),
      ].join(','),
    )
  }
  writeFileSync(join(outDir, 'resultados.csv'), csv.join('\n') + '\n')

  // 4) tabla markdown con las medianas.
  const tabla = [
    '| Dispositivo | Página | Performance | Accessibility | Best Practices | LCP (ms) | TBT (ms) | CLS | Transferido (B) |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]
  for (const [d, paginasMed] of Object.entries(medianas)) {
    for (const [p, m] of Object.entries(paginasMed)) {
      tabla.push(
        `| ${d} | ${p} | ${m.performance} | ${m.accessibility} | ${m['best-practices']} | ${Math.round(m.lcpMs)} | ${Math.round(m.tbtMs)} | ${(m.cls ?? 0).toFixed(3)} | ${fmtBytes(m.transferBytes)} |`,
      )
    }
  }
  log('=== MEDIANAS (por combinación) ===')
  for (const linea of tabla) log(linea)
  log(`Duración total: ${((Date.now() - t0Total) / 1000).toFixed(0)} s; fallos: ${fallos.length}`)

  // 5) Presupuesto de salida: comprime los LHR si el total supera el límite.
  let total = 0
  for (const f of readdirSync(outDir)) total += statSync(join(outDir, f)).size
  if (total > OUT_LIMIT_BYTES) {
    for (const f of readdirSync(outDir)) {
      if (!f.endsWith('.lhr.json')) continue
      const gz = gzipSync(readFileSync(join(outDir, f)), { level: 9 })
      writeFileSync(join(outDir, `${f}.gz`), gz)
      rmSync(join(outDir, f), { force: true })
    }
    let totalGz = 0
    for (const f of readdirSync(outDir)) totalGz += statSync(join(outDir, f)).size
    log(`LHR comprimidos a .gz: total ${totalGz} B (sin comprimir eran ${total} B, límite ${OUT_LIMIT_BYTES} B)`)
  }

  if (fallos.length) {
    log(`CON FALLOS: ${fallos.join(' ; ')}`)
    process.exitCode = 2
  }
}

main().catch((err) => {
  console.error('Q1 baseline: ERROR', err)
  process.exit(1)
})
