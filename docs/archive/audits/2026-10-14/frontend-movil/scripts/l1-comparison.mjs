// Compare the complete Q1 and L1 campaigns using all three runs per cell.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const auditRoot = dirname(dirname(fileURLToPath(import.meta.url)))
let root = auditRoot
while (!existsSync(join(root, 'frontend/package.json'))) root = dirname(root)
const { measureBundle } = await import(join(root, 'frontend/scripts/check-bundle-size.mjs'))
const chunks = JSON.parse(readFileSync(join(auditRoot, 'lighthouse-L1/chunks.json')))
const html = readFileSync(join(root, 'frontend/dist/index.html'), 'utf8')
const inlineCss = [...html.matchAll(/<style data-bundle-css="([^"]+)">([\s\S]*?)<\/style>/g)]
  .map((match) => ({ archivo: match[1].replace(/^\/assets\//, ''), delivery: 'inline HTML', raw: Buffer.byteLength(match[2]), gzip: gzipSync(match[2], { level: 9 }).length }))
const files = [...chunks.bootSet.files]
for (const file of inlineCss) if (!files.some((existing) => existing.archivo === file.archivo)) files.push(file)
writeFileSync(join(auditRoot, 'lighthouse-L1/bundle-measurements.json'), JSON.stringify({
  budgetMetrics: measureBundle(join(root, 'frontend/dist')),
  bootSetIncludingInlineCss: { files, rawBytes: files.reduce((sum, file) => sum + file.raw, 0), gzipBytes: files.reduce((sum, file) => sum + file.gzip, 0) },
  note: 'The unchanged Q1 collector follows manifest imports; cssCodeSplit=false emits a separate CSS manifest entry. Count the stylesheet embedded in HTML exactly once for comparison; this is not zero-byte CSS.',
}, null, 2) + '\n')
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
function readRun(directory, device, page, run) {
  const file = join(auditRoot, directory, `${device}-${page}-run${run}.lhr.json`)
  return JSON.parse(existsSync(file) ? readFileSync(file) : gunzipSync(readFileSync(`${file}.gz`)))
}
function summarize(directory, device, page) {
  const runs = [1, 2, 3].map((run) => readRun(directory, device, page, run))
  const metrics = {}
  for (const category of ['performance', 'accessibility', 'best-practices']) {
    metrics[category] = median(runs.map((run) => Math.round(run.categories[category].score * 100)))
  }
  for (const [key, audit] of Object.entries({ lcpMs: 'largest-contentful-paint', tbtMs: 'total-blocking-time', cls: 'cumulative-layout-shift', transferBytes: 'total-byte-weight' })) {
    metrics[key] = median(runs.map((run) => run.audits[audit].numericValue))
  }
  for (const audit of ['unused-javascript', 'render-blocking-resources', 'offscreen-images']) {
    const values = runs.map((run) => run.audits[audit])
    metrics[audit] = {
      failures: values.filter((value) => value.score !== null && value.score < 1).length,
      wastedBytes: median(values.map((value) => (value.details?.items ?? []).reduce((sum, item) => sum + (item.wastedBytes ?? 0), 0))),
      wastedMs: median(values.map((value) => value.details?.overallSavingsMs ?? 0)),
    }
    if (audit === 'unused-javascript') {
      for (const asset of ['index-', 'vendor-supabase-']) {
        metrics[audit][asset] = Object.fromEntries(['totalBytes', 'wastedBytes'].map((key) => [key, median(values.map((value) => value.details.items.find((item) => item.url.split('/').at(-1).startsWith(asset))?.[key] ?? 0))]))
      }
    }
  }
  return metrics
}
const comparison = []
for (const device of ['mobile', 'movil-412x915', 'tablet-768x1024', 'tablet-1024x1366', 'desktop']) {
  for (const page of ['login', 'portada', 'administracion']) {
    comparison.push({ device, page, before: summarize('lighthouse-base', device, page), after: summarize('lighthouse-L1', device, page) })
  }
}
writeFileSync(join(auditRoot, 'lighthouse-L1/comparison.json'), JSON.stringify(comparison, null, 2) + '\n')
console.log('| Profile | Page | Perf before → after | LCP ms before → after | Transfer B before → after | Unused B before → after | Blocking runs before → after | Offscreen runs before → after |')
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |')
for (const { device, page, before: b, after: a } of comparison) {
  console.log(`| ${device} | ${page} | ${b.performance} → ${a.performance} | ${Math.round(b.lcpMs)} → ${Math.round(a.lcpMs)} | ${b.transferBytes} → ${a.transferBytes} | ${b['unused-javascript'].wastedBytes} → ${a['unused-javascript'].wastedBytes} | ${b['render-blocking-resources'].failures}/3 → ${a['render-blocking-resources'].failures}/3 | ${b['offscreen-images'].failures}/3 → ${a['offscreen-images'].failures}/3 |`)
}
