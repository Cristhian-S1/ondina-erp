# Q1-entrega — Prueba intermitente bajo carga (A) + línea base Lighthouse 412×915/tablet (B)

**Producto de la tarea Q1 (Beads OND-c07.19 y OND-c07.21 parte 1) en el worktree `Cristhian-S1/q1-flaky-lighthouse`.** Informes completos con la evidencia cruda: `Q1-flaky.md` (Parte A) y `Q1-lighthouse-base.md` (Parte B).

## Qué cambió

| Parte | Cambio | Archivos |
| --- | --- | --- |
| A | Presupuestos de tiempo calibrados con medición: `testTimeout: 15000` (era 5 s) y `asyncUtilTimeout: 3000` de Testing Library (era 1 s) — la corrida bajo carga demostró que ambos muros fallaron 6 pruebas en 1/15 corridas sin errores de lógica | `frontend/vitest.config.ts` · `frontend/src/test/setup.ts` |
| A | Prueba sensible al debounce (250 ms) de `PersistenciaBorradorVenta` determinista con relojes falsos (`vi.useFakeTimers` + `advanceTimersByTime(300)`) | `frontend/src/domains/ventas/pages/RegistrarVenta.draft.test.tsx` |
| A | Timeout explícito (30 s) para el test que compila un build de Vite real en subproceso | `frontend/scripts/check-bundle-size.test.mjs` |
| A | Ningún código de producción cambió (condición de ownership); verificación final 15/15 verde bajo la misma carga | sólo los 4 archivos de arriba |
| B | Medición (sin corrección): Lighthouse 12.8.2 MÉTODO A3/C1 con los perfiles nuevos 412×915 y 1024×1366 — 45 corridas, 0 fallos; hallazgos = A3-01/02/03/04 abiertos (insumo Fase C) | `scripts/run-q1-baseline.mjs` · `scripts/servidor-local-a3.mjs` · `scripts/q1-capturas.mjs` · `scripts/q1-bucle-carga.sh` |

## Pruebas y gates (todas en verde)

- `npm run lint` — 0 hallazgos · `npm run build` — OK (assets reproducibles) · `npm run size` — presupuesto OK · `npm run test` — **723/723** (55 archivos).
- Bucle de carga (`scripts/q1-bucle-carga.sh`, 15 corridas con 8 cores saturados + carga ambiental): **antes** de los arreglos 14/15 verdes con 1 corrida con 6 pruebas rotas (log: `evidencia/bucle-carga-run13-fallos.log`); **después** 15/15 verdes con la misma generación de carga.
- `npm run test:integration` NO se corrió (por consigna, lo hace el coordinador).

## Línea base Lighthouse (medición)

Fila completa de datos en `Q1-lighthouse-base.md` y JSON crudos (`resumen.json`, `chunks.json`, `resultados.csv`, 45 `*.lhr.json.gz` en `lighthouse-base/`, total ~2,15 MB):

- Performance móvil/tablet (mobile, 412×915, 768×1024, 1024×1366) **97–98** · desktop **100** · a11y **94–95** · best-practices **100**; TBT 0, CLS 0.000; LCP móvil 1.965 ms (login) / 2.260–2.268 ms (autenticadas), desktop 459–539 ms.
- **color-contrast 3/3 en las 15 combinaciones**: pares `text-slate-400/500` (tablero de portada, footer "Versión dev", texto del drawer) y el botón submit del login (`bg-brand` + text-white).
- **unused-javascript 3/3**: entry 46–57 kB gzip sin usar + `vendor-supabase` 43–45 kB gzip sin usar (~88–100 KiB por ruta).
- **render-blocking-resources** (solo móviles/tablets): hoja global `index-CpZ4y3Zz.css`, 304–310 ms wastedMs simulado.
- **offscreen-images**: logo "Ondina" del drawer se descarga con menú oculto < 640 px en mobile/412×915/768×1024 (portada y administración); no falla en 1024×1366.
- Boot set del build medido: 589.664 B raw / 169.022 B gzip; extras por ruta: `/ventas/registrar` 51.657 · `/clientes` 47.922 · `/gastos` 46.194 · resto ≤ 11,7 kB gzip.

## Evidencia por viewport (capturas/Q1)

`scripts/q1-capturas.mjs` (Chrome headless, sesión real por el formulario de login) capturó `login` y `portada` en los 5 viewports del enunciado: `login-{...}.png` y `portada-{...}.png` con `verificacion-viewport.json`:

- **10/10 sin scroll horizontal** (`scrollWidth == innerWidth`) y **0 objetivos táctiles < 44 px**.
- Nombres **sin sufijo `-antes/-despues`** (convención del enunciado se usa cuando hay cambio de UI): en Q1 no se cambió UI, son capturas de línea base.

## Commits de este worktree (NO se hace push ni merge; el coordinador integra con cherry-pick)

| Commit | Contenido |
| --- | --- |
| `7ef4072` | fix(test): presupuestos de tiempo y debounce determinista |
| `6622fda` | docs(audits): Q1 parte A diagnóstico de la prueba intermitente |
| _(este commit)_ | docs(audits): Q1 parte B línea base Lighthouse + delivery (capturas y datos) |

## Límites

- El 412×915 y 1024×1366 son perfiles definidos por esta tarea (Pixel 7 dsf 2,625 / iPad Pro dsf 2 + `formFactor=mobile`); los valores dependen de la estación (comparar siempre LH 12.8.2 + Chrome 155).
- La carga simulada de la Parte A (8 busy loops + agentes reales en el host) es una aproximación del incidente original (3 workers compilando); el test exacto del incidente no está identificado (no sobrevivió registro) — cubierto por clase con los arreglos + 15/15.
- La Parte B no corrige nada: color-contrast/unused-javascript/render-blocking/offscreen quedan como hallazgos para la siguiente tarea (Fase C) descritos en `Q1-lighthouse-base.md` (Q1-B-01..04).
