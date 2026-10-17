#!/usr/bin/env node
// A3 - Servidor local de medición: static de frontend/dist + fallback SPA + las
// mismas cabeceras de security que aplica `vite preview` (difieren de vercel.json
// via frontend/vite.config.ts:17), con UNA excepción: la política CSP copiada
// añade http://<supabase-local> y ws://<supabase-local> a connect-src para que el
// navegador de pruebas pueda alcanzar el backend local (127.0.0.1:54321) en lugar
// de *.supabase.co.
//
// Contexto: vercel.json declara connect-src 'self' https://*.supabase.co
// wss://*.supabase.co; con esa CSP intacta, `vite preview` sirve la app y los
// fetch de supabase-js hacia el stack local se bloquean ('TypeError: Failed to
// fetch': no es un problema de red). NO se modifica vite.config.ts/vercel.json:
// este servidor es solo el artilugio de medición.
//
// Uso tras `npm run build --prefix frontend` (build con .env.local apuntando a
// Supabase local, VITE_SUPABASE_URL=http://127.0.0.1:54321):
//   node docs/archive/audits/2026-10-13/frontend-ux/scripts/servidor-local-a3.mjs \
//        --port 5183 --supabase http://127.0.0.1:54321

import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

function findRoot(startDir) {
  let d = startDir
  while (d !== '/' && d !== '.') {
    if (existsSync(join(d, 'frontend', 'package.json'))) return d
    d = join(d, '..')
  }
  throw new Error('No se encontró la raíz del repo (directorio con frontend/package.json).')
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

const args = parseArgs(process.argv.slice(2))
const repoRoot = findRoot(resolve(new URL(import.meta.url).pathname))
const PORT = Number(args.port || 5183)
const SUPA = args.supabase || 'http://127.0.0.1:54321'
const SUPA_HOST = new URL(SUPA).host
const DIST = resolve(args.dist || join(repoRoot, 'frontend', 'dist'))

// Cabeceras de vercel.json (las mismas que inyecta vite preview) + parche CSP.
const vercel = JSON.parse(readFileSync(join(repoRoot, 'frontend', 'vercel.json'), 'utf8'))
const LEAL = 'http://' + SUPA_HOST
const WS_LOCAL = 'ws://' + SUPA_HOST
const excepcionCsp = ` ${LEAL} ${WS_LOCAL}`
function parcheCsp(valor) {
  if (/connect-src([^;]*)/.test(valor)) {
    return valor.replace(/connect-src([^;]*)/, (m, g1) => `connect-src${g1}${excepcionCsp}`)
  }
  return `${valor}; connect-src 'self'${excepcionCsp}`
}
const cabeceras = vercel.headers
  .filter((entry) => entry.source === '/(.*)')
  .flatMap((entry) => entry.headers.map(({ key, value }) => [key, key.toLowerCase() === 'content-security-policy' ? parcheCsp(value) : value]))

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
const TIPOS_GZIP = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt'])

function servir(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  let relPath = decodeURIComponent(normalize(url.pathname))
  if (relPath === '/' || relPath === '') relPath = '/index.html'
  let archivo = join(DIST, relPath)
  if (!existsSync(archivo) || !statSync(archivo).isFile()) {
    // Fallback SPA: cualquier ruta sin archivo sirve el index (como vite preview).
    archivo = join(DIST, 'index.html')
  }
  if (!existsSync(archivo)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('No existe el archivo solicitado en dist.')
    return
  }
  const ext = extname(archivo).toLowerCase()
  const tipo = MIME[ext] || 'application/octet-stream'
  const aceptaGzip = /gzip/.test(String(req.headers['accept-encoding'] || ''))
  const body = TIPOS_GZIP.has(ext) && aceptaGzip ? gzipSync(readFileSync(archivo)) : readFileSync(archivo)
  const headers = new Map(cabeceras)
  headers.set('Content-Type', tipo)
  headers.set('Content-Length', String(body.length))
  // Segunda excepción documentada: Vercel agrega (más allá de vercel.json) caching
  // inmutable para los assets con hash del build; aquí se replica para que las
  // auditorías de cache no midan la falta del CDN.
  if (/^\/assets\//.test(url.pathname) && archivo !== join(DIST, 'index.html')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  } else if (ext === '.html') {
    headers.set('Cache-Control', 'no-cache')
  }
  if (TIPOS_GZIP.has(ext) && aceptaGzip) headers.set('Content-Encoding', 'gzip')
  res.writeHead(200, Object.fromEntries(headers))
  res.end(body)
}

const server = createServer(servir).listen(PORT, '127.0.0.1', () => {
  console.log(`[a3-servidor] dist=${DIST} en http://127.0.0.1:${PORT}; cabeceras de vercel.json aplicadas con connect-src += ${excepcionCsp.trim()}`)
})
process.on('SIGTERM', () => server.close(() => process.exit(0)))
process.on('SIGINT', () => server.close(() => process.exit(0)))
