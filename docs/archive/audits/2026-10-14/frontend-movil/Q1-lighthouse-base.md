# Q1-Parte B — Línea base Lighthouse 12.8.2 con 412×915 y tablet (medición, sin correcciones)

**Tarea:** Q1_parte_B (Beads OND-c07.21, solo medir) · **Fecha:** 2026-10-14 · **Producto:** este informe + `lighthouse-base/**` + `scripts/` (cero cambios en `frontend/src`).
**Commit de código medido:** `4809b1a` (`origin/feature/frontend-ux`, branch de worktree `Cristhian-S1/q1-flaky-lighthouse`). Commits propios de esta sesión hasta la medición: `7ef4072` (pruebas) y `6622fda` (docs Parte A) — no alteran código de producto; el dist medido se reconstruyó idéntico (~hashes de assets verificados).
**Build:** `.env.local` real (`VITE_SUPABASE_URL=http://127.0.0.1:54321`; el anon key queda fuera del repo por `.gitignore`). Entry: `index-C30Qw8wo.js`; CSS global: `index-CpZ4y3Zz.css`.
**Estado por consigna:** es el insumo de medición para la FASE C de corrección (color-contrast, unused-javascript, render-blocking CSS, logo offscreen); aquí NO se corrige nada.

## Resumen ejecutivo

- **45 corridas** (5 perfiles × 3 rutas × 3), **0 fallos**, 480 s totales, todas contra el Supabase LOCAL con sesión real por el formulario de `/login` (vendedor para `/`, admin para `/administracion`; cache HTTP fría por corrida autenticada).
- **Performance móvil/tablet 97–98 y desktop 100** en las 15 combinaciones. TBT ≈ 0 ms en la mediana de las 15; CLS 0.000 en las 45 corridas. LCP mediano móvil 1.965 ms (`/login`) y 2.260–2.268 ms (rutas autenticadas); desktop 459–539 ms.
- **Best Practices 100 en las 15 combinaciones**; **accessibility 94–95** (94 en `/administracion` para mobile/412x915/768x1024, 95 en el resto) — la única auditoría con score < 1 en las 15 combinaciones es `color-contrast` (3/3 corridas en cada una).
- Los hallazgos heredados de A3/C1 siguen abiertos: `unused-javascript` (entry + `vendor-supabase`), `render-blocking-resources` (hoja global CSS, solo penaliza en emulación móvil) y `offscreen-images` (logo del drawer por debajo de 640 px).

## Método (idéntico a A3/C1, con perfiles añadidos)

- **Servidor de medición:** `scripts/servidor-local-a3.mjs --port 5183 --supabase http://127.0.0.1:54321` (copiado íntegro del método A3: static de `frontend/dist` + fallback SPA + cabeceras de `vercel.json` con UNA diferencia guardada, `connect-src` añade el Supabase LOCAL). **No se usó `vite preview` (su CSP bloquea `127.0.0.1:54321`).**
- **Lighthouse:** `npx -y lighthouse@12.8.2`, Chrome `/usr/bin/google-chrome` (headless nuevo, puerto CDP dedicado por invocación, perfil limpio), `--only-categories=performance,accessibility,best-practices`, `--max-wait-for-load=60000`, mediana de **3 corridas** por combinación.
- **Sesión autenticada (método A3):** Chrome headless persistente + CDP; pestaña de control limpia `localStorage` y ejecuta `Network.clearBrowserCache` antes de cada corrida autenticada (cache HTTP fría). Lighthouse corre con `--disable-storage-reset` en rutas autenticadas. Login real: setter nativo + eventos sobre `input[type=email]`/`input[type=password]` y click en "Ingresar"; token `sb-*-auth-token` en localStorage.
- **Perfiles (los dos nuevos de Q1 en negrita):** `mobile` (preset LH), **`movil-412x915`** (`--screenEmulation.width=412 --screenEmulation.height=915 --screenEmulation.deviceScaleFactor=2.625 --screenEmulation.mobile=true --formFactor=mobile`, Pixel 7 aprox.), `tablet-768x1024` (A3, dsf 2, formFactor mobile), **`tablet-1024x1366`** (iPad Pro retrato, dsf 2, formFactor mobile), `desktop` (`--preset=desktop`).
- **Rutas:** `login` (anónima), `portada` (`/`, vendedor), `administracion` (administrador). Cuentas sintéticas locales (contraseña `ux-local-2026`): `ux-vendedor@example.invalid`, `ux-admin@example.invalid`.
- **Scripts:** `scripts/run-q1-baseline.mjs` (adaptado de `run-a3-baseline.mjs` del 2026-10-13; añade los perfiles, extrae por corrida las auditorías con score < 1 y escribe `resumen.json` + `resultados.csv` + `chunks.json`), `scripts/servidor-local-a3.mjs` (idéntico al de A3) y `scripts/q1-capturas.mjs` (evidencia visual por viewport).
- **Carga durante la medición:** la del host (Otros workers con agentes activos; loadavg 1-min entre ~10–20 durante la campaña, era de agentes interactivos, no compilaciones sostenidas). No se usaron busy loops durante la campaña de Lighthouse (las corridas intermitentes de la Parte A terminaron antes). Igual que A3/C1, los valores dependen de la estación: comparar siempre LH 12.8.2 + Chrome 155.

## Resultados: medianas por página × perfil (3 corridas c/u)

| Perfil | Página | Performance | Accessibility | Best Practices | LCP (ms) | TBT (ms) | CLS | Transferido (B) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mobile | login | 98 | 95 | 100 | 1.965 | 0 | 0.000 | 175.450 |
| mobile | portada | 97 | 95 | 100 | 2.267 | 0 | 0.000 | 177.063 |
| mobile | administracion | 97 | 94 | 100 | 2.260 | 0 | 0.000 | 178.375 |
| movil-412x915 | login | 98 | 95 | 100 | 1.966 | 0 | 0.000 | 175.450 |
| movil-412x915 | portada | 97 | 95 | 100 | 2.266 | 0 | 0.000 | 177.063 |
| movil-412x915 | administracion | 97 | 94 | 100 | 2.260 | 0 | 0.000 | 178.375 |
| tablet-768x1024 | login | 98 | 95 | 100 | 1.965 | 0 | 0.000 | 175.450 |
| tablet-768x1024 | portada | 97 | 95 | 100 | 2.268 | 0 | 0.000 | 177.063 |
| tablet-768x1024 | administracion | 97 | 94 | 100 | 2.260 | 0 | 0.000 | 178.375 |
| tablet-1024x1366 | login | 98 | 95 | 100 | 1.966 | 0 | 0.000 | 175.450 |
| tablet-1024x1366 | portada | 97 | 95 | 100 | 2.267 | 0 | 0.000 | 177.063 |
| tablet-1024x1366 | administracion | 97 | 95 | 100 | 2.261 | 0 | 0.000 | 178.375 |
| desktop | login | 100 | 95 | 100 | 459 | 0 | 0.000 | 175.450 |
| desktop | portada | 100 | 95 | 100 | 539 | 0 | 0.000 | 177.063 |
| desktop | administracion | 100 | 95 | 100 | 532 | 0 | 0.000 | 178.375 |

Lecturas: (1) los perfiles móviles **412x915, 768x1024 y 1024x1366 se comportan igual que el preset mobile** en score y LCP/TBT (misma CPU y red simuladas; la pantalla/dsf solo cambia la composición del render). (2) En `/administracion` la mediana de a11y es 94 en mobile/412x915/768x1024 y 95 en 1024x1366/desktop — diferencia de 1 punto observada; los selectores que falla cada perfil están en la sección siguiente. (3) "Transferido" autenticado = estáticos + respuestas REST del flujo de la página (igual que A3).

## Auditorías con score < 1 por perfil (3/3 salvo indicación)

### `color-contrast` — 3/3 en las 15 combinaciones (a11y 94–95; hallazgo A3-02 heredado)

| Ruta | Selectores exactos (abreviados); patrón: `text-slate-400/500` sobre fondo claro | Corridas |
| --- | --- | --- |
| `/login` | `div#root > div.flex > form.w-full > button.inline-flex` — botón "Ingresar" (submit, texto blanco sobre `bg-brand-*`) | 3/3 en los 5 perfiles |
| `/` (portada) | `main.flex-1 > div.space-y-6 > div > p.mt-1` (`text-sm text-slate-500`); `div.rounded-2xl > dl.mt-4 > div > dt.text-xs` (×3, etiquetas `text-slate-400` del tablero); en ≥768/1024 además `aside#menu-lateral > nav.flex-1 > a.flex > span.truncate` (texto de navegación del drawer) | 3/3 en los 5 perfiles |
| `/administracion` | `div#root > div.flex > div.flex > footer.px-4` (`text-xs text-slate-500`, "Versión dev" y relaciones); en 1024x1366/desktop además `aside#menu-lateral > nav.flex-1 > a.flex > span.truncate` | 3/3 en los 5 perfiles |

Todo el patrón negativo corresponde a clases `text-slate-400`/`text-slate-500` sobre fondos claros (tablero y footer), más el botón de submit del login: coincide con A3-02 (Login/Dashboard/DashboardLayout). En `/login` no reaparecen las diferencias de auditorías ARIA registradas entre A3 y C1 (la corrida usa la misma versión de LH 12.8.2 en los 45 LHR).

### `unused-javascript` — 3/3 en las 15 (hallazgo A3-01 heredado; peso 0, informativa)

| Ruta | Descarga sin usar (bytes gzip transferidos; mediana) | Corridas |
| --- | --- | ---: |
| `/login` | `index-C30Qw8wo.js` total 103.520 B, desperdicio 57.132 B + `vendor-supabase-1yby8ldT.js` 54.629 B, desperdicio 45.627 B (~100 KiB estimado) | 3/3 |
| `/` | entry: total 103.520, desperdicio 47.265 B; `vendor-supabase`: total 54.629, desperdicio 43.728 B (~89 KiB) | 3/3 |
| `/administracion` | entry: total 103.520, desperdicio 46.233 B; `vendor-supabase`: 54.629 / desperdicio 43.728 B (~88 KiB) | 3/3 |

Igual que en A3/C1: gran parte del entry y del chunk de Supabase queda sin usar en la primera navegación; es el argumento numérico para la partición pendiente (prioridad Fase C), no bloquea la corrida.

### `render-blocking-resources` — 3/3 en emulación móvil/tablet; desktop 0–1/3 (hallazgo A3-04 heredado)

- Única hoja señalada: `index-CpZ4y3Zz.css` (37.418 B raw / 7.368 B gzip transferido), `wastedMs` simulado **304–310 ms** en mobile/412x915/768x1024/1024x1366 en las tres rutas; en desktop `sin fallo` (portada 1/3 con 95 ms). El "Est savings" total es 0 ms (el CSS ya no es tan pesado tras retirar Mantine), pero sigue siendo un recurso bloqueante en móviles emulados: queda para Fase C (CSS por módulo o inline crítico).
- Con él, siempre aparece la *insight* nueva de LH 12 `render-blocking-insight` (3/3, todas las combinaciones) y `network-dependency-tree-insight` (3/3).

### `offscreen-images` — logo del drawer fuera de pantalla (hallazgo A3-03 heredado)

| Rutas donde falla | Perfiles | Elemento |
| --- | --- | --- |
| `/` y `/administracion` | mobile, movil-412x915, tablet-768x1024 (3/3 c/u) | `img` con nodeLabel "Ondina" (logo del `aside#menu-lateral`); ~4 KiB estimado; la URL no es comparable porque es data-URI |
| `/` | tablet-1024x1366 y desktop: **sin fallo** | El menú es visible > 640 px, el logo se usa |

El patrón confirma A3-03/C1-03: el `<img>` del drawer se descarga aunque el menú está oculto < 640 px. En tablet 1024x1366 (menú visible) el auditoría ya no aparece: corregir renderizado condicional del img elimina el fallo solo en los perfiles angostos.

### Métricas ponderadas del score de performance (menores, con score < 1 en móviles)

`first-contentful-paint` (3/3), `largest-contentful-paint` (3/3), `speed-index` (2–3/3), `interactive`/`max-potential-fid` (2–3/3) — derivadas del análisis de Lantern sobre la medición local, igual que en A3 (no son regresiones del producto; los valores absolutos están en `resumen.json`).

## Inventario del build (chunks.json; gzip −9)

- **JS total 826.941 B raw / 247.720 B gzip** en 30 archivos; **CSS global 37.418 B raw / 7.368 B gzip** (32 archivos de assets en total).
- **Boot set** (cierre de imports estáticos del `index.html` según `dist/.vite/manifest.json`; hashes idénticos entre rebuilds): **589.664 B raw / 169.022 B gzip** — entry `index-C30Qw8wo.js` (328.027/103.387), CSS `index-CpZ4y3Zz.css` (37.418/7.368), `vendor-supabase-1yby8ldT.js` (214.047/54.467) + chunk `ui-*` (10.172/3.800).
- Comparación con `frontend/bundle-budget.json` (mismas semánticas que `npm run size`): JS de entrada +7,92% (límite OK), CSS de entrada −83,01%, chunk mayor +8,65% (OK) — `npm run size` verde (ver gates abajo).
- **Cost extra gzip de la primera navegación por ruta** (manifest - boot set): `/ventas/registrar` 51.657 · `/clientes` 47.922 · `/gastos` 46.194 · `/despachos` 11.742 · `/produccion` (+subrutas del mismo módulo) 10.716 · `/devoluciones` 10.638 · `/stock` 3.491 · `/ranking-vendedores` 3.452 · `/ventas` 3.329 (inventario completo con nota de dominio en `chunks.json.extrasPorRuta`).

## Gates verificados en esta misma estación

| Comando | Resultado |
| --- | --- |
| `npm run lint --prefix frontend` | 0 hallazgos |
| `npm run build --prefix frontend` | OK (dist reproducible con los mismos hashes de assets) |
| `npx vite build --manifest --prefix frontend` | OK (manifest para boot set/extras; sin cambios de config) |
| `npm run size --prefix frontend` | Presupuesto OK (JS entrada +7,9%, CSS entrada −83,0%, chunk mayor +8,6% vs base 0f503a2) |
| `npm run test --prefix frontend` | **723/723 verde** (55 archivos; corrida final de gates, sin `test:integration` — lo corre el coordinador) |

## Evidencia visual por viewport (capturas/Q1)

`scripts/q1-capturas.mjs` abre `/login` (anónima) y `/` (autenticada como vendedor, sesión real del formulario) en Chrome headless para los 5 viewports del enunciado y mide `scrollWidth <= innerWidth` + objetivos táctiles < 44 px:

- **10/10 combinaciones sin overflow horizontal y 0 objetivos táctiles < 44 px.**
- Capturas: `capturas/Q1/{login,portada}-{412x915,375x812,768x1024,1024x1366,1280x800}.png` + `verificacion-viewport.json` (sin `-antes/-despues` porque en Q1 no hubo cambio de UI: es evidencia de línea base, no comparativa).

## Limitaciones

- Medición en estación compartida: los valores dependen del ruido de la máquina (Lantern simula red/CPU sobre lo observado); comparar siempre contra la MISMA versión de LH/Chrome y condiciones semejantes. La comparabilidad con A3/C1 es direccional (mismo método y flags), no de laboratorio.
- `unused-javascript`/`render-blocking`/`offscreen-images` tienen **peso 0** en el score de LH 12.8.2 (informativas/insights): no bajan el score, pero son el insumo de Fase C.
- El directorio `lighthouse-base/` quedó en ~2,15 MB: LHR comprimidos a `.gz` (45 archivos, sin capturas embebidas y sin `i18n`/`stackPacks` del viewer — post-proceso equivalente al presupuesto del método A3, cifras íntegras), `resumen.json`, `chunks.json` y `resultados.csv` planos.
- Los perfiles 412x915 y 1024x1366 se definieron en este informe (Pixel 7 con dsf 2,625 y iPad Pro con dsf 2, ambos con `formFactor=mobile`, siguiendo el patrón tablet del A3). Nada de `vite.config.ts`/`vercel.json` fue modificado.

## Cómo repetir

```sh
# 1) Stack local corriendo + env (igual que A3):
#    frontend/.env.local con VITE_SUPABASE_URL=http://127.0.0.1:54321 y VITE_SUPABASE_ANON_KEY=<k de `supabase status -o env`>
npm run build --prefix frontend
npx vite build --manifest --prefix frontend           # manifest para boot set/extras
node docs/archive/audits/2026-10-14/frontend-movil/scripts/servidor-local-a3.mjs --port 5183 --supabase http://127.0.0.1:54321 &
node docs/archive/audits/2026-10-14/frontend-movil/scripts/run-q1-baseline.mjs \
     --base http://127.0.0.1:5183 --runs 3 \
     --out docs/archive/audits/2026-10-14/frontend-movil/lighthouse-base
# Evidencia visual por viewport:
node docs/archive/audits/2026-10-14/frontend-movil/scripts/q1-capturas.mjs --base http://127.0.0.1:5183
```
Opciones del medidor: `--devices mobile,movil-412x915,tablet-768x1024,tablet-1024x1366,desktop`, `--pages login,portada,administracion`, `--runs N`, `--skip-existing` (reanuda lo faltante), `--dry-run`, `--chrome <ruta>`.

## Insumos para la Fase C (siguiente tarea de corrección; no se corrige aquí)

```
Q1-B-01 | P2 | 15 combinaciones (3/3 c/u) | color-contrast: form > button.inline-flex (login); p.mt-1 + dt.text-xs ×3 + aside span.truncate (portada); footer.px-4 (administracion) — clases text-slate-400/500 y botón bg-brand | a11y 94–95 en móvil/tablet/desktop 95 | centralizar contraste en src/lib/ui.ts + revisar par bg-brand/text-white del botón | S
Q1-B-02 | P2 | 15 combinaciones (3/3 c/u) | unused-javascript: entry 46–57 kB gzip sin usar + vendor-supabase 43–45 kB gzip sin usar (~88–100 KiB) | primera navegación | continuar la partición del boot set (lazy de auth-helpers o vendor bajo demanda) | M
Q1-B-03 | P3 | móviles/tablets 3/3; desktop 0–1/3 | render-blocking-resources: index-CpZ4y3Zz.css (7,4 kB gzip) wastedMs 304–310 en móviles | primer pintado | CSS por módulo o inline crítico | S–M
Q1-B-04 | P3 | mobile/412x915/768x1024 en / y /administracion | offscreen-images: logo "Ondina" del drawer (~4 KiB) con menú oculto < 640 px | descarga desperdiciada | renderizar img solo con menú visible (sigue abierto desde A3-03/C1-03) | S
```
