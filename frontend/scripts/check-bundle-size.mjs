#!/usr/bin/env node
// Presupuesto de producción: conserva las tres métricas históricas y añade
// el conjunto inicial declarado en index.html (entrada, preloads y hojas CSS).
// Uso: npm run size (requiere npm run build).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const definitions = [
  ['entryJsGzipBytes', 'JS de entrada (gzip)'],
  ['entryCssGzipBytes', 'CSS de entrada (gzip)'],
  ['largestJsChunkRawBytes', 'Chunk JS más grande (sin comprimir)'],
  ['initialJsGzipBytes', 'JS inicial total (gzip)'],
  ['initialCssGzipBytes', 'CSS inicial total (gzip)'],
];

export function parseInitialAssets(html) {
  const scripts = [];
  const preloads = [];
  const styles = [];
  const inlineStyles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
  for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...tag[0].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
        .map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]]),
    );
    if (/^<script\b/i.test(tag[0])) {
      if (attributes.type?.toLowerCase() === 'module' && attributes.src) scripts.push(attributes.src);
    } else {
      const rel = (attributes.rel ?? '').toLowerCase().split(/\s+/);
      if (attributes.href && rel.includes('modulepreload')) preloads.push(attributes.href);
      if (attributes.href && rel.includes('stylesheet')) styles.push(attributes.href);
    }
  }
  if (!scripts.length) throw new Error('dist/index.html no declara el script de entrada.');
  if (!styles.length && !inlineStyles.length) throw new Error('dist/index.html no declara la hoja de estilos de entrada.');
  return { entryJs: scripts[0], entryCss: styles[0], initialJs: [...scripts, ...preloads], initialCss: styles,
    ...(inlineStyles.length ? { inlineStyles } : {}) };
}

function assetFile(distDir, url) {
  // Queries/hashes no cambian los bytes del archivo; deduplicamos por ruta resuelta.
  const parsed = new URL(url, 'https://bundle.local/');
  if (parsed.origin !== 'https://bundle.local') throw new Error(`No se puede medir el recurso externo: ${url}`);
  const file = resolve(distDir, decodeURIComponent(parsed.pathname).replace(/^\/+/, ''));
  const pathFromDist = relative(distDir, file);
  if (pathFromDist.startsWith('..') || isAbsolute(pathFromDist) || !existsSync(file) || !statSync(file).isFile()) {
    throw new Error(`No existe el recurso inicial del bundle: ${url}`);
  }
  return file;
}

function largestJsBytes(dir) {
  let largest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) largest = Math.max(largest, largestJsBytes(file));
    else if (entry.name.endsWith('.js')) largest = Math.max(largest, statSync(file).size);
  }
  return largest;
}

export function measureBundle(distDir) {
  const htmlPath = join(distDir, 'index.html');
  if (!existsSync(htmlPath)) throw new Error('No existe dist/index.html. Ejecuta `npm run build` antes de medir el bundle.');
  const assets = parseInitialAssets(readFileSync(htmlPath, 'utf8'));
  const gzipCache = new Map();
  const gzipBytes = (file) => {
    if (!gzipCache.has(file)) gzipCache.set(file, gzipSync(readFileSync(file)).length);
    return gzipCache.get(file);
  };
  const sumFiles = (urls) => [...new Set(urls.map((url) => assetFile(distDir, url)))].reduce((total, file) => total + gzipBytes(file), 0);
  // Count the CSS actually embedded in HTML, not the unused external copy.
  const inlineCss = (assets.inlineStyles ?? []).reduce((total, css) => total + gzipSync(css).length, 0);
  return {
    entryJsGzipBytes: gzipBytes(assetFile(distDir, assets.entryJs)),
    entryCssGzipBytes: assets.inlineStyles?.length ? gzipSync(assets.inlineStyles[0]).length : gzipBytes(assetFile(distDir, assets.entryCss)),
    largestJsChunkRawBytes: largestJsBytes(distDir),
    initialJsGzipBytes: sumFiles(assets.initialJs),
    initialCssGzipBytes: sumFiles(assets.initialCss) + inlineCss,
  };
}

export function evaluateBudget(measurements, budget) {
  const { baseline, headroomPercent } = budget;
  if (!baseline || !Number.isFinite(headroomPercent) || headroomPercent < 0) {
    throw new Error('bundle-budget.json debe declarar baseline y headroomPercent no negativo.');
  }
  return definitions.map(([key, name]) => {
    const baselineBytes = baseline[key];
    const actualBytes = measurements[key];
    if (!Number.isFinite(baselineBytes) || baselineBytes <= 0 || !Number.isFinite(actualBytes) || actualBytes < 0) {
      throw new Error(`Métrica inválida o ausente en el presupuesto: ${key}`);
    }
    const limitBytes = Math.ceil(baselineBytes * (100 + headroomPercent) / 100);
    return { key, name, baselineBytes, actualBytes, limitBytes, exceeded: actualBytes > limitBytes };
  });
}

export function runCli() {
  try {
    const budgetPath = join(rootDir, 'bundle-budget.json');
    if (!existsSync(budgetPath)) throw new Error('No existe bundle-budget.json junto al frontend.');
    const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
    const metrics = evaluateBudget(measureBundle(join(rootDir, 'dist')), budget);
    const formatBytes = (bytes) => new Intl.NumberFormat('es-CL').format(bytes);
    const formatDelta = (actual, base) => {
      const pct = (actual - base) / base * 100;
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`;
    };
    console.log(`Bundle de ${budget.baseline.date} (${budget.baseline.commit}), margen +${budget.headroomPercent}%:`);
    if (budget.baseline.initialDate) console.log(`Base del conjunto inicial: ${budget.baseline.initialDate} (${budget.baseline.initialCommit}).`);
    if (budget.baseline.cssDate) console.log(`Base del CSS: ${budget.baseline.cssDate} (${budget.baseline.cssCommit}).`);
    const header = ['Métrica'.padEnd(34), 'Base'.padStart(12), 'Presupuesto'.padStart(12), 'Actual'.padStart(12), 'Δ vs base'.padStart(10), 'Estado'].join('  ');
    console.log(header);
    console.log('-'.repeat(header.length));
    for (const metric of metrics) {
      console.log([metric.name.padEnd(34), formatBytes(metric.baselineBytes).padStart(12), formatBytes(metric.limitBytes).padStart(12), formatBytes(metric.actualBytes).padStart(12), formatDelta(metric.actualBytes, metric.baselineBytes).padStart(10), metric.exceeded ? 'SUPERA' : 'OK'].join('  '));
    }
    const failed = metrics.some((metric) => metric.exceeded);
    if (failed) console.error('\n[bundle] Regresión de presupuesto: una o más métricas superan el límite.');
    else console.log('\n[bundle] Presupuesto OK.');
    return failed ? 1 : 0;
  } catch (error) {
    console.error(`[bundle] ${error.message}`);
    return 1;
  }
}

// Importar las funciones no ejecuta el CLI ni termina el proceso de pruebas.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = runCli();
