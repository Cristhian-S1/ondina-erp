// Reproduce the Supabase partition experiment without altering the operating dist.
// Usage: node <this-file> [output.json]
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

let root = dirname(fileURLToPath(import.meta.url))
while (!existsSync(join(root, 'frontend/package.json'))) root = dirname(root)
const frontend = join(root, 'frontend')
process.env.NODE_ENV = 'production'
const { build, loadConfigFromFile } = await import(pathToFileURL(join(frontend, 'node_modules/vite/dist/node/index.js')))
const { decode } = await import(pathToFileURL(join(frontend, 'node_modules/@jridgewell/sourcemap-codec/dist/sourcemap-codec.mjs')))
const temporary = mkdtempSync(join(tmpdir(), 'ondina-l1-partition-'))

function sourceGroup(source) {
  const dependency = source.match(/node_modules\/(?:@([^/]+)\/)?([^/]+)\//)
  if (dependency) return (dependency[1] ? `@${dependency[1]}/` : '') + dependency[2]
  return source.includes('/src/') ? 'application' : 'runtime/unmapped'
}
function inspect(dist) {
  const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json')))
  const keys = new Set()
  function visit(key) {
    if (keys.has(key)) return
    keys.add(key)
    for (const next of manifest[key].imports ?? []) visit(next)
  }
  visit('index.html')
  const attribution = {}
  const files = [...keys].map((key) => {
    const file = manifest[key].file
    const bytes = readFileSync(join(dist, file))
    const map = JSON.parse(readFileSync(join(dist, `${file}.map`)))
    const lines = bytes.toString().split('\n')
    const groups = {}
    for (const [lineIndex, segments] of decode(map.mappings).entries()) {
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        if (segment.length < 4) continue
        const group = sourceGroup(map.sources[segment[1]])
        const end = segments[i + 1]?.[0] ?? lines[lineIndex].length
        const length = Buffer.byteLength(lines[lineIndex].slice(segment[0], end))
        groups[group] = (groups[group] ?? 0) + length
        attribution[group] = (attribution[group] ?? 0) + length
      }
    }
    return { file, raw: bytes.length, gzip9: gzipSync(bytes, { level: 9 }).length, mappedGeneratedBytes: groups }
  })
  return {
    files, staticJsGzip9: files.reduce((sum, file) => sum + file.gzip9, 0),
    mappedGeneratedBytes: attribution,
    note: 'Source-map spans attribute generated minified bytes approximately; gzip is measured per complete resource, never per source module.',
  }
}

const results = { generated: new Date().toISOString(), variants: {} }
try {
  for (const variant of ['retained-single-client', 'split-sdk-packages']) {
    const { config } = await loadConfigFromFile({ command: 'build', mode: 'production' }, join(frontend, 'vite.config.ts'))
    const dist = join(temporary, variant)
    if (variant === 'split-sdk-packages') {
      config.build.rolldownOptions.output.codeSplitting.groups = [
        ...['auth-js', 'postgrest-js', 'realtime-js', 'storage-js', 'functions-js', 'supabase-js'].map((name) => ({
          name: `vendor-${name}`, test: new RegExp(`node_modules[\\\\/]@supabase[\\\\/]${name}[\\\\/]`),
        })),
      ]
    }
    await build({ ...config, configFile: false, root: frontend, logLevel: 'silent', build: { ...config.build, outDir: dist, manifest: true, sourcemap: 'hidden' } })
    results.variants[variant] = inspect(dist)
  }
  const output = resolve(process.argv[2] ?? join(root, 'docs/archive/audits/2026-10-14/frontend-movil/lighthouse-L1/supabase-partition.json'))
  writeFileSync(output, JSON.stringify(results, null, 2) + '\n')
  console.log(output)
  for (const [name, result] of Object.entries(results.variants)) console.log(name, result.staticJsGzip9, result.files.map((file) => file.file))
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
