# A3 — Línea base de rendimiento y presupuesto de frontend-ux

**Tarea:** TAREA A3 (Beads OND-c07.3) · **Fecha:** 2026-10-13 · **Producto:** solo este informe, `lighthouse/baseline/**` y `scripts/` (cero cambios en `frontend/src`).
**Commit medido:** `40c152bb435d06af9baea9d1e1fe0b051bc76621` (`40c152b`, branch de worktree `Cristhian-S1/fux-a3-baseline`, base `develop`). Entry del build: `frontend/dist/assets/index-BfzN8EfA.js`.
Ni `frontend/bundle-budget.json` ni `docs/engineering/performance.md` ni `frontend/vite.config.ts` ni `frontend/vercel.json` fueron modificados (solo citados).

## Resumen ejecutivo

- Gates de calidad verdes: `lint` 5,96 s · `build` 4,33 s (incremental) · `size` OK contra `frontend/bundle-budget.json` (+3,3% JS de entrada, +0,3% CSS de entrada, +3,5% chunk mayor) · `test` 529/529 en 44 archivos (5,6 s). No se ejecutó `npm run test:integration` (lo corre el coordinador al integrar).
- 29 chunks: JS total 945.377 B (278.438 B gzip −9), CSS global 290.723 B (43.002 B gzip −9). Boot set (primera carga de `/login`): 827.796 B (200.136 B gzip), prácticamente idéntico al registrado en `docs/engineering/performance.md` para `fed03ea` (827.796 B / 200.125 B).
- Lighthouse 12.8.2: 27 corridas (3 dispositivos × 3 páginas × 3 corridas, mediana) con 0 fallos. Scores de rendimiento 96–100; las auditorías recurrentes por debajo de 100 son `unused-javascript` (~+450 ms simulados) y `color-contrast` (accesibilidad 92–95).
- Primera carga autenticada con cache HTTP fría: ~208–209 kB, que incluyen las respuestas del API (perfiles, sucursales, datos del tablero); los estáticos son el mismo boot set de `/login`.

## Entorno y versiones

| Herramienta | Versión |
| --- | --- |
| Supabase CLI (stack local `ondina-erp`) | 2.111.0 |
| Node.js / npm | v26.3.1 / 11.16.0 (CI fija Node 22 desde `frontend/.nvmrc`) |
| Google Chrome | 155.0.8059.39 (`/usr/bin/google-chrome`) |
| Lighthouse | 12.8.2 (`npx -y lighthouse@12.8.2`) |
| Build medido | `40c152b`, `.env.local` con `VITE_SUPABASE_URL=http://127.0.0.1:54321` |

Cuentas sintéticas locales (contraseña `ux-local-2026`): `ux-vendedor@example.invalid` (vendedor sucursal A) y `ux-admin@example.invalid` (administrador sucursal A). Todo se corrió contra Supabase **local** (`http://127.0.0.1:54321`); no se tocó BD remota, Supabase cloud ni Vercel, y no se usaron datos de producción.

## 1) Gates: lint, build, size, test

Corrida final (tras la medición; mismo código y env, entry con hash estable):

| Comando | RC | Tiempo | Resultado |
| --- | --- | ---: | --- |
| `npm run lint --prefix frontend` | 0 | 5.962 ms | sin hallazgos |
| `npm run build --prefix frontend` | 0 | 4.327 ms | `tsc -b && vite build` (incremental) |
| `npm run size --prefix frontend` | 0 | 125 ms | presupuesto OK (salida abajo) |
| `npm run test --prefix frontend` | 0 | 5.613 ms | **529 tests / 44 archivos** (vitest jsdom) |

Salida textual de `npm run size` sobre el build medido (el CI contrasta estas tres métricas contra `frontend/bundle-budget.json`, base `059172a` + 10% de margen; script en `frontend/scripts/check-bundle-size.mjs:1-13`):

```
Bundle de 2026-10-13 (059172a), margen +10%:
Métrica                                     Base   Presupuesto        Actual   Δ vs base  Estado
------------------------------------------------------------------------------------------------
JS de entrada (gzip)                      95.970       105.567        99.176       +3,3%  OK
CSS de entrada (gzip)                     43.502        47.853        43.619       +0,3%  OK
Chunk JS más grande (sin comprimir)       301.916       332.108       312.573       +3,5%  OK

[bundle] Presupuesto OK.
```

Verificación de equivalencia: tras esa corrida final, el inventario del dist y el hash del entry (`index-BfzN8EfA.js`) se reprodujeron idénticos, así que todas las cifras de Lighthouse corresponden a este build.

## 2) Tamaños por chunk y comparación con el presupuesto

Inventario completo en `lighthouse/baseline/chunks.json` (medición con `gzip -9`). Chunks ≥ 10 kB sin comprimir:

| Archivo (dist/assets) | Sin comprimir | gzip (−9) |
| --- | ---: | ---: |
| `index-BfzN8EfA.js` (entry) | 312.573 | 98.993 |
| `index-q6VLNRSs.css` (CSS global) | 290.723 | 43.002 |
| `supabase-DPIA31R_.js` (chunk compartido del cliente Supabase) | 224.500 | 58.141 |
| `RankingVendedores-BnSS_LyV.js` (lazy, solo `/ranking-vendedores`) | 179.139 | 53.480 |
| `toast-utils-B1_QWf9N.js` (chunk compartido de notificaciones) | 110.911 | 32.667 |
| `Produccion-BBKRv1S8.js` | 23.342 | 5.159 |
| `Despachos-mIx3VAwb.js` | 19.158 | 5.093 |
| `Devoluciones-C4yIIWbk.js` | 14.779 | 4.323 |
| `RegistrarVenta-CqY6xM6g.js` | 14.236 | 4.226 |
| `Clientes-Bkw_8WRJ.js` | 11.772 | 3.308 |

Totales: JS 945.377 B (278.438 B gzip −9) + CSS 290.723 B (43.002 B gzip −9) en 29 archivos.

**Boot set** (cierre de imports estáticos de `index.html` en `dist/.vite/manifest.json`):

| Archivo | Sin comprimir | gzip (−9) |
| --- | ---: | ---: |
| `assets/index-*.js` (React, Mantine core, router, Login, Dashboard, layout, stubs de dominios) | 312.573 | 98.993 |
| `assets/index-*.css` (Tailwind + CSS base de Mantine) | 290.723 | 43.002 |
| `assets/supabase-*.js` (cliente Supabase compartido) | 224.500 | 58.141 |
| **Total** | **827.796** | **200.136** |

**Costo extra gzip de la primera navegación por ruta** (chunk lazy del manifest − boot set; misma fórmula de `docs/engineering/performance.md:64-87`):

| Ruta | Dominio / página | Extra gzip |
| --- | --- | ---: |
| `/ranking-vendedores` | ventas/RankingVendedores | 54.737 |
| `/clientes` | ventas/Clientes | 39.649 |
| `/ventas/registrar` | ventas/RegistrarVenta | 39.381 |
| `/gastos` | ventas/Gastos | 36.522 |
| `/despachos` | bodega/Despachos | 7.615 |
| `/produccion` (+ subrutas del mismo módulo) | produccion/Produccion | 6.822 |
| `/ventas` | ventas/Ventas | 3.366 |
| `/administracion` | administracion/Administracion | 553 |
| `/ubicaciones` · `/auditoria` · `/reportes` | administracion/* | 541–553 |

Refleja el hallazgo de `performance.md`: lo más pesado (`@mantine/dates` + locale dayjs de RankingVendedores) no se descarga en la primera pantalla, solo cuando se abre esa ruta.

**Comparación con `frontend/bundle-budget.json`** (misma semántica que `frontend/scripts/check-bundle-size.mjs`):

| Métrica | Base (059172a) | Límite (+10%) | Actual (40c152b) | Δ | Estado |
| --- | ---: | ---: | ---: | ---: | --- |
| JS de entrada (gzip) | 95.970 | 105.567 | 99.176 | +3,34% | OK |
| CSS de entrada (gzip) | 43.502 | 47.852 | 43.619 | +0,27% | OK |
| Chunk JS más grande (sin comprimir) | 301.916 | 332.108 | 312.573 | +3,53% | OK |

## 3) Lighthouse 12.8.2: método

Cada combinación (3 dispositivos × 3 páginas) se corrió 3 veces y se reporta la **mediana** de cada métrica. Flags por dispositivo (idénticos a los comandos documentados en `docs/engineering/performance.md:35-41`):

| Dispositivo | Flags adicionales |
| --- | --- |
| mobile | (preset por defecto) |
| tablet | `--screenEmulation.width=768 --screenEmulation.height=1024 --screenEmulation.deviceScaleFactor=2 --screenEmulation.mobile=true --formFactor=mobile` |
| desktop | `--preset=desktop` |

Base común: `-y lighthouse@12.8.2 <url> --chrome-path=/usr/bin/google-chrome --chrome-flags="--headless=new" --output=json --output-path=<tmp> --only-categories=performance,accessibility,best-practices --max-wait-for-load=60000 --port=<CDP>`. Diferencia con `performance.md`: A3 añade accessibility y best-practices al filtro de categorías (allí solo se midió performance).

**Sesión autenticada (método documentado).** `--extra-headers` no basta para la sesión de la app, así que el script replica el flujo real:

1. Chrome headless persistente con puerto CDP dedicado y perfil limpio por invocación (`--headless=new --no-sandbox`).
2. Conexión CDP directa (WebSocket; sin dependencias nuevas): se crea una pestaña hacia `http://127.0.0.1:5183/login`, se llenan `input[type="email"]` / `input[type="password"]` con el setter nativo + eventos `input` (formulario React controlado) y se hace clic en "Ingresar"; eso ejecuta `supabase.auth.signInWithPassword` y el cliente guarda el token en `localStorage` (`sb-127-auth-token`). Verificado por CDP: POST `http://127.0.0.1:54321/auth/v1/token` → 200 y lecturas REST `perfiles` / `sucursales` → 200.
3. Con la sesión activa, Lighthouse navega `/` (portada del vendedor) y `/administracion` (solo administrador, `frontend/src/domains/administracion/index.tsx:26`).
4. En corridas autenticadas Lighthouse corre con `--disable-storage-reset` (mantiene la sesión) y el script ejecuta `Network.clearBrowserCache` **antes de cada corrida** desde una pestaña de control, de modo que el "peso transferido" mide una primera carga con cache HTTP fría (sin esa limpieza, la cache compartida colapsaría la cifra a ~2 kB).
5. Al alternar de usuario, el script cierra la sesión anterior borrando `localStorage` y volviendo a `/login`.

**Servidor de medición y cabeceras (causa documentada del bloqueo inicial).** El `TypeError: Failed to fetch` que bloqueaba el login en la primera tentativa **no fue de red**: `frontend/vite.config.ts:10-19` aplica a `vite preview` las cabeceras de `vercel.json`, entre ellas la CSP de producción con `connect-src 'self' https://*.supabase.co wss://*.supabase.co`, que bloquea los fetch hacia `http://127.0.0.1:54321` (nada llegó a la red: sin registros en CDP `Network.*` para esas peticiones). Con esa CSP activa no bastó con flags del navegador (`--disable-features=...`) ni con `Browser.grantPermissions`. La solución instruida por el coordinador (y usada aquí) no altera nada del build: `scripts/servidor-local-a3.mjs` sirve el mismo `dist` en el puerto 5183 (fallback SPA a `index.html`, como preview) copiando **las mismas cabeceras de `vercel.json`** con una ÚNICA diferencia: en `connect-src` se añade `http://127.0.0.1:54321 ws://127.0.0.1:54321` (CSP resultante verificada con `curl -D -`). Esa es la única divergencia de seguridad respecto de producción/vite-preview local.

También se replica una conducta que Vercel agrega más allá de `vercel.json`: `Cache-Control: public, max-age=31536000, immutable` para `/assets/*` con hash (segunda diferencia ya explicitada aquí; sin ella los audits de cache penalizan el score por la carencia de CDN en la máquina local y la medición bajaría por motivos ajenos al producto). El resto de cabeceras (X-Frame-Options, Permissions-Policy, Referrer-Policy, X-Content-Type-Options, CSP) se sirven idénticas a producción.

## 4) Resultados: medianas por página × dispositivo

27 corridas en 292 s, 0 fallos. "Transferido" = `audits["total-byte-weight"]` (estáticos + API del flujo de la página; en `/login` la app no llama al REST). Evidencia por combinación (LHR de la mediana): `mobile-login-run3`, `mobile-portada-run1`, `mobile-administracion-run2`, `tablet-login-run1`, `tablet-portada-run1`, `tablet-administracion-run3`, `desktop-login-run3`, `desktop-portada-run2`, `desktop-administracion-run1` — archivos `*.lhr.json.gz` en `lighthouse/baseline/`.

| Dispositivo | Página | Performance | Accessibility | Best Practices | LCP (ms) | TBT (ms) | CLS | Transferido (B) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mobile | login | 97 | 92 | 100 | 2.171 | 4 | 0.000 | 206.407 |
| mobile | portada | 96 | 95 | 100 | 2.416 | 0 | 0.000 | 208.027 |
| mobile | administracion | 96 | 94 | 100 | 2.403 | 0 | 0.000 | 209.235 |
| tablet | login | 97 | 92 | 100 | 2.156 | 0 | 0.000 | 206.407 |
| tablet | portada | 96 | 95 | 100 | 2.419 | 0 | 0.000 | 208.027 |
| tablet | administracion | 96 | 94 | 100 | 2.403 | 6 | 0.000 | 209.235 |
| desktop | login | 100 | 92 | 100 | 469 | 0 | 0.000 | 206.407 |
| desktop | portada | 100 | 95 | 100 | 536 | 0 | 0.000 | 208.027 |
| desktop | administracion | 100 | 95 | 100 | 523 | 0 | 0.000 | 209.235 |

Composición de la transferencia de `/login` (móvil, corrida de evidencia, formato `network-requests`): Document 1.014 B + Script 158.902 B + Stylesheet 44.334 B + otros 2.157 B = 206.407 B. TBT 0–6 ms y CLS 0.000 en las 9 combinaciones.

Auditorías con score < 100 (frecuencia ≥ 2 de 3 corridas en cada combinación; extraídas de los 27 LHR):

- `color-contrast` — 3/3 en las 9 combinaciones; raíz del score a11y 92–95 (hallazgo A3-02).
- `unused-javascript` — 3/3 en las 9; oportunidad simulada ~+450 ms en móvil/tablet (desglose: entry 50.679 B gzip + chunk `supabase-*.js` 45.817 B gzip deducibles en la portada; hallazgo A3-01).
- `render-blocking-resources` y `render-blocking-insight` — 3/3 en las 9; señalan la hoja global `index-q6VLNRSs.css` (290,7 kB); con costo simulado ~0 ms (hallazgo A3-04).
- `offscreen-images` — portada 3/3 (móvil/tablet) y administración 2–3/3: `img.h-10` del `aside#menu-lateral` se descarga aunque el menú no es visible bajo 640 px (hallazgo A3-03).
- Las métricas ponderadas (FCP/LCP/TTI/SI) suman score <100 solo en móvil/tablet: son el propio comportamiento de Lantern sobre la medición local, no regresiones del producto.

## 5) Comparación con `docs/engineering/performance.md`

`performance.md` midió solo `/login` en el commit `fed03ea` (branch `Cristhian-S1/test-t1-rendimiento`) servido con `vite preview` (cabeceras de vercel.json aplicadas); A3 mide `40c152b`, agrega dos rutas autenticadas y usa el servidor local de §3 (mismo `dist`, cabeceras idénticas salvo las dos diferencias documentadas).

| Métrica (`/login`) | performance.md (`fed03ea`) | A3 (`40c152b`) | Variación |
| --- | --- | --- | --- |
| Performance móvil / tablet / desktop | 98 / 97 / 100 | 97 / 97 / 100 | móvil −1 |
| LCP móvil / tablet / desktop | 1.957 / 2.104 / 443 ms | 2.171 / 2.156 / 469 ms | +11% / +2% / +6% |
| TBT (móvil/tablet/desktop) | 13 / 0 / 0 ms | 4 / 0 / 0 ms | dentro de ruido |
| CLS | 0.000 | 0.000 | igual |
| Transferencia total | 207.129 B | 206.407 B | −0,3% |
| JS transferido (entry + supabase) | 159.194 B | 158.902 B | −0,2% |
| CSS transferido | 44.454 B | 44.334 B | −0,3% |
| Boot set (gzip −9, manifest) | 200.125 B | 200.136 B | +11 B |

El estado del presupuesto no cambia: `npm run size` sigue reportando +3,3% de JS de entrada y +0,3% de CSS (en `performance.md:109` los Δ eran los mismos). El mayor LCP móvil (2.171 vs 1.957 ms) está dentro de la variabilidad conocida de Lantern en la misma estación (el build estático es equivalente en contenido: transferencia total −0,3% y boot set +11 B); los cambios reales a comparar entre ambas corridas son `color-contrast` / `unused-javascript`, presentes en ambas. El "Transferido autenticado" (portada 208.027 B; administración 209.235 B) no tiene análogo en `performance.md` (quedó fuera de alcance de aquella medición): es el mismo estático más las respuestas REST de cada página.

## 6) Hallazgos (insumos para Fase C; ningún cambio de código requerido ahora)

```
A3-01 | P2 | móvil/tablet, las 3 rutas | lighthouse/baseline/mobile-portada-run1.lhr.json.gz (unused-javascript: entry 50.679 B gzip + supabase-*.js 45.817 B gzip, ~+450 ms LCP simulado); correlato de #50 y docs/engineering/performance.md:89-93 | gran parte del entry y del chunk supabase no se usa en la primera navegación | continuar la partición iniciada (p. ej. mover partes del boot a chunks bajo demanda), según prioridades del equipo | frontend/src (lazy por módulo) | M
A3-02 | P2 | 3 rutas × 3 dispositivos | mobile-portada-run1 / mobile-login-run3 / desktop-portada-run2 (.lhr.json.gz, color-contrast) + Login.tsx:82 (botón bg-brand-600 + text-white), Dashboard.tsx:53-75 (dt text-slate-400), DashboardLayout.tsx:187 (footer text-slate-400) | textos con contraste < 4,5:1 sobre su fondo (a11y 92-95) | revisar los pares y centralizar las clases en src/lib/ui.ts; entrada natural para la fase de accesibilidad | frontend/src/lib/ui.ts, Login, Dashboard, DashboardLayout | S
A3-03 | P3 | portada y administración, móvil/tablet | mobile-portada-run1.lhr.json.gz (offscreen-images: img.h-10 del aside#menu-lateral) | el logo del menú lateral se descarga aunque el menú está oculto < 640 px | renderizar el logo solo cuando el menú es visible | frontend/src/components/DashboardLayout.tsx | S
A3-04 | P3 | todas las rutas y dispositivos | mobile-login-run3.lhr.json.gz (render-blocking-resources: assets/index-q6VLNRSs.css, 290,7 kB) | la hoja global se sirve como bloqueante de la primera pintura en cada ruta | CSS por módulo o inline crítico; decidir en Fase C con las cifras de performance.md | frontend/src (styles) | L
A3-05 | P3 | escenarios self-hosted/local (no afecta CI/Vercel actuales) | frontend/vite.config.ts:17 (preview copia cabeceras de vercel.json) + frontend/vercel.json (CSP) | con la CSP de producción sin tocar, `npm run preview` en local no puede hablar con Supabase local ('TypeError: Failed to fetch'), y en un despliegue self-hosted la app se bloquearía igual | aceptar `http(s)://127.0.0.1` y `http(s)://localhost` en connect-src (decisión del equipo; el servidor de medición ya demuestra el parche mínimo) | frontend/vercel.json | S
```

La CSP vigente funciona en producción y CI; el escenario local o self-hosted queda bloqueado en el navegador (relevante si la app se despliega on-prem), por eso se marca P3 y se somete la decisión al equipo.

## 7) Cómo repetir la medición (Fase C)

Comandos exactos (desde la raíz del repo, con el stack local corriendo; añade `npm ci --prefix frontend` si falta node_modules):

```sh
# 1) Stack local y env (URL dirigiendo al Supabase LOCAL)
supabase start
# frontend/.env.local (gitignored; NO commitear):
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_ANON_KEY=<ANON_KEY de `supabase status -o env`>

# 2) Gates + build de producción (+ manifest para el análisis de chunks)
npm run lint --prefix frontend
npm run build --prefix frontend
npx vite build --manifest --prefix frontend   # regenera dist/.vite/manifest.json (sin cambios de config)
npm run size --prefix frontend
npm run test --prefix frontend

# 3) Servidor local (cdn + CSP de vercel.json con excepción local) y medición
node docs/archive/audits/2026-10-13/frontend-ux/scripts/servidor-local-a3.mjs \
     --port 5183 --supabase http://127.0.0.1:54321 &
node docs/archive/audits/2026-10-13/frontend-ux/scripts/run-a3-baseline.mjs \
     --base http://127.0.0.1:5183 --runs 3 \
     --out docs/archive/audits/2026-10-13/frontend-ux/lighthouse/baseline
```

Opciones del medidor: `--devices mobile,desktop`, `--pages login,portada,administracion`, `--runs N`, `--skip-existing` (reanuda solo lo faltante), `--chrome <ruta>`, `--dry-run` (imprime los comandos de npx sin medir). Los LHR crudos quedan como `*.lhr.json.gz` (LHR íntegro sin las capturas embebidas; `gunzip` solo si se necesita) para respetar el techo de ~2 MB del directorio de resultados (actual: 1,38 MB); `resumen.json` y `chunks.json` son archivos planos. El servidor local escribe sus registros en stdout; redirígelos si los necesitas (p. ej. `> /tmp/opencode/a3-servidor.log 2>&1`).

## 8) Limitaciones

- **Lantern/simulación:** Lighthouse simula la red (mobile 1,6 Mbps / CPU 4×; desktop 10 Mbps) sobre el byte real del preview local; los números dependen de la máquina. Comparar siempre con las mismas versiones (LH 12.8.2, Chrome 155) y con la estación en reposo. Las medianas difieren de las de `performance.md` dentro de la variabilidad documentada (véase §5).
- **Cabeceras de medición:** dos diferencias documentadas respecto de producción, solo del artilugio local (`servidor-local-a3.mjs`), sin cambios en build, config o código de producto: (1) `connect-src` de la CSP copiada de `vercel.json` añade `http://127.0.0.1:54321 ws://127.0.0.1:54321`; (2) `Cache-Control: max-age=31536000, immutable` para `/assets/*` (equivale al CDN de Vercel sobre assets con hash).
- **Transferido autenticado:** incluye respuestas REST del flujo de cada página; no es una cifra de solo activos.
- **First-navigation por ruta:** cálculo del manifest (cierre de imports estáticos − boot set), igual que en `performance.md`; no fue instrumentado en el navegador.
- El tablet se mide con los flags de `performance.md` (form-factor móvil + 768×1024@2x).
- Solo se usó Chromium (Chrome 155 headless); sin Firefox/Safari. No se ejecutó `npm run test:integration` (excluido por el enunciado de la tarea).
