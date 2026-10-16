# C4 — Re-medición final de Lighthouse sobre feature/frontend-ux

**Tarea:** TAREA C4 (re-medición final de feature/frontend-ux tras las correcciones de color y vista móvil; OpenCode/Orca). **Fecha:** 2026-10-15 (America/Santiago). **Producto:** solo este informe + `lighthouse/**` (cero cambios en `frontend/src`, `vite.config.ts`, `vercel.json` ni en presupuestos).
**Código medido:** `dad7779` == `origin/feature/frontend-ux` (versión final; worktree `Cristhian-S1/c4-lighthouse`). Único commit propio: el de esta evidencia, añadido **después** de la medición.
**Build:** `.env.local` real copiada de `/home/cristhian/Documents/ondina-frontend-ux/frontend/.env.local` (`VITE_SUPABASE_URL=http://127.0.0.1:54321`; anon key fuera del repo por `.gitignore`). Entry: `index-DVyTHtIs.js` (294.375 B raw / 91.243 B gzip −9); CSS global único inline en el HTML (44.451 B raw / 8.377 B gzip −9); logo `logo-WtfTBHUb.jpg` externo.
**Medición:** 45 corridas (5 perfiles × 3 rutas × 3), **0 fallos**, 477 s, Lighthouse **12.8.2**, Chrome **155.0.8059.39** (`/usr/bin/google-chrome`), Supabase **LOCAL** ya en ejecución (no se reinició la BD ni se escribieron datos).

## Resumen ejecutivo

- **Accessibility = 100 en las 15 combinaciones.** `color-contrast` —el único fallo de producto que arrastraba A3 (a11y 92–95) y Q1 (94–95) y que seguía abierto en L1 (94–95)— no aparece en una sola corrida de C4: lo cerró el worker de color (`fa579c4` "aplicar color aprobado D1", verificado por D2 con 0 fallos).
- **Performance móvil/tablet 97–98 y desktop 100.** La partición de L1 se conserva: `render-blocking-resources` y `offscreen-images` permanecen **sin fallo en las 45 corridas**. `unused-javascript` sigue **3/3 en las 15 combinaciones** (informativa, peso 0) con la misma firma de L1 ± 4 B: entry 48.727 B sin usar en `/login` (53 %) + `vendor-supabase` 45.627 B (84 %).
- TBT mediano 0 ms y CLS mediano 0.000 en las 15 celdas; Best Practices 100 en las 15. Boot set JS+CSS: **149.038 B JS + 8.377 B CSS gzip** (JS −2 B vs L1; solo cambió el hash del entry, +21 B raw de constantes).
- Transferencia total: `/login` **166.798 → 167.539 B** (+741, +0,44 %) y autenticadas frías **+~890 B** (portada 178.069 → 178.959; administracion 179.399 → 180.291): el HTML inline creció de 8.710 a 9.453 B transferidos (+743) por el CSS de los arreglos de contraste y de estilos móviles posteriores a L1 (M2/C3/R5/R6/FX); el resto (≤ 150 B) son respuestas REST de cada flujo. Las primeras navegaciones no descargan código de producto nuevo.
- Gates verdes: `npm run size` **5/5 métricas OK** (el CSS de entrada queda a 17 B del límite: 8.405/8.422), `lint` 0 hallazgos, `build` OK con manifest, `test` **799/799 en 69 archivos**. Sin `test:integration` (excluido por el enunciado; lo corre el coordinador).
- Comparación con A3 (2026-10-13; perfiles y rutas comunes): transferencia **−12 % a −19 %**, LCP autenticado **−128 a −147 ms en móvil/tablet y −13 a −47 ms en desktop**, a11y +5/+8 puntos.

## Método (idéntico a Q1/L1, reutilizado sin modificar)

- **Servidor de medición:** `docs/archive/audits/2026-10-14/frontend-movil/scripts/servidor-local-a3.mjs --port 5184 --supabase http://127.0.0.1:54321` (static de `frontend/dist` + fallback SPA + cabeceras de `vercel.json` con UNA diferencia guardada: `connect-src` añade el Supabase LOCAL, y `Cache-Control` immutable para `/assets/*` como el CDN de Vercel; no se usa `vite preview`).
- **Lighthouse:** `npx -y lighthouse@12.8.2`, `--chrome-path=/usr/bin/google-chrome --chrome-flags="--headless=new"`, `--only-categories=performance,accessibility,best-practices`, `--max-wait-for-load=60000`, puerto CDP dedicado por invocación; `--disable-storage-reset` en rutas autenticadas y `Network.clearBrowserCache` en pestaña de control antes de **cada** corrida (cache HTTP fría). Mediana de 3 corridas por celda.
- **Sesión real por el formulario de `/login`** (setter nativo + eventos, click en "Ingresar"): `ux-vendedor@example.invalid` para `/` y `ux-admin@example.invalid` para `/administracion`; contraseña `ux-local-2026`; cuentas del seed local ya presentes (no se crearon cuentas ni se tocaron datos de negocio).
- **Perfiles:** `mobile` (preset LH), `movil-412x915` (Pixel 7 aprox., dsf 2,625), `tablet-768x1024` (dsf 2), `tablet-1024x1366` (iPad Pro retrato, dsf 2, ambos `formFactor=mobile`), `desktop` (`--preset=desktop`). Rutas: `login` (anónima), `portada` (`/`), `administracion`.
- **Medidor:** `docs/archive/audits/2026-10-14/frontend-movil/scripts/run-q1-baseline.mjs` intacto: escribe los LHR, `resumen.json` (medianas, corridas, fallos), `resultados.csv` (45 filas) y `chunks.json` (inventario gzip −9 desde `dist/.vite/manifest.json`), y comprime los LHR con su propio techo interno (7.826.520 B crudo → 1.914.635 B final, 1,83 MB).
- **Carga del host durante la campaña:** terminal dedicada de la tarea, sin builds ni tests simultáneos; los gates se corrieron al terminar la medición.

## Resultados: medianas Q1 → L1 → C4 por perfil × ruta (3 corridas c/u)

Formato `Q1·L1·C4`. Q1 = `4809b1a` (línea base pre-corrección, `lighthouse-base/`), L1 = `d99c7c7` (partición/CSS/logo, `lighthouse-L1/`), C4 = `dad7779` (esta campaña, `docs/archive/audits/2026-10-15/frontend-movil/lighthouse/`).

| Perfil | Página | Performance | Accessibility | Best Practices | LCP (ms) | TBT (ms) | CLS | Transferido (B) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mobile | login | 98·98·98 | 95·95·100 | 100·100·100 | 1.965·1.961·1.964 | 0·0·0 | 0.000·0.000·0.000 | 175.450·166.798·167.539 |
| mobile | portada | 97·98·97 | 95·95·100 | 100·100·100 | 2.267·2.127·2.271 | 0·0·0 | 0.000·0.000·0.000 | 177.063·178.069·178.959 |
| mobile | administracion | 97·98·97 | 94·94·100 | 100·100·100 | 2.260·2.125·2.275 | 0·0·0 | 0.000·0.000·0.000 | 178.375·179.399·180.291 |
| movil-412x915 | login | 98·98·98 | 95·95·100 | 100·100·100 | 1.966·1.963·1.964 | 0·0·0 | 0.000·0.000·0.000 | 175.450·166.798·167.539 |
| movil-412x915 | portada | 97·97·97 | 95·95·100 | 100·100·100 | 2.266·2.269·2.268 | 0·0·0 | 0.000·0.000·0.000 | 177.063·178.069·178.959 |
| movil-412x915 | administracion | 97·98·97 | 94·94·100 | 100·100·100 | 2.260·2.125·2.275 | 0·0·0 | 0.000·0.000·0.000 | 178.375·179.399·180.291 |
| tablet-768x1024 | login | 98·98·98 | 95·95·100 | 100·100·100 | 1.965·1.963·1.967 | 0·0·0 | 0.000·0.000·0.000 | 175.450·166.798·167.539 |
| tablet-768x1024 | portada | 97·98·97 | 95·95·100 | 100·100·100 | 2.268·2.160·2.272 | 0·0·0 | 0.000·0.000·0.000 | 177.063·178.069·178.959 |
| tablet-768x1024 | administracion | 97·98·97 | 94·94·100 | 100·100·100 | 2.260·2.122·2.275 | 0·0·0 | 0.000·0.000·0.000 | 178.375·179.399·180.291 |
| tablet-1024x1366 | login | 98·98·98 | 95·95·100 | 100·100·100 | 1.966·1.961·1.964 | 0·0·0 | 0.000·0.000·0.000 | 175.450·166.798·167.539 |
| tablet-1024x1366 | portada | 97·97·97 | 95·95·100 | 100·100·100 | 2.267·2.344·2.345 | 0·0·0 | 0.000·0.000·0.000 | 177.063·182.486·183.376 |
| tablet-1024x1366 | administracion | 97·98·97 | 95·95·100 | 100·100·100 | 2.261·2.202·2.356 | 0·0·0 | 0.000·0.000·0.000 | 178.375·183.816·184.708 |
| desktop | login | 100·100·100 | 95·95·100 | 100·100·100 | 459·452·454 | 0·0·0 | 0.000·0.000·0.000 | 175.450·166.798·167.539 |
| desktop | portada | 100·100·100 | 95·95·100 | 100·100·100 | 539·487·489 | 0·0·0 | 0.000·0.000·0.000 | 177.063·182.486·183.376 |
| desktop | administracion | 100·100·100 | 95·95·100 | 100·100·100 | 532·509·510 | 0·0·0 | 0.000·0.000·0.000 | 178.375·183.816·184.708 |

Lecturas: (1) el delta Q1→L1 está documentado por L1 (login −8.652 B; autenticadas +1.024 B <1024 px y +5.423/+5.441 B con menú visible por el logo externo). El delta L1→C4 es uniforme (+741 login, +890/+892 autenticadas) y se explica casi por completo por el **documento HTML** (8.710 → 9.453 B transferidos; el CSS inline creció +734 B gzip −9 con la paleta aprobada D1 y las clases móviles M2/C3/R5/R6). (2) El caso `portada·1024×1366` mantiene su LCP alto característico (2.344 en L1 → 2.345 en C4, performance 97): es la pantalla con menú visible y logo JPEG extra (4.417 B) sobre la red simulada de 1,6 Mbps; el `administracion` de ese perfil sube 2.202→2.356 manteniendo 97, coherente con el rango propio de esa celda en las tres campañas (2.261 → 2.202 → 2.356). (3) Los perfiles 412×915, 768×1024 y 1024×1366 se comportan como el preset mobile (misma CPU/red simulada; la pantalla solo cambia composición), igual que en Q1.

## Auditorías con score < 1 (45 corridas)

| Auditoría / insight | Q1 | L1 | **C4** | Causa y estado |
| --- | --- | --- | --- | --- |
| `color-contrast` | 15/15 celdas (3/3), a11y 94–95 | 15/15 (3/3), a11y 94–95 | **0/45** | **Cerrada** en `fa579c4` (paleta aprobada D1: brand, nav N1, `text-slate-600`, `red-700`, `btnDangerOutline`); D2 la verificó con 0 fallos |
| `render-blocking-resources` | 37/45 corridas (12 celdas 3/3; desktop 0–1/3) | 0/45 | **0/45** | Cerrada por L1: hoja global única inline (`cssCodeSplit: false`) |
| `offscreen-images` | 18/45 corridas (portada y administracion < 1024 px) | 0/45 | **0/45** | Cerrada por L1: `src` del logo solo con drawer visible (breakpoint real 1024 px) |
| `unused-javascript` | 15/15 (90.993–102.759 B) | 15/15 (82.672–94.359 B) | **15/15 (82.668–94.354 B)** | Abierta (informativa, peso 0); firma de L1 intacta ± 4 B (detalle abajo) |
| `network-dependency-tree-insight` | 15/15 (3/3) | 15/15 (45/45) | **15/15 (3/3)** | Informativa de LH 12.8; gráfico del árbol de dependencias; sin acción |
| `lcp-discovery-insight` + `prioritize-lcp-image` | ausentes (logo data-URI) | login 3/3 en 5 perfiles | **login 3/3 en 5 perfiles** | Sugiere `fetchpriority=high` en el logo del login (ahorro mediano 5,4 ms); informativa |
| `first-contentful-paint`, `largest-contentful-paint`, `interactive` | 3/3 en móviles/tablets | 3/3 | **3/3 en móviles/tablets; desktop íntegro** | Peso de métricas simuladas de Lantern (1,6 Mbps / CPU 4×); no son regresiones |
| `speed-index` | 34/45 corridas (móviles) | 1/3 (tablet-1024x1366 portada) | **2/45 corridas (tablet-1024x1366 portada r2 y administracion r1)** | Ruido de simulación; ausente en las medianas |

Salvo `unused-javascript` (peso 0) y el descuento insalvable de métricas simuladas en móviles, **ninguna auditoría de producto queda a menos de 100 en C4**: a11y y Best Practices son 100 completas.

### `unused-javascript` (mediana por combinación)

| Ruta | Ancho | Q1 | L1 → C4 | Contenido |
| --- | --- | ---: | ---: | --- |
| `/login` | todos | 102.759 B | 94.359 → **94.354 B** | entry 48.727 B (53 %) + `vendor-supabase` 45.627 B (84 %) |
| `/` | < 1024 px | 90.993 B | 84.832 → **84.829 B** | entry 41.101 B (45 %) + supabase 43.728 B (80 %) |
| `/` | ≥ 1024 px | 90.993 B | 82.672 → **82.668 B** | entry 38.940 B (43 %) + supabase 43.728 B (80 %) |
| `/administracion` | < 1024 px | 89.961 B | 87.514 → **87.510 B** | entry 43.782 B (48 %) + supabase 43.728 B (80 %) |
| `/administracion` | ≥ 1024 px | 89.961 B | 85.354 → **85.350 B** | entry 41.622 B (46 %) + supabase 43.728 B (80 %) |

Causa declarada por L1 (no cambia en C4): React vendor + markup del shell (206.875 B generados), router (~38.191) y Query core (26.137) en el cierre inicial; y el cliente único de Supabase (`vendor-supabase-1yby8ldT.js`), cuya partición se ensayó y **empeoraba** (8 recursos, +2.302 B gzip) — se conserva el único cliente de `lib/supabase.ts`. Simula ~300–600 ms de LCP en móviles (Lantern).

## Comparación con A3 (2026-10-13) en perfiles y rutas comunes

A3 midió `40c152b` (base `develop`, pre-partición: Mantine en boot, CSS externo de 290,7 kB, entry monolítico). Perfiles comunes: `mobile`, `tablet-768x1024` y `desktop`; las tres rutas son las mismas.

| Perfil | Página | Perf A3→C4 | A11y A3→C4 | BP A3→C4 | LCP ms A3→C4 | Transferido B A3→C4 (Δ) |
| --- | --- | --- | --- | --- | --- | --- |
| mobile | login | 97→98 | 92→100 | 100→100 | 2.171→1.964 (−207) | 206.407→167.539 (−18,8 %) |
| mobile | portada | 96→97 | 95→100 | 100→100 | 2.416→2.271 (−145) | 208.027→178.959 (−14,0 %) |
| mobile | administracion | 96→97 | 94→100 | 100→100 | 2.403→2.275 (−128) | 209.235→180.291 (−13,8 %) |
| tablet-768x1024 | login | 97→98 | 92→100 | 100→100 | 2.156→1.967 (−189) | 206.407→167.539 (−18,8 %) |
| tablet-768x1024 | portada | 96→97 | 95→100 | 100→100 | 2.419→2.272 (−147) | 208.027→178.959 (−14,0 %) |
| tablet-768x1024 | administracion | 96→97 | 94→100 | 100→100 | 2.403→2.275 (−128) | 209.235→180.291 (−13,8 %) |
| desktop | login | 100→100 | 92→100 | 100→100 | 469→454 (−15) | 206.407→167.539 (−18,8 %) |
| desktop | portada | 100→100 | 95→100 | 100→100 | 536→489 (−47) | 208.027→183.376 (−11,8 %) |
| desktop | administracion | 100→100 | 95→100 | 100→100 | 523→510 (−13) | 209.235→184.708 (−11,7 %) |

Causas acumuladas A3→C4: CSS 290.723 → 44.451 B raw (−84,7 %, hoy inline), boot set 827.796 → 561.647 B raw (−32,2 %) al retrasar el shell autenticado y externalizar Mantine, partición L1 (−12.339 B gzip), logo externo con `src` condicional y contraste corregido (`fa579c4` → D2). La comparación es de metodología idéntica sobre estación semejante, no de laboratorio.

## `npm run size` (5 métricas) e inventario

```
Bundle de 2026-10-14 (c2bcd87), margen +10%:
Métrica                                     Base   Presupuesto        Actual   Δ vs base  Estado
------------------------------------------------------------------------------------------------
JS de entrada (gzip)                      91.391       100.531        91.389       -0,0%  OK
CSS de entrada (gzip)                      7.656         8.422         8.405       +9,8%  OK
Chunk JS más grande (sin comprimir)       294.354       323.790       294.375       +0,0%  OK
JS inicial total (gzip)                  149.349       164.284       149.347       -0,0%  OK
CSS inicial total (gzip)                   7.656         8.422         8.405       +9,8%  OK
[bundle] Presupuesto OK.
```

- CSS de entrada queda a **17 B del límite**: el crecimiento posterior a L1 ( colores D1 + clases móviles M2/C3/R5/R6) consumió casi todo el margen. Añadir más clases de UI obligará a re-basar el presupuesto o revertir clases superfluas.
- Boot set comparable Q1→L1→C4: **589.664 → 557.025 → 561.647 B raw** y **169.022 → 156.683 → 157.415 B gzip** (JS+CSS; en C4 el CSS va inline: 149.038 JS + 8.377 CSS).
- Totales del dist: JS **844.955 B raw / 253.121 B gzip** (L1: 830.765/247.922; +14.190 raw/+5.199 gzip por las correcciones de Producción/Bodega/Ventas y la paginación P2, todas fuera del arranque) ; CSS **44.451 / 8.377** (única hoja, inline).
- Extras gzip por primera navegación (fuera del boot set, los primeros): `/ventas/registrar` 59.294 · `/clientes` 55.926 · `/gastos` 54.653 · `/despachos` 20.940 · `/produccion` (+ subrutas del módulo) 20.587; listado completo con nota de dominio en `lighthouse/chunks.json.extrasPorRuta`.

## Gates verificados en esta misma estación

| Comando | Resultado |
| --- | --- |
| `npm run build --prefix frontend -- --manifest` | OK, 186 ms (`tsc -b` + `vite build`); entry `index-DVyTHtIs.js`, CSS inline, `dist/.vite/manifest.json` para el inventario. |
| `npm run size --prefix frontend` | **5/5 métricas OK** (tabla arriba), 135 ms. |
| `npm run lint --prefix frontend` | 0 hallazgos, 4,0 s. |
| `npm run test --prefix frontend` | **799/799 verde, 69 archivos** (jsdom, 10,3 s). Sin `test:integration` (excluido por el enunciado). |

## Interpretación de la variabilidad

- **Intra-celda (3 corridas):** LCP de login 1.961–1.970 ms (≤ 9 ms), `administracion` en móviles y tablet 768 entre 2.270–2.283 ms (≤ 13 ms), desktop login 413–455 ms (±42 ms). Corridas atípicas: `portada` en mobile/412x915 r1 y tablet-768x1024 r3 arrojaron 2.117/2.123 ms (la mediana se mantiene ~2.270, en línea con Q1/L1), y tablet-1024x1366 autenticadas cerró estrecho (2.344–2.364). El rango > 100 ms solo aparece en la primera corrida de `portada` móvil, igual que en campañas anteriores (arranque frío del tablero autenticado).
- **Inter-campañas:** los cambios reales y reproducibles —portada desktop 539→487→489 ms, login 166.798→167.539 B— van en la dirección de la partición L1; el LCP alto de `portada·1024×1366` ya se registró en L1 (+77 ms vs Q1) y persiste (+78 ms), coherente con el coste del logo visible sobre la red simulada.
- Los scores de performance 96–99 derivan del peso de métricas simuladas (FCP/SI/TTI de Lantern): ninguna corrida se apartó del patrón Q1/L1. Para comparar entre campañas fijar LH 12.8.2 + Chrome 155 + servidor con cabeceras de `vercel.json` + Supabase local, y juzgar rangos y medianas, no corridas individuales.

## Reproducción

```sh
# 0) Stack local activo (no se reinició) + env real fuera del repo
cp /home/cristhian/Documents/ondina-frontend-ux/frontend/.env.local frontend/.env.local
#    VITE_SUPABASE_URL=http://127.0.0.1:54321 y VITE_SUPABASE_ANON_KEY=<ANON_KEY de `supabase status -o env`>

npm run build --prefix frontend -- --manifest
node docs/archive/audits/2026-10-14/frontend-movil/scripts/servidor-local-a3.mjs --port 5184 --supabase http://127.0.0.1:54321 &

node docs/archive/audits/2026-10-14/frontend-movil/scripts/run-q1-baseline.mjs \
     --base http://127.0.0.1:5184 --runs 3 \
     --out docs/archive/audits/2026-10-15/frontend-movil/lighthouse
```

Opciones del medidor: `--devices mobile,movil-412x915,tablet-768x1024,tablet-1024x1366,desktop`, `--pages login,portada,administracion`, `--runs N`, `--skip-existing` (reanuda lo faltante), `--dry-run`. Salida: 45 `*.lhr.json.gz` (LHR íntegros, sin capturas embebidas; el medidor los comprime al pasar su techo de ~1,9 MB), `resumen.json`, `resultados.csv`, `chunks.json`, `ejecucion.log`; directorio final **1,83 MB** (< 2 MB).

## Limitaciones

- Medición local con CPU/red simuladas (Lantern) y host compartido; compara campañas entre sí bajo el mismo método, no garantiza producción.
- El "Transferido autenticado" incluye las respuestas REST del flujo de cada página, igual que en A3/Q1/L1.
- `unused-javascript` es informativa (peso 0); el argumento para partición del SDK sigue atado a la decisión de L1 y queda abierta para el núcleo React/router/Query.
- El CSS inline fue decisión acotada de L1 (hoja única): la navegación de documento repite el CSS (~9,5 kB) y el presupuesto lo vigila (17 B de margen).
- Perfiles móviles no reales: emulación del preset LH y flags de pantalla del enunciado; sin Firefox/Safari.
- No se ejecutó `test:integration`, no se modificó `.opencode/`, `supabase/` ni SQL, y no se almacenaron contraseñas ni claves en el repo.
