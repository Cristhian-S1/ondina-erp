# C1 — Medición final de rendimiento frontend-ux

**Tarea:** TAREA C1 (Fase C, OpenCode) · **Fecha:** 2026-10-14 · **Producto:** solo este informe y `lighthouse/final/**` (regla del enunciado: sin cambios de código de la app; los scripts de medición se usaron sin edición).
**Commit medido:** `10edcd2318356ee0d7ff7274a591fd85c8406936` (`10edcd2`, branch de worktree `Cristhian-S1/fux-c1-medicion`, igual a `origin/feature/frontend-ux` — versión final de la ronda). Entry del build: `frontend/dist/assets/index-B6DZrmIA.js`.
Compare contra la línea base A3 (`40c152b`): `docs/archive/audits/2026-10-13/frontend-ux/A3-linea-base.md` y `lighthouse/baseline/**` (método, scripts y servidor idénticos, sin ediciones).

## Resumen ejecutivo

- Método A3 reproducido con **0 fallos en 27 corridas** (3 dispositivos × 3 páginas × 3 corridas, mediana) en 285 s: mismas páginas (`/login`, `/` portada vendedor, `/administracion`), mismos flags por dispositivo, Lighthouse 12.8.2 y Chrome 155.0.8059.39 (`/usr/bin/google-chrome`), servidor local `servidor-local-a3.mjs` en `:5183` con cabeceras de `vercel.json` + las dos excepciones locales documentadas en A3 §3.
- **Gates verdes:** `lint` 3,75 s · `build` 3,08 s (tsc −b + vite) · `size` 5/5 métricas OK · `test` **691/691 en 52 archivos** (5,24 s). No se ejecutó `npm run test:integration` (excluido por enunciado).
- **Boot set −20,8% gzip** (200.136 → 158.450 B gzip −9): la hoja global CSS cayó de 290.723 B a 36.730 B sin comprimir (83% ↓) por la retirada de Mantine (`0b77e62`), y el cliente Supabase quedó separado del entry (`vendor-supabase-*.js`, `8088820`) 17 kB más pequeño por tree-shaking + TypeScript estricto. Los chunks cargados de Mantine en A3 colapsan en el inventario (`RankingVendedores` 53,5 kB gzip → 1,5 kB; `toast-utils` 32,7 kB → 0,7 kB).
- **Transferido −20% en las 9 combinaciones** (p. ej. `/login` móvil 206.407 → 164.861 B, −41,5 kB). La mediana de LCP móvil en `/login` mejoró 2.171 → 1.965 ms (−9%); portada y administración móvil/tablet pasan de 96 → 97/98 puntos de performance.
- **Pendiente de A3 que sigue:** `unused-javascript` (waste casi idéntico: 96,5 → 93,6 kB en `/login`) y `color-contrast` (raíz: textos < 4,5:1; el score a11y subió 92 → 95 en login por el efecto del denominador de auditorías aplicables, no por un par arreglado) + `offscreen-images` y `render-blocking-resources` en móvil/tablet (A3-01/02/03/04 siguen abiertos).

## Entorno y versiones

| Herramienta | Versión |
| --- | --- |
| Supabase CLI (stack local `ondina-erp`) | 2.111.0 |
| Node.js / npm | v26.3.1 / 11.16.0 |
| Google Chrome | 155.0.8059.39 (`/usr/bin/google-chrome`) |
| Lighthouse | 12.8.2 (`npx -y lighthouse@12.8.2`) |
| Build medido | `10edcd2`, `.env.local` con `VITE_SUPABASE_URL=http://127.0.0.1:54321` |

Cuentas sintéticas locales (contraseña `ux-local-2026`), mismas que en A3: `ux-vendedor@example.invalid` (vendedor sucursal A, en la portada autenticada) y `ux-admin@example.invalid` (administrador sucursal A, en `/administracion`), ya presentes en la BD local. Servidor de medición (cabeceras y diferencias): idéntico a A3 §3; verificado con `curl -D -` antes de medir.

## 1) Gates: lint, build, size, test

Corrida final sobre el build medido (idempotente: reconstrucción posterior reprodujo los mismos hashes, y los URLs de los LHR los confirman):

| Comando | RC | Tiempo | Resultado |
| --- | --- | ---: | --- |
| `npm run lint --prefix frontend` | 0 | 3,75 s | sin hallazgos |
| `npm run build --prefix frontend` | 0 | 3,08 s | `tsc -b && vite build`; aviso no bloqueante `[INEFFECTIVE_DYNAMIC_IMPORT]` en `src/lib/dashboard.ts` (import estático + dinámico, preexistente) |
| `npx vite build --manifest` (regenera `dist/.vite/manifest.json`) | 0 | 173 ms | sin cambios de config |
| `npm run size --prefix frontend` | 0 | 0,11 s | 5/5 métricas OK (salida abajo) |
| `npm run test --prefix frontend` | 0 | 5,24 s | **691 tests / 52 archivos** (vitest jsdom) |

Salida textual de `npm run size` sobre el build medido (3 métricas históricas base `059172a` + 10% de margen; 2 métricas nuevas del conjunto inicial añadidas por `c71097e` con base `0f503a2`):

```
Bundle de 2026-10-13 (059172a), margen +10%:
Base del conjunto inicial: 2026-10-13 (0f503a2).
Métrica                                     Base   Presupuesto        Actual   Δ vs base  Estado
------------------------------------------------------------------------------------------------
JS de entrada (gzip)                      95.970       105.567        94.845       -1,2%  OK
CSS de entrada (gzip)                     43.502        47.853         7.307      -83,2%  OK
Chunk JS más grande (sin comprimir)       301.916       332.108       298.572       -1,1%  OK
JS inicial total (gzip)                  158.877       174.765       151.491       -4,6%  OK
CSS inicial total (gzip)                  43.684        48.053         7.307      -83,3%  OK

[bundle] Presupuesto OK.
```

## 2) Lighthouse 12.8.2: medianas por página × dispositivo (A3 `40c152b` vs C1 `10edcd2`)

27 corridas, 0 fallos. "Transferido" = `audits["total-byte-weight"]` (estáticos + API del flujo de la página). Evidencia por combinación (LHR de la mediana de LCP): `mobile-login-run1`, `mobile-portada-run2`, `mobile-administracion-run3`, `tablet-login-run2`, `tablet-portada-run1`, `tablet-administracion-run2`, `desktop-login-run1`, `desktop-portada-run3`, `desktop-administracion-run2` — archivos `*.lhr.json.gz` en `lighthouse/final/`.

Formato: valor A3 → **valor C1** en cada celda.

| Dispositivo | Página | Perf (A3→C1) | A11y (A3→C1) | BP | LCP (A3→C1, ms) | TBT (A3→C1, ms) | CLS | Transferido (A3→C1, B) | Δ transfer |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| mobile | login | 97 → 98 | 92 → 95 | 100 | 2.171 → 1.965 | 4 → 0 | 0.000 | 206.407 → 164.861 | −41.546 (−20,1%) |
| mobile | portada | 96 → 97 | 95 → 95 | 100 | 2.416 → 2.265 | 0 → 0 | 0.000 | 208.027 → 166.481 | −41.546 (−20,0%) |
| mobile | administracion | 96 → 98 | 94 → 94 | 100 | 2.403 → 2.109 | 0 → 0 | 0.000 | 209.235 → 167.800 | −41.435 (−19,8%) |
| tablet | login | 97 → 98 | 92 → 95 | 100 | 2.156 → 1.964 | 0 → 0 | 0.000 | 206.407 → 164.861 | −41.546 (−20,1%) |
| tablet | portada | 96 → 97 | 95 → 95 | 100 | 2.419 → 2.265 | 0 → 0 | 0.000 | 208.027 → 166.481 | −41.546 (−20,0%) |
| tablet | administracion | 96 → 97 | 94 → 94 | 100 | 2.403 → 2.259 | 6 → 0 | 0.000 | 209.235 → 167.800 | −41.435 (−19,8%) |
| desktop | login | 100 → 100 | 92 → 95 | 100 | 469 → 457 | 0 → 0 | 0.000 | 206.407 → 164.861 | −41.546 (−20,1%) |
| desktop | portada | 100 → 100 | 95 → 95 | 100 | 536 → 537 | 0 → 0 | 0.000 | 208.027 → 166.481 | −41.546 (−20,0%) |
| desktop | administracion | 100 → 100 | 95 → 95 | 100 | 523 → 530 | 0 → 0 | 0.000 | 209.235 → 167.800 | −41.435 (−19,8%) |

FCP/SI de mediana (contexto de la simulación móvil/tablet): A3 1.951–2.021 ms → C1 1.807–1.815 ms (−9/−11%); desktop en ambos ~0.4–0.5 s. El +1/+2 puntos de performance en móvil/tablet es la combinación de (a) −41 kB transferidos y (b) FCP/LCP más cortos por la hoja 22× menor. TBT 0 ms en todas las combinaciones de C1 (en A3 quedaban 4–6 ms residuales, ruido de la simulación).

Composición de la transferencia de `/login` (móvil, corrida de evidencia, `network-requests`): A3 = Document 1.014 + Scripts 158.902 + Stylesheet 44.334 + otros 2.157 = 206.407 B → C1 = Document 1.027 + **Scripts 153.656** (3 requests: entry + ui + vendor-supabase) + **Stylesheet 8.021** + otros 2.157 = 164.861 B. La hoja CSS (−36 kB transferidos) explica la mayor parte del ahorro; los scripts −5,2 kB (tree-shaking + TS estricto). En portada la diferencia es el API (perfiles + sucursales ≈ 1,6 kB) y en administración los chunks `Administracion-*.js` + `ModulePage-*.js` (<1 kB) + perfil.

## 3) Tamaños por chunk: antes (40c152b) vs después (10edcd2)

Inventarios completos: `lighthouse/baseline/chunks.json` y `lighthouse/final/chunks.json` (gzip −9). Chunks ≥ 8 kB:

| Archivo (dist/assets) | A3 sin comp. | A3 gzip | C1 sin comp. | C1 gzip | Δ gzip |
| --- | ---: | ---: | ---: | ---: | ---: |
| `index-B6DZrmIA.js` (entry; A3: `index-BfzN8EfA.js`) | 312.573 | 98.993 | 298.572 | 94.671 | −4.322 |
| `index-7ISXOBtJ.css` (CSS global; A3: `index-q6VLNRSs.css`) | 290.723 | 43.002 | 36.730 | 7.285 | −35.717 |
| `vendor-supabase-smfxDXm8.js` (nuevo nombre del cliente Supabase) | 224.500 | 58.141 | 206.946 | 52.816 | −5.325 |
| `schemas-2EzKJY-T.js` (chunk compartido de zod nuevo) | — | — | 110.332 | 32.374 | nuevo |
| `RankingVendedores-*.js` | 179.139 | 53.480 | 3.673 | 1.544 | −51.936 |
| `toast-utils-*.js` | 110.911 | 32.667 | 1.176 | 667 | −32.000 |
| `Produccion-*.js` | 23.342 | 5.159 | 24.977 | 6.507 | +1.348 |
| `ui-*.js` (chunk compartido nuevo de la lib UI propia) | — | — | 9.828 | 3.678 | nuevo |
| `Despachos-*.js` | 19.158 | 5.093 | 19.480 | 5.159 | +66 |
| `RegistrarVenta-*.js` | 14.236 | 4.226 | 18.163 | 6.117 | +1.891 |
| `Devoluciones-*.js` | 14.779 | 4.323 | 15.660 | 4.461 | +138 |
| `Clientes-*.js` | 11.772 | 3.308 | 11.086 | 3.378 | +70 |

Totales: A3 = JS 945.377 B (278.438 gzip) + CSS 290.723 B (43.002 gzip) en 29 archivos → C1 = JS 758.444 B (226.448 gzip) + CSS 36.730 B (7.285 gzip) en **31 archivos** (JS −187 kB raw / −52 kB gzip; el resto son 21 micro-chunks < 8 kB de produccion, administracion y ventas).

**Boot set** (cierre de imports estáticos de `index.html` en `dist/.vite/manifest.json`):

| Archivo | A3 gzip | C1 gzip | Δ |
| --- | ---: | ---: | ---: |
| `assets/index-*.js` (React + router + shell + Login/stubs) | 98.993 | 94.671 | −4.322 |
| `assets/index-*.css` (Tailwind + base Mantine → solo Tailwind) | 43.002 | 7.285 | −35.717 |
| `assets/supabase-*.js` / `vendor-supabase-*.js` | 58.141 | 52.816 | −5.325 |
| `assets/ui-*.js` (nuevo) | — | 3.678 | +3.678 |
| **Total** | **200.136** | **158.450** | **−41.686 (−20,8%)** |

**Costo extra gzip de la primera navegación por ruta** (chunk lazy del manifest − boot set; misma fórmula de A3):

| Ruta | Dominio / página | A3 extra gzip | C1 extra gzip | Δ |
| --- | --- | ---: | ---: | ---: |
| `/ventas/registrar` | ventas/RegistrarVenta | 39.381 | 42.301 | +2.920 |
| `/clientes` | ventas/Clientes | 39.649 | 40.254 | +605 |
| `/gastos` | ventas/Gastos | 36.522 | 37.034 | +512 |
| `/despachos` | bodega/Despachos | 7.615 | 9.908 | +2.293 |
| `/produccion` (+ subrutas) | produccion/Produccion | 6.822 | 8.693 | +1.871 |
| `/devoluciones` | bodega/Devoluciones | 5.845 | 7.825 | +1.980 |
| `/stock` | bodega/Stock | 3.707 | 3.537 | −170 |
| `/ranking-vendedores` | ventas/RankingVendedores | 54.737 | 3.497 | **−51.240 (−93,6%)** |
| `/ventas` | ventas/Ventas | 3.366 | 3.377 | +11 |
| `/mi-comision` | ventas/MiComision | 2.485 | 3.166 | +681 |
| `/carga` | ventas/Carga | 3.144 | 3.127 | −17 |
| `/administracion` | administracion/Administracion | 553 | 664 | +111 |
| `/ubicaciones` · `/auditoria` · `/reportes` | administracion/* | 541–549 | 657–664 | +110 |

Dos movimientos naturales: el boot set se redujo sacando librerías de la primera carga (Mantine/dates fuera por `0b77e62`: la ruta `/ranking-vendedores` pasó de la más cara a ~3,5 kB) mientras los formularios crecieron con las validaciones zod compartidas de la ronda (el nuevo chunk `schemas-*.js`, 32,4 kB gzip, entra en la primera navegación de rutas con form: registrar/clientes/gastos crecen +0,5–2,9 kB gzip). Sumada boot + extras, la primera navegación desciende en todas las rutas (de −4 kB en `/ventas` hasta −49 kB en `/ranking-vendedores`).

## 4) Auditorías de score < 100: antes vs después (y su causa)

Auditorías con score < 1 en **≥ 2 de 3 corridas por combinación** (a partir de los 27 LHR en cada ronda; insights tienen peso 0 en el score):

| Auditoría | A3 (27 LHR) | C1 (27 LHR) | Causa / detalle |
| --- | --- | --- | --- |
| `color-contrast` (a11y, peso 7) | 3/3 en las 9 combos | 3/3 en las 9 combos | Sigue: textos < 4,5:1 sobre su fondo. Elementos que fallan en C1: login `button.inline-flex` 1 elem (las 9 combos); portada `dt.text-xs` + `footer.px-4` (móvil/tab), también `p.mt-1` (nuevo) y `span.truncate` (desktop) 6–7 elems; administración `footer.px-4` (1 elem) + `span.truncate` (desktop). Diferencia sobre A3: en `administracion` desapareció el elemento `span.mt-5` (re-layout del módulo con la página genérica: 3 → 2 desktop y 2 → 1 móvil); los demás pares siguen (A3-02 sigue abierta; el +3 de a11y en login es efecto del denominador, ver Limitaciones). |
| `unused-javascript` (peso 0; informativa en LH 12.8.2) | 3/3 en 9, waste 96.496 B (login) / 85.175 (portada) / 85.473 (adm); ~600 / 450 / 450 ms simulados | 3/3 en 9, waste **93.598** (login) / **81.966** (portada) / **82.034** (adm); 600 / 450 / 420 ms | A3-01 sigue abierto. Causa: en la primera navegación gran parte del entry y del chunk de Supabase queda sin usarse. La mejora es pequeña (−3 kB) porque el ahorro de la ronda hizo archivos más pequeños, no menos código descargado-y-sin-usar en el arranque; `vendor-supabase` separado (`8088820`) sigue innecesario en la primera navegación. |
| `render-blocking-resources` (peso 0; informativa) | 3/3 en 9 (score 0,5; CSS 290,7 kB) | **6/9** (score 0,5 móvil/tablet) · desktop desbloqueado (score 1) | En móvil/tablet el render espera la hoja de estilos global; en C1 la hoja es 36,7 kB (−87%) y en desktop queda bajo el umbral del audit. Coste simulado 0 ms en ambas rondas (A3-04 apunta a fragmentar CSS por módulo, no a reducir el byte total). |
| `offscreen-images` (peso 0; informativa) | portada y adm móvil/tab (6/9) | portada y adm móvil/tab (4/9); login sin fallo | A3-03 parcialmente resuelto: el logo data-URI del drawer se sigue descargando con el menú oculto < 640 px en portada y administración móviles; `/login` ya no presenta el fallo y en desktop pasa. |

Insights con peso 0 presentes en ambas rondas (no afectan score): `network-dependency-tree-insight` en 9/9 y `render-blocking-insight` en 9/9; coinciden con lo anterior (bloqueo de la primera pintura por la hoja global −87% más pequeña y el peso del vendor de Supabase). Las métricas ponderadas (FCP/LCP/SI/TBT/CLS) quedan bajo 100 solo en móvil/tablet: reflejan la simulación de Lantern sobre la estación local, igual que en A3 (FCP/SI ~1,81 s móvil en C1).

## 5) Interpretación dentro de la variabilidad

- Mismo artilugio de medición, mismas versiones y misma estación → comparación directa (LH 12.8.2 y Chrome 155.0.8059.39 en ambas; servidor con las dos únicas diferencias de cabeceras documentadas, idénticas en ambas).
- Las cifras de bytes (manifest, chunks, transferido) son deterministas (gzip −9 sobre dist; build reproducido con el mismo inventario `lighthouse/final/chunks.json`); la caída de 41,4–41,5 kB por primera carga es uniforme en las 9 combinaciones y supera con holgura el ruido entre corridas (LCP mismo combo varió ±3–83 ms entre las 3 corridas).
- No atribuible a la app: la subida de +3 en a11y de login es estructura del score (18 contra 12 auditorías aplicables), no un cambio de estilo (los pares contrastantes siguen); el LCP desktop `/login` (469→457 ms) cabe dentro del ruido de la simulación. El +1/+2 de performance en móvil/tablet sí refleja datos reales (−41 kB transferidos + FCP/LCP −9%) y repite el patrón en las 6 combinaciones móviles.

## 6) Hallazgos (continuación de A3; ningún cambio de código requerido ahora)

```
C1-01 | P2 | login/portada/adm × 3 dispositivos | final/mobile-login-run1.lhr.json.gz (unused-javascript: entry index-*.js 49.477 B + vendor-supabase-*.js 44.121 B wasted, ~+600 ms LCP móvil) | correlato A3-01 y #50 | una primera navegación trae gran parte del entry + supabase sin usarlo | continuar la partición (vendor-supabase ya separado); evaluar split del entry del shell | frontend/src (lazy por módulo) | M
C1-02 | P2 | login/portada/adm × 3 dispositivos | final/mobile-login-run1.lhr.json.gz (color-contrast, score 0 a11y) + Login.tsx button.inline-flex (bg-brand-600 + text-white), Dashboard dt.text-xs/p.mt-1 (texts slate < 4.5:1), DashboardLayout footer.px-4 | pares con contraste insuficiente (a11y 94-95) en todas las rutas | revisar los pares y centralizar en src/lib/ui.ts (A3-02 sigue); se avanza de A3 solo en el par retirado de administración | frontend/src | M
C1-03 | P3 | portada/adm móvil/tablet | final/mobile-portada-run1.lhr.json.gz (offscreen-images: img.h-10 inline del aside#menu-lateral) | el logo del drawer se descarga aunque el menú no se ve < 640 px (A3-03 parcialmente resuelto; falta en portada y administración) | renderizar el img solo cuando el menú es visible | frontend/src/components/DashboardLayout.tsx | S
C1-04 | P3 | móvil/tablet (desktop ya desbloqueado) | final/mobile-login-run1.lhr.json.gz (render-blocking-resources, CSS index-7ISXOBtJ.css 36,7 kB) | la hoja global sigue bloqueando la primera pintura en móviles aunque 22× menor | CSS por módulo o inline crítico (A3-04 sigue); decidir con estas cifras de C1 | frontend/src (styles) | L
```

## 7) Cómo repetir la medición (idéntico a A3 §7)

Comandos exactos, desde la raíz del repo, con el stack local corriendo y `frontend/.env.local` apuntando al SUPABASE local (NO commiteado; generado a mano de `supabase status -o env`):

```sh
# 1) Stack local y env (URL dirigiendo al Supabase LOCAL)
supabase start
# frontend/.env.local (gitignored; NO commitear):
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_ANON_KEY=<ANON_KEY de `supabase status -o env`>

# 2) Gates + build de producción (+ manifest para el análisis de chunks)
npm run lint --prefix frontend
npm run build --prefix frontend
npx vite build --manifest --prefix frontend   # regenera dist/.vite/manifest.json
npm run size --prefix frontend
npm run test --prefix frontend

# 3) Servidor local y medición (idéntico a A3; salida en lighthouse/final)
node docs/archive/audits/2026-10-13/frontend-ux/scripts/servidor-local-a3.mjs \
     --port 5183 --supabase http://127.0.0.1:54321 &
node docs/archive/audits/2026-10-13/frontend-ux/scripts/run-a3-baseline.mjs \
     --base http://127.0.0.1:5183 --runs 3 \
     --out docs/archive/audits/2026-10-13/frontend-ux/lighthouse/final
```

Cuentas de la sesión, idénticas a A3: `ux-vendedor@example.invalid` / `ux-admin@example.invalid` con contraseña `ux-local-2026` (ya registradas en Supabase local; el login real se hace por el formulario vía CDP, igual que en A3). Salida del medidor: `lighthouse/final/` con **27 LHR (1,35 MB total, dentro del techo de 2 MB)** + `resumen.json` (medianas, detalle por corrida y `fallos: []`) + `chunks.json` (inventario, boot set, extras por ruta y comparación con el presupuesto) + `ejecucion.log` (log línea por línea).

## 8) Limitaciones

Las de A3 §8 rigen tal cual (simulación de Lantern sobre bytes reales; dos diferencias de cabeceras documentadas en el servidor de medición; tablet vía flags form-factor móvil + 768×1024@2x; transferido autenticado incluye REST; first-navigation por manifest; solo Chromium).

Adicionalmente específicas de esta comparación:

- **LH 12.8.2 calcula el score de accesibilidad como promedio ponderado solo entre las auditorías aplicables a la página** (sumas ponderadas en login: A3 79 de 86; C1 130 de 137; portada idéntica 126 de 133 en ambas). El score de a11y no compara 1:1 si la estructura del DOM cambia: en login, pasar de 12 → 18 auditorías aplicables (todas pasando las nuevas) baja el peso relativo del único fail (color-contrast), subiendo el score 92 → 95 aunque el par contrastante NO se arregló (sigue fallando en C1 con el mismo elemento). El insumo honesto para la fase siguiente es la lista de elementos de §4, no el score.
- El script `frontend/scripts/check-bundle-size.mjs` creció de 3 → 5 métricas durante la ronda (`c71097e`, otra tarea): las 3 métricas históricas se evalúan sobre la base `059172a` (idéntico a A3) y las 2 nuevas sobre `0f503a2`; no contamina el comparativo porque entre A3 y C1 la definición de las 3 métricas compartidas no cambió.
- El boot set se mide con gzip −9 sobre dist (manifest) mientras que el transferido de Lighthouse usa la codificación del servidor (nivel zlib por defecto): por eso 158.450 (gzip −9) no es comparable con 164.861 (transferido); cada métrica se compara consigo misma entre rondas, no contra la otra.
- No se ejecutó `npm run test:integration` (excluido por el enunciado de la tarea).
