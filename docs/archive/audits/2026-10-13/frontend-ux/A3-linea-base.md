# A3 — Línea base de rendimiento y presupuesto de frontend-ux

**Tarea:** TAREA A3 (Beads OND-c07.3) · **Fecha:** 2026-10-13 · **Producto:** solo este informe, `lighthouse/baseline/**` y `scripts/` (cero cambios en `frontend/src`).
**Commit medido:** `40c152bb435d06af9baea9d1e1fe0b051bc76621` (`40c152b`, branch de worktree `Cristhian-S1/fux-a3-baseline`, base `develop`).
Ni `frontend/bundle-budget.json` ni `docs/engineering/performance.md` fueron modificados (solo se citan).

## Resumen ejecutivo

- Gates de calidad verdes: `lint` 3,8 s · `build` 3,8 s (incremental) · `size` OK contra `frontend/bundle-budget.json` (+3,3% JS de entrada, +0,3% CSS de entrada, +3,5% chunk mayor) · `test` 529/529 en 44 archivos (4,0 s). No se ejecutó `npm run test:integration` (lo corre el coordinador al integrar).
- 29 chunks: JS total 945.376 B (278.433 B gzip −9), CSS global 290.723 B (43.002 B gzip −9). Boot set (primera carga de `/login`): 827.795 B (200.128 B gzip), prácticamente idéntico al registrado en `docs/engineering/performance.md` para `fed03ea` (827.796 B / 200.125 B).
- Lighthouse 12.8.2: 27 corridas (3 dispositivos × 3 páginas × 3 corridas, mediana) con 0 fallos. Scores de rendimiento 96–100; las auditorías recurrentes por debajo de 100 son `unused-javascript` (~+450 ms simulados en móvil) y `color-contrast` (accesibilidad 92–95).
- Primera carga autenticada con cache HTTP fría: ~205–206 kB, que incluyen las respuestas del API (perfiles, sucursales, datos del tablero); los estáticos son el mismo boot set de `/login`.

## Entorno y versiones

| Herramienta | Versión |
| --- | --- |
| Supabase CLI (stack local `ondina-erp`) | 2.111.0 |
| Node.js / npm | v26.3.1 / 11.16.0 (CI fija Node 22 desde `frontend/.nvmrc`) |
| Google Chrome | 155.0.8059.39 (`/usr/bin/google-chrome`) |
| Lighthouse | 12.8.2 (`npx -y lighthouse@12.8.2`) |
| Build medido | `40c152b`, entry `frontend/dist/assets/index-BqzvV4LJ.js` |

Cuentas sintéticas locales (contraseña `ux-local-2026`): `ux-vendedor@example.invalid` (vendedor sucursal A) y `ux-admin@example.invalid` (administrador sucursal A). Todo se corrió contra Supabase **local** (`http://127.0.0.1:54321`); no se tocó BD remota, Supabase cloud ni Vercel, y no se usaron datos de producción.

## 1) Gates: lint, build, size, test

Corrida final (tras la medición; mismo código y env, entry con hash estable):

| Comando | RC | Tiempo | Resultado |
| --- | --- | ---: | --- |
| `npm run lint --prefix frontend` | 0 | 3.830 ms | sin hallazgos |
| `npm run build --prefix frontend` | 0 | 3.847 ms | `tsc -b && vite build` (incremental); entry 312,57 kB |
| `npm run size --prefix frontend` | 0 | 119 ms | presupuesto OK (salida abajo) |
| `npm run test --prefix frontend` | 0 | 4.323 ms | **529 tests / 44 archivos** (vitest jsdom) |

Salida textual de `npm run size` (el CI contrasta estas tres métricas contra `frontend/bundle-budget.json`, base `059172a` + 10% de margen; script en `frontend/scripts/check-bundle-size.mjs:1-13`):

```
Bundle de 2026-10-13 (059172a), margen +10%:
Métrica                                     Base   Presupuesto        Actual   Δ vs base  Estado
------------------------------------------------------------------------------------------------
JS de entrada (gzip)                      95.970       105.567        99.169       +3,3%  OK
CSS de entrada (gzip)                     43.502        47.853        43.619       +0,3%  OK
Chunk JS más grande (sin comprimir)       301.916       332.108       312.573      +3,5%  OK

[bundle] Presupuesto OK.
```

Verificación de equivalencia: tras esa corrida final, el inventario del dist y el hash del entry se reprodujeron idénticos, así que todas las cifras de Lighthouse corresponden a este build.

## 2) Tamaños por chunk y comparación con el presupuesto

Inventario completo en `lighthouse/baseline/chunks.json` (medición con `gzip -9`). Chunks ≥ 10 kB sin comprimir:

| Archivo (dist/assets) | Sin comprimir | gzip (−9) |
| --- | ---: | ---: |
| `index-BqzvV4LJ.js` (entry) | 312.573 | 98.985 |
| `index-q6VLNRSs.css` (CSS global) | 290.723 | 43.002 |
| `supabase-DrbKsUnY.js` (chunk compartido del cliente Supabase) | 224.499 | 58.141 |
| `RankingVendedores-Bt_EvVeM.js` (lazy, solo `/ranking-vendedores`) | 179.139 | 53.480 |
| `toast-utils-ClScOSSu.js` (chunk compartido de notificaciones) | 110.911 | 32.666 |
| `Produccion-CNG8Uqty.js` | 23.342 | 5.158 |
| `Despachos-D4cIzU73.js` | 19.158 | 5.094 |
| `Devoluciones-BwyCmVft.js` | 14.779 | 4.321 |
| `RegistrarVenta-Cg22Ww9K.js` | 14.236 | 4.225 |
| `Clientes-B62RmOym.js` | 11.772 | 3.305 |

Totales: JS 945.376 B (278.433 B gzip −9) + CSS 290.723 B (43.002 B gzip −9) en 29 archivos.

**Boot set** (cierre de imports estáticos de `index.html` en `dist/.vite/manifest.json`):

| Archivo | Sin comprimir | gzip (−9) |
| --- | ---: | ---: |
| `assets/index-*.js` (React, Mantine core, router, Login, Dashboard, layout, stubs de dominios) | 312.573 | 98.985 |
| `assets/index-*.css` (Tailwind + CSS base de Mantine) | 290.723 | 43.002 |
| `assets/supabase-*.js` (cliente Supabase compartido) | 224.499 | 58.141 |
| **Total** | **827.795** | **200.128** |

**Costo extra gzip de la primera navegación por ruta** (chunk lazy del manifest − boot set; misma fórmula de `docs/engineering/performance.md:64-87`):

| Ruta | Dominio / página | Extra gzip |
| --- | --- | ---: |
| `/ranking-vendedores` | ventas/RankingVendedores | 54.735 |
| `/clientes` | ventas/Clientes | 39.645 |
| `/ventas/registrar` | ventas/RegistrarVenta | 39.379 |
| `/gastos` | ventas/Gastos | 36.516 |
| `/despachos` | bodega/Despachos | 7.614 |
| `/produccion` (+ subrutas del mismo módulo) | produccion/Produccion | 6.820 |
| `/ventas` | ventas/Ventas | 3.365 |
| `/administracion` | administracion/Administracion | 558 |
| `/ubicaciones` · `/auditoria` · `/reportes` | administracion/* | 552–558 |

Refleja el hallazgo de `performance.md`: lo más pesado (`@mantine/dates` + locale dayjs de RankingVendedores) no se descarga en la primera pantalla, solo cuando se abre esa ruta.

**Comparación con `frontend/bundle-budget.json`** (misma semántica que `frontend/scripts/check-bundle-size.mjs`):

| Métrica | Base (059172a) | Límite (+10%) | Actual (40c152b) | Δ | Estado |
| --- | ---: | ---: | ---: | ---: | --- |
| JS de entrada (gzip) | 95.970 | 105.567 | 99.169 | +3,33% | OK |
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
2. Conexión CDP directa (WebSocket; sin dependencias nuevas): se crea una pestaña hacia `http://127.0.0.1:5183/login`, se llenan `input[type="email"]` / `input[type="password"]` con el setter nativo + eventos `input` (formulario React controlado) y se hace clic en "Ingresar"; eso ejecuta `supabase.auth.signInWithPassword` y el cliente guarda el token en `localStorage` (`sb-127-auth-token`). Verificado por CDP: POST `/auth/v1/token` → 200 y lecturas REST `perfiles` / `sucursales` → 200.
3. Con la sesión activa, Lighthouse navega `/` (portada del vendedor) y `/administracion` (solo administrador, `frontend/src/domains/administracion/index.tsx:26`).
4. En corridas autenticadas Lighthouse corre con `--disable-storage-reset` (mantiene la sesión) y el script ejecuta `Network.clearBrowserCache` **antes de cada corrida** desde una pestaña de control, de modo que el "peso transferido" mide una primera carga con cache HTTP fría (sin esa limpieza, la cache compartida colapsaría la cifra a ~2 kB).
5. Al alternar de usuario, el script cierra la sesión anterior borrando `localStorage` y volviendo a `/login`.

**Servidor de medición (ajuste documentado).** Chrome 142+ aplica la restricción *Local Network Access* y el navegador rechazó silenciosamente (`TypeError: Failed to fetch`, sin registro en CDP `Network.*`) todo fetch de la página servida en `127.0.0.1:5183` hacia `127.0.0.1:54321` (local → loopback de otro puerto; la navegación a 5183 sí funcionaba y el módulo `supabase-D*.js` del dist tenía la URL correcta horneada). Los intentos de desactivarlo en la línea de comandos (`--disable-features=LocalNetworkAccess*`, `LocalNetworkAccessCheck`, `NetworkServiceSandbox`, `PrivateNetworkAccessForNavigations`) y por CDP (`Browser.grantPermissions`) no surtieron efecto, y no hay acceso root para la política `LocalNetworkAccessAllowedForUrls`. Para no alterar el build, la medición sirvió el mismo `dist` con `scripts/servidor-local-a3.mjs`: servidor local **mismo origen (5183)** que entrega los estáticos con gzip y proxea `/auth`, `/rest`, `/realtime`, `/storage`, `/functions` → `127.0.0.1:54321`. El contenido estático y su compresión equivalen a los de `npx vite preview --port 5183 --strictPort` (ver deltas verificados en §5: −0,8% a −1,5%, boot set ≤ ±3 B).

## 4) Resultados: medianas por página × dispositivo

27 corridas en 285 s, 0 fallos. "Transferido" = `audits["total-byte-weight"]` (estáticos + API del flujo de la página; en `/login` la app no llama al REST). Evidencia por combinación (LHR de la mediana): `mobile-login-run2`, `mobile-portada-run1`, `mobile-administracion-run2`, `tablet-login-run1`, `tablet-portada-run3`, `tablet-administracion-run3`, `desktop-login-run1`, `desktop-portada-run3`, `desktop-administracion-run2` — archivos `*.lhr.json.gz` en `lighthouse/baseline/`.

| Dispositivo | Página | Performance | Accessibility | Best Practices | LCP (ms) | TBT (ms) | CLS | Transferido (B) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mobile | login | 98 | 92 | 100 | 2.012 | 0 | 0.000 | 203.960 |
| mobile | portada | 97 | 95 | 100 | 2.258 | 0 | 0.000 | 205.278 |
| mobile | administracion | 96 | 94 | 100 | 2.441 | 0 | 0.000 | 205.642 |
| tablet | login | 98 | 92 | 100 | 2.006 | 0 | 0.000 | 203.960 |
| tablet | portada | 97 | 95 | 100 | 2.257 | 0 | 0.000 | 205.278 |
| tablet | administracion | 96 | 94 | 100 | 2.447 | 0 | 0.000 | 205.642 |
| desktop | login | 100 | 92 | 100 | 471 | 0 | 0.000 | 203.960 |
| desktop | portada | 100 | 95 | 100 | 490 | 0 | 0.000 | 205.278 |
| desktop | administracion | 100 | 95 | 100 | 503 | 0 | 0.000 | 205.642 |

Composición de la transferencia de `/login` (móvil, corrida de evidencia, audit `network-requests`): Script 157.894 B, Stylesheet 43.834 B, Document 523 B, otros 1.709 B → total 203.960 B. TBT 0 ms y CLS 0.000 en las 9 combinaciones.

Auditorías con score < 100 (extraídas de los LHR de evidencia):

- `color-contrast` — presente en las 9 combinaciones; explica el score de a11y 92–95 (hallazgo A3-02).
- `unused-javascript` — en las 9; oportunidad simulada ~+450 ms en móvil/tablet (desglose: chunk `supabase-*.js` 44.284 B gzip + entry 40.888 B gzip; hallazgo A3-01).
- `render-blocking-resources` — señala la hoja global `index-q6VLNRSs.css` (290,7 kB); con costo simulado de 0 ms registra score <100 por el tamaño del recurso (hallazgo A3-04).
- `offscreen-images` — portada y administración (móvil/tablet): `img.h-10` del `aside#menu-lateral` se descarga aunque el menú no es visible bajo 640 px (hallazgo A3-03).

## 5) Comparación con `docs/engineering/performance.md`

`performance.md` midió solo `/login` en el commit `fed03ea` (branch `Cristhian-S1/test-t1-rendimiento`) servido con `vite preview`; A3 mide `40c152b`, agrega dos rutas autenticadas y usa el servidor local de §3 (mismos bytes estáticos).

| Métrica (`/login`) | performance.md (`fed03ea`) | A3 (`40c152b`) | Variación |
| --- | --- | --- | --- |
| Performance móvil / tablet / desktop | 98 / 97 / 100 | 98 / 98 / 100 | tablet +1 |
| LCP móvil / tablet / desktop | 1.957 / 2.104 / 443 ms | 2.012 / 2.006 / 471 ms | +2,8% / −4,7% / +6,3% |
| TBT (móvil/tablet/desktop) | 13 / 0 / 0 ms | 0 / 0 / 0 ms | estable en 0–13 ms |
| CLS | 0.000 | 0.000 | igual |
| Transferencia total | 207.129 B | 203.960 B | −1,5% |
| JS transferido (entry + supabase) | 159.194 B | 157.894 B | −0,8% |
| CSS transferido | 44.454 B | 43.834 B | −1,4% |
| Boot set (gzip −9, manifest) | 200.125 B | 200.128 B | ≤ 3 B |

El estado del presupuesto no cambia: `npm run size` sigue reportando +3,3% de JS de entrada y +0,3% de CSS (en `performance.md:109` los Δ eran los mismos). El "Transferido autenticado" (portada 205.278 B; administración 205.642 B) no tiene análogo en `performance.md` (quedó fuera de alcance de aquella medición): es el mismo estático más las respuestas REST de cada página.

## 6) Hallazgos (insumos para Fase C; ningún cambio de código requerido ahora)

```
A3-01 | P2 | móvil/tablet, las 3 rutas | lighthouse/baseline/mobile-portada-run1.lhr.json.gz (unused-javascript: supabase-*.js 44.284 B gzip + entry 40.888 B gzip, ~+450 ms LCP simulado); correlato de #50 y docs/engineering/performance.md:89-93 | gran parte del entry y del chunk supabase no se usa en la primera navegación | continuar la partición iniciada (p. ej. mover partes del boot a chunks demandados), según prioridades del equipo | frontend/src (lazy por módulo) | M
A3-02 | P2 | 3 rutas × 3 dispositivos | mobile-login-run2 / desktop-portada-run3 / tablet-administracion-run3 (.lhr.json.gz, color-contrast) + Login.tsx:82 (botón bg-brand-600 + text-white), Dashboard.tsx:53-75 (dt text-slate-400), DashboardLayout.tsx:187 (footer text-slate-400) | textos con contraste < 4,5:1 sobre su fondo (a11y 92-95) | revisar los pares y centralizar las clases en src/lib/ui.ts; aportación natural para la fase de accesibilidad | frontend/src/lib/ui.ts, Login, Dashboard, DashboardLayout | S
A3-03 | P3 | portada y administración, móvil/tablet | mobile-portada-run1.lhr.json.gz (offscreen-images: img.h-10 del aside#menu-lateral) | el logo del menú lateral se descarga aunque el menú está oculto < 640 px | renderizar el logo solo cuando el menú es visible | frontend/src/components/DashboardLayout.tsx | S
A3-04 | P3 | todas las rutas y dispositivos | mobile-login-run2.lhr.json.gz (render-blocking-resources: assets/index-q6VLNRSs.css, 290,7 kB) | la hoja global se sirve como bloqueante de la primera pintura en cada ruta | CSS por módulo o inline crítico; decidir en Fase C con las cifras de performance.md | frontend/src (styles) | L
```

## 7) Cómo repetir la medición (Fase C)

Comandos exactos (desde la raíz del repo, con el stack local corriendo; añade `npm ci --prefix frontend` si falta node_modules):

```sh
# 1) Stack local y env (URL de MISMO ORIGEN; requerido por LNA de Chrome 142+)
supabase start
# frontend/.env.local (gitignored; NO commitear):
#   VITE_SUPABASE_URL=http://127.0.0.1:5183
#   VITE_SUPABASE_ANON_KEY=<ANON_KEY de `supabase status -o env`>

# 2) Build de producción + manifest y gates
npm run lint --prefix frontend
npm run build --prefix frontend
npx vite build --manifest --prefix frontend   # regenera dist/.vite/manifest.json (sin cambios de config)
npm run size --prefix frontend
npm run test --prefix frontend

# 3) Servidor local (static + proxy) y medición
node docs/archive/audits/2026-10-13/frontend-ux/scripts/servidor-local-a3.mjs \
     --port 5183 --target http://127.0.0.1:54321 &
node docs/archive/audits/2026-10-13/frontend-ux/scripts/run-a3-baseline.mjs \
     --base http://127.0.0.1:5183 --runs 3 \
     --out docs/archive/audits/2026-10-13/frontend-ux/lighthouse/baseline
```

Opciones del medidor: `--devices mobile,desktop`, `--pages login,portada,administracion`, `--runs N`, `--skip-existing` (reanuda solo lo faltante), `--chrome <ruta>`, `--dry-run` (imprime los comandos de npx sin medir). Los LHR crudos quedan como `*.lhr.json.gz` (LHR íntegro sin las capturas embebidas; `gunzip` solo si se necesita) para respetar el techo de ~2 MB del directorio de resultados (actual: 1,35 MB); `resumen.json` y `chunks.json` son archivos planos.

## 8) Limitaciones

- **Lantern/simulación:** Lighthouse simula la red (mobile 1,6 Mbps / CPU 4×; desktop 10 Mbps) sobre el byte real del preview local; los números dependen de la máquina. Comparar siempre con las mismas versiones (LH 12.8.2, Chrome 155) y con la estación en reposo.
- **Servidor de medición:** `servidor-local-a3.mjs` sustituye a `vite preview` solo por la restricción LNA de Chrome 142+; los estáticos servidos y su gzip equivalen (boot set ≤ ±3 B; transferencia total −1,5% frente a la corrida de `performance.md`).
- **Transferido autenticado:** incluye respuestas REST del flujo de cada página; no es una cifra de solo activos.
- **First-navigation por ruta:** cálculo del manifest (cierre de imports estáticos − boot set), igual que en `performance.md`; no fue instrumentado en el navegador.
- El tablet se mide con los flags de `performance.md` (form-factor móvil + 768×1024@2x); allí midió 97 y aquí 98 — diferencias dentro de la variabilidad esperada entre corridas.
- Solo se usó Chromium (Chrome 155 headless); sin Firefox/Safari. No se ejecutó `npm run test:integration` (excluido por el enunciado de la tarea).
