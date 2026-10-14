# Mobile and tablet performance

## Presupuesto del conjunto inicial — base del 2026-10-13

Desde B6, `npm run size` muestra cinco métricas. Se comprime cada archivo de forma independiente con `node:zlib.gzipSync` (nivel predeterminado), y después se suman sus bytes comprimidos; no se comprime una concatenación artificial. Las cifras históricas obtenidas con `gzip -9` más abajo conservan su método y no se comparan como si usaran exactamente la misma compresión.

| Métrica | Qué cuenta | Base | Límite (+10 %) |
| --- | --- | ---: | ---: |
| JS de entrada (gzip) | Primer script de módulo de `dist/index.html`, comprimido individualmente. | 95.970 B | 105.567 B |
| CSS de entrada (gzip) | Primera hoja `rel="stylesheet"` de `dist/index.html`, comprimida individualmente. | 43.502 B | 47.853 B |
| Chunk JS más grande (sin comprimir) | Mayor archivo `.js` de todo `dist/`, incluidas las rutas diferidas. | 301.916 B | 332.108 B |
| **JS inicial total (gzip)** | Scripts de módulo de entrada y todos los `link rel="modulepreload"` declarados en `dist/index.html`, sin duplicar archivos. No incluye páginas que sólo se descargan mediante import dinámico. | **158.877 B** | **174.765 B** |
| **CSS inicial total (gzip)** | Todas las hojas `link rel="stylesheet"` declaradas en `dist/index.html`, sin duplicar archivos. | **43.684 B** | **48.053 B** |

Las primeras tres bases y sus límites permanecen iguales a los de `059172a`; las nuevas bases se midieron el **2026-10-13** sobre `0f503a2` (base integrada `371eec4`, con la regla B6 aplicada). `initialDate`/`initialCommit` registran esa procedencia por separado y `headroomPercent: 10` sigue siendo común a las cinco métricas. Cada límite es `ceil(base × 1,10)`.

La medición exige un `frontend/.env.local` real apuntando a Supabase local. Sin URL/clave pública válidas, `lib/supabase.ts` lanza durante la inicialización y el bundler puede eliminar código inalcanzable de Supabase: ese build no es una base representativa. No se deben usar datos ni claves de producción para medir.

B5 introdujo una combinación de imports del shell que hizo que Supabase se fusionara en el entry. B6 establece un grupo `vendor-supabase` para `@supabase/*` y sus dependencias mediante [`build.rolldownOptions.output.codeSplitting`](https://vite.dev/guide/build#chunking-strategy), con [`includeDependenciesRecursively`](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup). La API se verificó con Vite 8.2.0 y los tipos de Rolldown instalados. Así se conserva un vendor precargado sin agrupar todas las dependencias ni retirar la carga por ruta.

Comparación con la misma configuración local y `gzipSync`:

| Medición | Antes de B6 | Después de B6 | Diferencia |
| --- | ---: | ---: | ---: |
| JS de entrada | 155.892 B | 102.511 B | −53.381 B |
| Chunk JS máximo sin comprimir | 533.027 B | 325.362 B | −207.665 B |
| **JS inicial total** | **159.156 B** | **158.877 B** | **−279 B (−0,175 %)** |
| CSS inicial total | 43.684 B | 43.684 B | 0 B |

El ahorro de entry no equivale a eliminar Supabase de la primera descarga: se traslada a un vendor que se precarga. La nueva métrica evita aceptar una regresión que sólo mueve bytes del entry a un preload. Las 15 páginas de dominio siguen como entradas dinámicas; `RankingVendedores`, los formularios y sus dependencias adicionales permanecen fuera del conjunto inicial de `/login`.

Pruebas reproducibles, desde `frontend/`:

```sh
npm run build
npm run size
npx vitest run scripts/check-bundle-size.test.mjs
npx tsc -p tsconfig.app.json --showConfig
npx tsc -p tsconfig.node.json --showConfig
```

Las pruebas crean `dist` sintéticos en directorios temporales: crecimiento de preload aunque baje entry, segunda hoja CSS, archivos repetidos, recurso ausente, límite exacto y presupuesto incompleto. Además ejecutan un build mínimo con la configuración real para comprobar vendor precargado y página diferida; no dependen de un `dist/` previo. Ambos proyectos TypeScript declaran `strict: true` explícitamente.

Las mediciones históricas que siguen se conservan como evidencia fechada y no sustituyen estas cinco comprobaciones del build actual.

This page records the manual mobile/tablet measurements requested by issue [#50](https://github.com/Cristhian-S1/ondina-erp/issues/50) (Beads OND-683): first load of `/login` with Lighthouse on a throttled connection, and the extra JS/CSS that each domain downloads on its first navigation after login. CI enforces the bundle budget (see [Deployment](deployment.md#bundle-budget)); this measurement stays manual because Lighthouse numbers depend on the machine and the network emulation.

Measured on 2026-10-13 from commit `fed03ea` (branch `Cristhian-S1/test-t1-rendimiento`), built against a local Supabase stack of this repository.

Environment and exact versions:

| Tool | Version |
| --- | --- |
| Supabase CLI | 2.111.0 (project `ondina-erp`, local stack) |
| Node.js / npm | v26.3.1 / 11.16.0 (CI pins Node 22 from `frontend/.nvmrc`) |
| Google Chrome | 155.0.8059.39 |
| Lighthouse | 12.8.2 (`npx -y lighthouse@12.8.2`) |
| Build commit | `fed03ea` (branch `Cristhian-S1/test-t1-rendimiento`) |

## Method

Commands used to build and serve the production bundle against the local backend:

```sh
supabase start                                  # from the repository root
supabase status -o env                          # API_URL + ANON_KEY
# create frontend/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# (gitignored; deleted after the measurement)
cd frontend
npm ci
npm run build                                   # tsc -b && vite build
npx vite build --manifest                       # emits dist/.vite/manifest.json (no config change)
npx vite preview --port 4173 --strictPort       # background server
```

Lighthouse was run against `http://localhost:4173/login` with `--chrome-flags="--headless=new"`, three runs per profile, and the median of each metric is reported:

```sh
LH="npx -y lighthouse@12.8.2 http://localhost:4173/login --chrome-flags='--headless=new --no-sandbox' --only-categories=performance"
$LH                                                        # mobile (default preset)
$LH --screenEmulation.width=768 --screenEmulation.height=1024 \
     --screenEmulation.deviceScaleFactor=2 --screenEmulation.mobile=true --formFactor=mobile
$LH --preset=desktop
```

Notes on the numbers:

- `vite preview` compresses responses with gzip on GET (verified with `curl -D -`; the entry script body is 99,164 B on the wire), so Lighthouse transfer sizes are compressed but gzip-only. Production (Vercel) may serve brotli with slightly different byte counts.
- Gzip sizes in the chunk analysis are measured with `gzip -9`; the numbers printed by `vite build` / `npm run size` can differ by about 1% because of the gzip level used.
- `npm run size` remains the CI contract for the initial bundle; this page complements it with real-device-shaped numbers, not a replacement.

## Lighthouse results (`/login`, median of 3 runs)

| Metric | Mobile (default) | Tablet (768x1024, mobile emulation) | Desktop (`--preset=desktop`) |
| --- | --- | --- | --- |
| Performance score | 98 | 97 | 100 |
| First Contentful Paint | 1,957 ms | 1,954 ms | 443 ms |
| Largest Contentful Paint | 1,957 ms | 2,104 ms | 443 ms |
| Total Blocking Time | 13 ms | 0 ms | 0 ms |
| Cumulative Layout Shift | 0.000 | 0.000 | 0.000 |
| Total transfer | 207,129 B | 207,129 B | 207,129 B |
| JS transfer | 159,194 B | 159,194 B | 159,194 B |
| CSS transfer | 44,454 B | 44,454 B | 44,454 B |

The LCP element is the login logo, inlined as a `data:image/jpeg;base64` URI (no image request). Transfer is identical across profiles because Lighthouse simulates the slow network instead of serving different payloads; the differences are in simulated processing times.

## First navigation per domain

The extra bytes were derived from `dist/.vite/manifest.json`: for each domain entry route, the static-import closure of its lazy chunk (`file` + `css` + transitive `imports`) minus the boot set of `/login`. The boot set (first load of `/login`) is:

| Boot file | Raw | Gzip (`-9`) |
| --- | --- | --- |
| `assets/index-*.js` (entry: React, Mantine core, router, Login, Dashboard, DashboardLayout, domain index stubs) | 312,573 B | 98,982 B |
| `assets/supabase-*.js` (shared Supabase client, statically imported by the entry) | 224,500 B | 58,141 B |
| `assets/index-*.css` (all global CSS: Tailwind + Mantine base) | 290,723 B | 43,002 B |
| **Total** | **827,796 B** | **200,125 B** |

Estimated time on slow 4G assumes parallel download over a warm connection, 150 ms RTT and 400 kbps effective throughput:

```
t ≈ RTT + (bytes × 8) / bitrate = 0.15 s + gzip_bytes × 8 / (400,000 bit/s)
```

| Domain (entry route) | Extra JS gzip | Extra CSS gzip | New requests | Estimated slow-4G load |
| --- | --- | --- | --- | --- |
| dashboard (`/`) | 0 B (statically bundled) | 0 B | 0 | — (client-side navigation, no download) |
| ventas (`/ventas`) | 3,343 B | 0 B | 5 | 217 ms |
| bodega (`/despachos`) | 7,565 B | 0 B | 6 | 301 ms |
| produccion (`/produccion/registrar`) | 6,796 B | 0 B | 5 | 286 ms |
| administracion (`/reportes`) | 540 B | 0 B | 2 | 161 ms |

Notes:

- `Dashboard` is still a static import of `App.tsx`, so it ships in the entry chunk and its first navigation downloads nothing extra.
- No lazy page emits its own CSS chunk; every page reuses the global stylesheet, which is why the extra CSS column is zero.
- The heaviest routes are outside the domain landing set: `RankingVendedores` (~54.7 kB gzip extra, `@mantine/dates` month picker + `dayjs` locale) loads only on `/ranking-vendedores`; `Clientes` (~39.6 kB), `RegistrarVenta` (~39.3 kB) and `Gastos` (~36.5 kB, mostly the shared Mantine notifications chunk) load only when those pages are opened. The 09-10 datepicker concern is therefore resolved for the first screen: nothing for it is downloaded until that route is visited.

## Baseline comparison (2026-10-09 audit → now)

The 2026-10-09 integral audit recorded a single-chunk build of 911.39 kB JS (258.90 kB gzip) and 289.61 kB CSS (43.26 kB gzip) with no code splitting (finding F-04, [audit](../archive/audits/2026-10-09/auditoria-integral-2026-10-09.md)). Route-level `lazy()` loading landed on 2026-10-13 in commit `dd24057` and is contained in this branch.

| Metric (first load of `/login`) | 2026-10-09 audit | Now (`fed03ea`) | Δ |
| --- | --- | --- | --- |
| JS raw | 911,390 B | 537,073 B (entry + shared Supabase chunk) | −41.1% |
| JS gzip | 258,900 B | 157,123 B | −39.3% |
| CSS raw | 289,610 B | 290,723 B | +0.4% |
| CSS gzip | 43,260 B | 43,002 B | −0.6% |
| Total raw | 1,201,000 B | 827,796 B | −31.1% |
| Total gzip | 302,160 B | 200,125 B | −33.8% |
| Largest JS chunk raw | 911,390 B | 312,573 B | −65.7% (below Vite's 500 kB warning threshold) |

For context, `frontend/bundle-budget.json` (baseline `059172a`, 2026-10-13) records entry JS 95,970 B gzip and entry CSS 43,502 B gzip; `npm run size` on this build reports entry JS 99,164 B (+3.3%) and entry CSS 43,619 B (+0.3%), both within the +10% headroom.

## How to re-measure

1. From a worktree of the branch under test: `supabase start`; create `frontend/.env.local` from `supabase status -o env` (`API_URL`, `ANON_KEY`).
2. `cd frontend && npm ci && npm run build && npx vite build --manifest`.
3. Serve with `npx vite preview --port 4173 --strictPort` and run the three Lighthouse commands above (3 runs each; report the medians).
4. Recompute first-navigation bytes: in `dist/.vite/manifest.json`, take the lazy chunk of each domain entry route (`src/domains/<domain>/pages/<Page>.tsx`), walk `imports` recursively (plus each entry's `css`), subtract the closure of `index.html`, and measure the remaining files with `gzip -9 -c <file> | wc -c`.
5. Clean up: stop the preview, run `supabase stop --no-backup`, delete `frontend/.env.local`.

## Limitations

- Transfer sizes come from the local preview (gzip, no CDN); production bytes and timings will differ, and this page treats them as an upper bound rather than an SLA.
- Lighthouse simulated throttling (Lantern) is deterministic but not a real device; run it on a quiet machine and keep the same tool versions when comparing runs.
- First-navigation figures are static estimates from the manifest under a parallel-download model; they were not instrumented in the browser.
- Only `/login` was measured; Core Web Vitals of authenticated pages require a real session and remain out of scope of this measurement.
