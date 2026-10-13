#!/usr/bin/env node
// Verifica el tamaño del bundle de producción contra el presupuesto aprobado
// (issue #50). Lee la entrada declarada en dist/index.html, mide con gzip el
// JS y el CSS de entrada, y el chunk JS más grande sin comprimir; compara con
// frontend/bundle-budget.json (base medida + margen) y falla con código 1 si
// algún límite se supera.
//
// Uso: npm run size   (requiere un build previo: npm run build)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(rootDir, "dist");
const budgetPath = join(rootDir, "bundle-budget.json");

function fail(message) {
  console.error(`[bundle] ${message}`);
  process.exit(1);
}

if (!existsSync(join(distDir, "index.html"))) {
  fail("No existe dist/index.html. Ejecuta `npm run build` antes de medir el bundle.");
}
if (!existsSync(budgetPath)) {
  fail("No existe bundle-budget.json junto al frontend.");
}

const budget = JSON.parse(readFileSync(budgetPath, "utf8"));
const { baseline, headroomPercent } = budget;
if (!baseline || typeof headroomPercent !== "number") {
  fail("bundle-budget.json debe declarar `baseline` y `headroomPercent`.");
}

// Entrada declarada por el build: script de módulo y hoja de estilos.
const html = readFileSync(join(distDir, "index.html"), "utf8");
const entryJsUrl = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
const entryCssUrl = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1];
if (!entryJsUrl) fail("dist/index.html no declara el script de entrada.");
if (!entryCssUrl) fail("dist/index.html no declara la hoja de estilos de entrada.");

const distFile = (urlPath) => join(distDir, urlPath.replace(/^\//, ""));
const gzipBytes = (file) => gzipSync(readFileSync(file)).length;

function findLargestJs(dir) {
  let largest = { file: null, bytes: 0 };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findLargestJs(fullPath);
      if (nested.bytes > largest.bytes) largest = nested;
    } else if (entry.name.endsWith(".js")) {
      const bytes = statSync(fullPath).size;
      if (bytes > largest.bytes) largest = { file: fullPath, bytes };
    }
  }
  return largest;
}

const largestJs = findLargestJs(distDir);
const metrics = [
  {
    name: "JS de entrada (gzip)",
    baselineBytes: baseline.entryJsGzipBytes,
    actualBytes: gzipBytes(distFile(entryJsUrl)),
  },
  {
    name: "CSS de entrada (gzip)",
    baselineBytes: baseline.entryCssGzipBytes,
    actualBytes: gzipBytes(distFile(entryCssUrl)),
  },
  {
    name: "Chunk JS más grande (sin comprimir)",
    baselineBytes: baseline.largestJsChunkRawBytes,
    actualBytes: largestJs.bytes,
  },
];

const limitFor = (baselineBytes) => Math.ceil((baselineBytes * (100 + headroomPercent)) / 100);
const esCl = new Intl.NumberFormat("es-CL");
const formatBytes = (bytes) => esCl.format(bytes);
const formatDelta = (actual, base) => {
  const pct = ((actual - base) / base) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`;
};

console.log(`Bundle de ${baseline.date} (${baseline.commit}), margen +${headroomPercent}%:`);
const header = [
  "Métrica".padEnd(34),
  "Base".padStart(12),
  "Presupuesto".padStart(12),
  "Actual".padStart(12),
  "Δ vs base".padStart(10),
  "Estado",
].join("  ");
console.log(header);
console.log("-".repeat(header.length));

let failed = false;
for (const metric of metrics) {
  const limit = limitFor(metric.baselineBytes);
  const exceeded = metric.actualBytes > limit;
  if (exceeded) failed = true;
  console.log(
    [
      metric.name.padEnd(34),
      formatBytes(metric.baselineBytes).padStart(12),
      formatBytes(limit).padStart(12),
      formatBytes(metric.actualBytes).padStart(12),
      formatDelta(metric.actualBytes, metric.baselineBytes).padStart(10),
      exceeded ? "SUPERA" : "OK",
    ].join("  "),
  );
}

if (failed) {
  console.error("");
  console.error("[bundle] Regresión de presupuesto: una o más métricas superan el límite.");
  console.error("[bundle] Si el aumento es intencional, actualiza la base en frontend/bundle-budget.json en un PR y justifícalo.");
  process.exitCode = 1;
} else {
  console.log("");
  console.log("[bundle] Presupuesto OK.");
}
