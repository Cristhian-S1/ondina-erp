#!/usr/bin/env node
// A3 - Servidor local de medición: static de frontend/dist + proxy de la API de
// Supabase local, para que la app y su backend compartan origen (127.0.0.1:5183).
//
// Por qué existe: Chrome 142+ (Local Network Access) bloquea en headless los fetch
// de una página local hacia otro puerto de loopback (p. ej. 5183 -> 54321), lo que
// impide iniciar sesión en el frontend servido con `vite preview`. Sirviendo el
// bundle y la API en el MISMO origen la app funciona en el navegador embebido y en
// Lighthouse, con la misma payload estática que genera `vite preview` (gzip incl.).
//
// Uso tras `npm run build --prefix frontend`:
//   VITE_SUPABASE_URL=http://127.0.0.1:5183   # en frontend/.env.local, luego rebuild
//   node docs/archive/audits/2026-10-13/frontend-ux/scripts/servidor-local-a3.mjs \
//        --port 5183 --target http://127.0.0.1:54321
//
// Las rutas /auth/*, /rest/*, /realtime/*, /storage/*, /functions/* y
// /supabase/* se reenvían al target; el resto se sirve desde dist con fallback
// SPA a index.html (mismo comportamiento que `vite preview`).

import { createServer, request as httpRequest } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    if (!raw.startsWith('--')) continue
    const eq = raw.indexOf('=')
    if (eq >= 0) args[raw.slice(2)] = raw.slice(eq + 1)
    else args[raw.slice(2)] = argv[++i] ?? 'true'
  }
  return args
}

const argv = parseArgs(process.argv.slice(2))
const scriptPath = resolve(new URL(import.meta.url).pathname)
let repoRoot = scriptPath
for (let d = scriptPath; d !== '/'; d = join(d, '..')) {
  if (existsSync(join(d, 'frontend', 'package.json'))) {
    repoRoot = d
    break
  }
}
const PORT = Number(argv.port || 5183)
const TARGET = argv.target || 'http://127.0.0.1:54321'
const DIST = resolve(argv.dist || join(repoRoot, 'frontend', 'dist'))
const PROXY_PATTERNS = ['/auth/', '/rest/', '/realtime/', '/storage/', '/functions/', '/supabase/']

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}
const GEO_COMPRESSED = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt'])

function proxyHandler(req, res) {
  const destino = new URL(req.url, TARGET)
  const upstream = httpRequest(
    {
      hostname: destino.hostname,
      port: destino.port || 80,
      path: destino.pathname + destino.search,
      method: req.method,
      headers: { ...req.headers, host: `${destino.hostname}:${destino.port || 80}` },
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers)
      up.pipe(res)
    },
  )
  upstream.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'proxy-error', message: err.message }))
  })
  req.pipe(upstream)
}

function staticHandler(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  let relPath = decodeURIComponent(normalize(url.pathname).replace(/\.\.+/g, '.'))
  if (relPath === '/' || relPath === '') relPath = '/index.html'
  let file = join(DIST, relPath)
  if (!existsSync(file) || !statSync(file).isFile()) {
    // Fallback SPA: cualquier ruta sin extensión sirve el index (como vite preview).
    file = join(DIST, 'index.html')
  }
  if (!existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('No existe el archivo solicitado en dist.')
    return
  }
  const ext = extname(file).toLowerCase()
  const tipo = MIME[ext] || 'application/octet-stream'
  const aceptaGzip = /gzip/.test(String(req.headers['accept-encoding'] || ''))
  const cuerpo = GEO_COMPRESSED.has(ext) && aceptaGzip ? gzipSync(readFileSync(file)) : readFileSync(file)
  const headers = {
    'Content-Type': tipo,
    'Content-Length': cuerpo.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
  }
  // gzip para los tipos de texto de dist, igual que hace vite preview
  if (GEO_COMPRESSED.has(ext) && aceptaGzip) headers['Content-Encoding'] = 'gzip'
  res.writeHead(200, headers)
  res.end(cuerpo)
}

const server = createServer((req, res) => {
  if (PROXY_PATTERNS.some((p) => req.url.startsWith(p))) proxyHandler(req, res)
  else staticHandler(req, res)
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[a3-servidor] sirviendo dist=${DIST} en http://127.0.0.1:${PORT} (proxy de ${TARGET} para ${PROXY_PATTERNS.join(' ')})`)
})
process.on('SIGTERM', () => server.close(() => process.exit(0)))
process.on('SIGINT', () => server.close(() => process.exit(0)))
