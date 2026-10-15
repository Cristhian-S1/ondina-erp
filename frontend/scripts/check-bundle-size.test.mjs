import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import ts from 'typescript'
import { evaluateBudget, measureBundle, parseInitialAssets } from './check-bundle-size.mjs'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporales = []
function temporal() {
  const dir = mkdtempSync(join(tmpdir(), 'ondina-bundle-test-'))
  temporales.push(dir)
  return dir
}
afterEach(() => { for (const dir of temporales.splice(0)) rmSync(dir, { recursive: true, force: true }) })

// Datos poco compresibles y deterministas: el gzip debe crecer por contenido, no por longitud repetida.
function contenido(longitud) {
  let estado = 42
  return Array.from({ length: longitud }, () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0
    return String.fromCharCode(33 + (estado % 90))
  }).join('')
}
function fixture() {
  const root = temporal()
  mkdirSync(join(root, 'scripts'))
  mkdirSync(join(root, 'dist/assets'), { recursive: true })
  copyFileSync(join(frontend, 'scripts/check-bundle-size.mjs'), join(root, 'scripts/check-bundle-size.mjs'))
  const entry = contenido(400)
  const preload = contenido(400)
  const css = 'body { color: navy; }'
  const extraCss = '.tarjeta { display: grid; }'
  const archivos = { 'entry.js': entry, 'vendor.js': preload, 'entry.css': css, 'extra.css': extraCss, 'lazy.js': contenido(300) }
  for (const [name, data] of Object.entries(archivos)) writeFileSync(join(root, 'dist/assets', name), data)
  writeFileSync(join(root, 'dist/index.html'), `
    <script type="module" src="/assets/entry.js"></script>
    <link rel="modulepreload" href="/assets/vendor.js">
    <link rel="stylesheet" href="/assets/entry.css">
    <link href='/assets/extra.css' rel='stylesheet'>
    <link href='/assets/vendor.js' rel='modulepreload'>`)
  const gzip = (data) => gzipSync(data).length
  const budget = {
    baseline: { date: '2026-10-13', commit: 'fixture', entryJsGzipBytes: gzip(entry), entryCssGzipBytes: gzip(css), largestJsChunkRawBytes: 10000,
      initialJsGzipBytes: gzip(entry) + gzip(preload), initialCssGzipBytes: gzip(css) + gzip(extraCss) },
    headroomPercent: 10,
  }
  writeFileSync(join(root, 'bundle-budget.json'), JSON.stringify(budget))
  return { root, budget, entry, preload, css, extraCss, gzip }
}
function ejecutar(root) {
  return spawnSync(process.execPath, [join(root, 'scripts/check-bundle-size.mjs')], { encoding: 'utf8' })
}

describe('presupuesto inicial del bundle', () => {
  it('muestra cinco métricas y pasa dentro del límite con preloads deduplicados y todas las hojas CSS', () => {
    const { root } = fixture()
    const result = ejecutar(root)
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('JS inicial total (gzip)')
    expect(result.stdout).toContain('CSS inicial total (gzip)')
    expect(result.stdout.match(/\sOK$/gm)).toHaveLength(5)
  })

  it('falla si crece un preload aunque el entry disminuya y las métricas históricas pasen', () => {
    const { root } = fixture()
    writeFileSync(join(root, 'dist/assets/entry.js'), contenido(100))
    writeFileSync(join(root, 'dist/assets/vendor.js'), contenido(1600))
    const result = ejecutar(root)
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/JS de entrada \(gzip\).*OK/)
    expect(result.stdout).toMatch(/JS inicial total \(gzip\).*SUPERA/)
  })

  it('falla si crece una segunda hoja CSS, aunque la hoja de entrada siga dentro del límite', () => {
    const { root } = fixture()
    writeFileSync(join(root, 'dist/assets/extra.css'), contenido(1600))
    const result = ejecutar(root)
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/CSS de entrada \(gzip\).*OK/)
    expect(result.stdout).toMatch(/CSS inicial total \(gzip\).*SUPERA/)
  })

  it('falla con un mensaje útil si falta un archivo inicial', () => {
    const { root } = fixture()
    rmSync(join(root, 'dist/assets/vendor.js'))
    const result = ejecutar(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('[bundle]')
    expect(result.stderr).toContain('vendor.js')
  })
})

it.each(['app', 'node'])('resuelve strict explícito en tsconfig.%s', (proyecto) => {
  const config = ts.getParsedCommandLineOfConfigFile(join(frontend, `tsconfig.${proyecto}.json`), {}, {
    ...ts.sys, onUnRecoverableConfigFileDiagnostic: (diagnostic) => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')) },
  })
  expect(config.options.strict).toBe(true)
})

it('separa Supabase en un vendor precargado y mantiene la página como import dinámico', { timeout: 30000 }, () => {
  // Q1 (OND-c07.19): build de Vite real en un proceso hijo; medido 5,4 s bajo
  // saturación (2026-10-14, loadavg ≈ 31) frente al muro de 5 s. Se da un
  // presupuesto explícito de 30 s porque la latencia la domina el spawn, no la lógica.
  const root = temporal()
  const pack = join(root, 'node_modules/@supabase/supabase-js')
  mkdirSync(pack, { recursive: true })
  writeFileSync(join(pack, 'package.json'), JSON.stringify({ name: '@supabase/supabase-js', type: 'module', exports: './index.js' }))
  writeFileSync(join(pack, 'index.js'), 'export const createClient = () => ({ auth: "fixture" })')
  writeFileSync(join(root, 'index.html'), '<script type="module" src="/main.js"></script>')
  writeFileSync(join(root, 'main.js'), 'import { createClient } from "@supabase/supabase-js"; window.cliente = createClient(); window.abrir = () => import("./pagina.js")')
  writeFileSync(join(root, 'pagina.js'), 'export const pagina = "pagina diferida"')
  const codigo = `import { build, loadConfigFromFile } from ${JSON.stringify(join(frontend, 'node_modules/vite/dist/node/index.js'))};
    const { config } = await loadConfigFromFile({ command: 'build', mode: 'production' }, ${JSON.stringify(join(frontend, 'vite.config.ts'))});
    await build({ ...config, configFile: false, root: ${JSON.stringify(root)}, logLevel: 'silent', build: { ...config.build, manifest: true } });`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', codigo], { encoding: 'utf8', cwd: frontend })
  expect(result.status, result.stderr).toBe(0)
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8')
  expect(html).toMatch(/rel="modulepreload"[^>]*vendor-supabase/)
  expect(html).not.toMatch(/rel="modulepreload"[^>]*pagina/)
  const manifest = JSON.parse(readFileSync(join(root, 'dist/.vite/manifest.json'), 'utf8'))
  expect(manifest['index.html'].dynamicImports).toContain('pagina.js')
})

it('keeps the authenticated shell, domain metadata and form libraries outside the real login boot set', { timeout: 30000 }, () => {
  const outDir = join(temporal(), 'dist')
  const code = `import { build } from ${JSON.stringify(join(frontend, 'node_modules/vite/dist/node/index.js'))};
    await build({ root: ${JSON.stringify(frontend)}, logLevel: 'silent', build: { outDir: ${JSON.stringify(outDir)}, manifest: true, sourcemap: 'hidden' } });`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', cwd: frontend, env: { ...process.env, NODE_ENV: 'production' } })
  expect(result.status, result.stderr).toBe(0)
  const manifest = JSON.parse(readFileSync(join(outDir, '.vite/manifest.json'), 'utf8'))
  const html = readFileSync(join(outDir, 'index.html'), 'utf8')
  const inline = html.match(/<style data-bundle-css="([^"]+)">([\s\S]*?)<\/style>/)
  expect(inline).not.toBeNull()
  expect(inline[2]).toBe(readFileSync(join(outDir, inline[1]), 'utf8'))
  expect(html).not.toMatch(/<link\b[^>]*rel="stylesheet"/)
  expect(readdirSync(join(outDir, 'assets'))).toContainEqual(expect.stringMatching(/^logo-.*\.jpg$/))
  const initialJs = parseInitialAssets(html).initialJs
    .map((file) => readFileSync(join(outDir, file), 'utf8')).join('\n')
  expect(initialJs).not.toContain('data:image/jpeg;base64,')
  const initialCssFile = inline[1].replace(/^\//, '')
  const emittedJs = readdirSync(join(outDir, 'assets')).filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(join(outDir, 'assets', file), 'utf8')).join('\n')
  expect(emittedJs).not.toContain(initialCssFile)
  const initialKeys = new Set()
  function visit(key) {
    if (initialKeys.has(key)) return
    initialKeys.add(key)
    for (const dependency of manifest[key].imports ?? []) visit(dependency)
  }
  visit('index.html')
  const initialSources = [...initialKeys].flatMap((key) => {
    const map = JSON.parse(readFileSync(join(outDir, `${manifest[key].file}.map`), 'utf8'))
    return map.sources
  }).join('\n')
  expect(initialSources).not.toMatch(/src\/domains\//)
  expect(initialSources).not.toMatch(/src\/(components\/DashboardLayout|pages\/Dashboard)\.tsx/)
  expect(initialSources).not.toMatch(/node_modules\/(zod|react-hook-form)\//)
  expect(initialSources).not.toMatch(/queryObserver\.js/)
  const allSources = readdirSync(join(outDir, 'assets')).filter((file) => file.endsWith('.js.map'))
    .flatMap((file) => JSON.parse(readFileSync(join(outDir, 'assets', file), 'utf8')).sources).join('\n')
  expect(allSources).toContain('src/components/DashboardLayout.tsx')
  expect(allSources).toContain('src/domains/ventas/pages/RegistrarVenta.tsx')
})


it('mide exactamente archivos únicos y excluye el JS lazy del total inicial', () => {
  const { root, entry, preload, css, extraCss, gzip } = fixture()
  expect(measureBundle(join(root, 'dist'))).toEqual({
    entryJsGzipBytes: gzip(entry), entryCssGzipBytes: gzip(css), largestJsChunkRawBytes: 400,
    initialJsGzipBytes: gzip(entry) + gzip(preload), initialCssGzipBytes: gzip(css) + gzip(extraCss),
  })
})

it('counts emitted inline CSS and catches its growth even when the external asset stays small', () => {
  const { root, budget, entry, preload, gzip } = fixture()
  const inlineCss = contenido(1600)
  writeFileSync(join(root, 'dist/index.html'), `<script type="module" src="/assets/entry.js"></script>
    <link rel="modulepreload" href="/assets/vendor.js">
    <style data-bundle-css="/assets/entry.css">${inlineCss}</style>`)
  const measured = measureBundle(join(root, 'dist'))
  expect(measured.initialJsGzipBytes).toBe(gzip(entry) + gzip(preload))
  expect(measured.entryCssGzipBytes).toBe(gzip(inlineCss))
  expect(measured.initialCssGzipBytes).toBe(gzip(inlineCss))
  expect(evaluateBudget(measured, budget).find((m) => m.key === 'initialCssGzipBytes').exceeded).toBe(true)
})

it('counts inline and linked CSS together without losing a second stylesheet', () => {
  const { root, css, extraCss, gzip } = fixture()
  writeFileSync(join(root, 'dist/index.html'), `<script type="module" src="/assets/entry.js"></script>
    <style data-bundle-css="/assets/entry.css">${css}</style>
    <link rel="stylesheet" href="/assets/extra.css">`)
  expect(measureBundle(join(root, 'dist')).initialCssGzipBytes).toBe(gzip(css) + gzip(extraCss))
})

it('acepta el límite redondeado y rechaza el primer byte adicional', () => {
  const { budget } = fixture()
  const metric = 'initialJsGzipBytes'
  const limite = Math.ceil(budget.baseline[metric] * 1.1)
  const measurements = { ...budget.baseline, [metric]: limite }
  expect(evaluateBudget(measurements, budget).find((m) => m.key === metric).exceeded).toBe(false)
  expect(evaluateBudget({ ...measurements, [metric]: limite + 1 }, budget).find((m) => m.key === metric).exceeded).toBe(true)
})

it('rechaza un presupuesto que omite el conjunto inicial', () => {
  const { budget } = fixture()
  const measurements = { ...budget.baseline }
  delete budget.baseline.initialJsGzipBytes
  expect(() => evaluateBudget(measurements, budget)).toThrow('initialJsGzipBytes')
})

it('lee atributos en distinto orden y comillas simples sin contar scripts clásicos', () => {
  const assets = parseInitialAssets(`<script src='analitica.js'></script>
    <script src='entrada.js' type='module'></script>
    <link href='vendor.js' crossorigin rel='modulepreload'>
    <link href='base.css' rel='stylesheet'>`)
  expect(assets).toEqual({ entryJs: 'entrada.js', entryCss: 'base.css', initialJs: ['entrada.js', 'vendor.js'], initialCss: ['base.css'] })
})
