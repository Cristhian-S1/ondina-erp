import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
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

it('separa Supabase en un vendor precargado y mantiene la página como import dinámico', () => {
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


it('mide exactamente archivos únicos y excluye el JS lazy del total inicial', () => {
  const { root, entry, preload, css, extraCss, gzip } = fixture()
  expect(measureBundle(join(root, 'dist'))).toEqual({
    entryJsGzipBytes: gzip(entry), entryCssGzipBytes: gzip(css), largestJsChunkRawBytes: 400,
    initialJsGzipBytes: gzip(entry) + gzip(preload), initialCssGzipBytes: gzip(css) + gzip(extraCss),
  })
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
