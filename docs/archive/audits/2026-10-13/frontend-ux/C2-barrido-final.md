# C2 — Barrido final UX/UI y responsividad (DESPUÉS) y estado de hallazgos

- **Fecha:** 2026-10-14 · **Base:** `origin/feature/frontend-ux` @ `15a6012` · **Modo:** solo lectura de `frontend/src`.
- **Método (igual que A2):** Vite dev local (`:5190`) contra Supabase local `127.0.0.1:54321`; Chrome 155 headless vía Playwright, zona `America/Santiago`, cuentas `ux-*@example.invalid` (vendedor, bodega, producción, admin sucursal A, admin global). Sesión iniciada por el formulario de `/login`. Para **21 rutas × 5 roles × 4 anchos (375/768/1024/1280) = 420 combinaciones**, con carga de documento, se midió `scrollWidth` vs `clientWidth`, controles interactivos visibles (a, button, input, select, textarea, summary, role=button/tab; fuera de `inert`) con ancho o alto < 44 px, y `console.error/warning` + `pageerror`. Además, 19 capturas temporales de estados (drawer, modales, listas) de las que se conservan 16 `capturas/c2-*.png` (< 300 KB c/u).
- **Verificación complementaria:** `npm run lint` exit 0; `npm run test` **691/691 pruebas, 52/52 archivos**. No se ejecutó `test:integration`; no se modificó código, SQL, `supabase/` ni `.opencode/`.
- **Hashes:** son los de la rama de integración (`git log origin/feature/frontend-ux`); algunos informes B*/FX* citan los hashes previos al cherry-pick.

## Resultado en una línea

**Overflow horizontal: 0/420. Controles < 44 px: 0/420. Errores/warnings de consola: 0/420.** Los 3 bloqueantes de layout de A2 (UX-01, UX-02, UX-03) están resueltos. Quedan 2 defectos nuevos P3 (N-01, N-02), 1 decisión de producto abierta (ventas de $0), y los diferidos conocidos (A1-08, R2-04, etc.).

## 1. Matriz ruta × rol × ancho (DESPUÉS) frente a A2

`OK` = sin overflow, sin controles < 44 px, sin errores de consola en esa celda. La columna "A2 (antes, 375)" lista los IDs de A2 que afectaban esa celda (los de copy/estado se resuelven fuera del layout: ver §2). "Residual" referencia defectos nuevos de §3.

| Ruta | Rol | A2 (antes, 375) | 375 | 768 | 1024 | 1280 | Residual |
|---|---|---|---|---|---|---|---|
| `/` | vendedor | UX-14 | OK | OK | OK | OK | — |
| `/` | bodega | UX-14 | OK | OK | OK | OK | — |
| `/` | producción | UX-14 | OK | OK | OK | OK | — |
| `/` | admin sucursal A | UX-14 | OK | OK | OK | OK | — |
| `/` | admin global | UX-14 | OK | OK | OK | OK | — |
| `/ventas` | vendedor | UX-16 | OK | OK | OK | OK | — |
| `/ventas` | admin sucursal A | UX-16 | OK | OK | OK | OK | — |
| `/ventas` | admin global | UX-16 | OK | OK | OK | OK | — |
| `/ventas/registrar` | vendedor | UX-04,05,06,20 | OK | OK | OK | OK | — |
| `/ventas/registrar` | admin sucursal A | UX-04,05,06,20 | OK | OK | OK | OK | — |
| `/ventas/registrar` | admin global | UX-04,05,06,20 | OK | OK | OK | OK | — |
| `/clientes` | vendedor | UX-11,21 | OK | OK | OK | OK | — |
| `/clientes` | admin sucursal A | UX-11,21 | OK | OK | OK | OK | — |
| `/clientes` | admin global | UX-11,21 | OK | OK | OK | OK | — |
| `/carga` | vendedor | UX-11 | OK | OK | OK | OK | — |
| `/carga` | admin sucursal A | UX-11 | OK | OK | OK | OK | — |
| `/carga` | admin global | UX-11 | OK | OK | OK | OK | — |
| `/gastos` | vendedor | UX-17 | OK | OK | OK | OK | — |
| `/gastos` | admin sucursal A | UX-17 | OK | OK | OK | OK | — |
| `/gastos` | admin global | UX-17 | OK | OK | OK | OK | — |
| `/mi-comision` | vendedor | UX-07,11 | OK | OK | OK | OK | — |
| `/ranking-vendedores` | vendedor | UX-08,11 | OK | OK | OK | OK | — |
| `/ranking-vendedores` | admin sucursal A | UX-08,11 | OK | OK | OK | OK | — |
| `/ranking-vendedores` | admin global | UX-08,11 | OK | OK | OK | OK | — |
| `/despachos` | bodega | UX-01,10,11 | OK | OK | OK | OK | — |
| `/despachos` | admin sucursal A | UX-01,10,11 | OK | OK | OK | OK | — |
| `/despachos` | admin global | UX-01,10,11 | OK | OK | OK | OK | — |
| `/devoluciones` | bodega | UX-09,10,11 | OK | OK | OK | OK | — |
| `/devoluciones` | admin sucursal A | UX-09,10,11 | OK | OK | OK | OK | — |
| `/devoluciones` | admin global | UX-09,10,11 | OK | OK | OK | OK | — |
| `/stock` | bodega | UX-11,19 | OK | OK | OK | OK | N-01 |
| `/stock` | admin sucursal A | UX-11,19 | OK | OK | OK | OK | N-01 |
| `/stock` | admin global | UX-11,19 | OK | OK | OK | OK | N-01 |
| `/produccion/registrar` | producción | UX-12,13 | OK | OK | OK | OK | — |
| `/produccion/registrar` | admin sucursal A | UX-12,13 | OK | OK | OK | OK | — |
| `/produccion/registrar` | admin global | UX-12,13 | OK | OK | OK | OK | — |
| `/produccion/envases` | producción | UX-13 | OK | OK | OK | OK | — |
| `/produccion/envases` | admin sucursal A | UX-13 | OK | OK | OK | OK | — |
| `/produccion/envases` | admin global | UX-13 | OK | OK | OK | OK | — |
| `/produccion/historial` | producción | UX-02,09,13 | OK | OK | OK | OK | N-02 |
| `/produccion/historial` | admin sucursal A | UX-02,09,13 | OK | OK | OK | OK | N-02 |
| `/produccion/historial` | admin global | UX-02,09,13 | OK | OK | OK | OK | N-02 |
| `/produccion/indicadores` | producción | UX-13 | OK | OK | OK | OK | — |
| `/produccion/indicadores` | admin sucursal A | UX-13 | OK | OK | OK | OK | — |
| `/produccion/indicadores` | admin global | UX-13 | OK | OK | OK | OK | — |
| `/produccion/incidencias` | producción | UX-02,12,13 | OK | OK | OK | OK | — |
| `/produccion/incidencias` | admin sucursal A | UX-02,12,13 | OK | OK | OK | OK | — |
| `/produccion/incidencias` | admin global | UX-02,12,13 | OK | OK | OK | OK | — |
| `/reportes` | admin sucursal A | UX-03 | OK | OK | OK | OK | — |
| `/reportes` | admin global | UX-03 | OK | OK | OK | OK | — |
| `/ubicaciones` | admin sucursal A | UX-03 | OK | OK | OK | OK | — |
| `/ubicaciones` | admin global | UX-03 | OK | OK | OK | OK | — |
| `/administracion` | admin sucursal A | UX-03 | OK | OK | OK | OK | — |
| `/administracion` | admin global | UX-03 | OK | OK | OK | OK | — |
| `/auditoria` | admin sucursal A | UX-03 | OK | OK | OK | OK | — |
| `/auditoria` | admin global | UX-03 | OK | OK | OK | OK | — |

Redirecciones (acceso no permitido, 4 anchos, sin cambios respecto de A1):

- vendedor: `/despachos`, `/devoluciones`, `/stock`, `/produccion/registrar`, `/produccion/envases`, `/produccion/historial`, `/produccion/indicadores`, `/produccion/incidencias`, `/reportes`, `/ubicaciones`, `/administracion`, `/auditoria`
- bodega: `/ventas`, `/ventas/registrar`, `/clientes`, `/carga`, `/gastos`, `/mi-comision`, `/ranking-vendedores`, `/produccion/registrar`, `/produccion/envases`, `/produccion/historial`, `/produccion/indicadores`, `/produccion/incidencias`, `/reportes`, `/ubicaciones`, `/administracion`, `/auditoria`
- producción: `/ventas`, `/ventas/registrar`, `/clientes`, `/carga`, `/gastos`, `/mi-comision`, `/ranking-vendedores`, `/despachos`, `/devoluciones`, `/stock`, `/reportes`, `/ubicaciones`, `/administracion`, `/auditoria`
- admin sucursal A: `/mi-comision`
- admin global: `/mi-comision`

Notas de método y límites:
- La BD local tiene datos de producción (≈ 200 registros de historial), ranking con 1 vendedor y despachos con "Vendedor no disponible"; **no hay clientes** para el vendedor ni carga con stock, por lo que `/clientes` con filas y el flujo de venta confirmada real no se ejercitaron (venta confirmada sólo por pruebas y por FX2 con RPC interceptada).
- Estados modal/drawer se midieron a 375 (`c2-drawer`, `c2-clientes-modal`, `c2-despachos-modal`): 375/375.
- Los `input type=date` mostraron `mm/dd/yyyy` en Chrome headless (idioma de la interfaz del navegador, no del código): no verificable aquí (ver UX-09).
- Sin lector de pantalla ni dispositivo físico; los ítems de accesibilidad se verifican por código/pruebas.

## 2. Estado de todos los hallazgos

Leyenda de verificación C2: **N** = reverificado en navegador en este barrido; **C** = reverificado leyendo el código actual; **P** = sólo entrega + pruebas verdes (691/691), no reproducido hoy. Estados: Resuelto / Parcial / Diferido / No resuelto.

### A1 (técnico)

| ID | Estado | Resuelto por / razón | Ver. |
|---|---|---|---|
| A1-01 | Resuelto | B1 `049e07f` (claves por ámbito, aislamiento de sucursal) | P |
| A1-02 | Parcial | B1 `049e07f` extrajo lectura y ámbito; `Despachos.tsx` 816 y `Devoluciones.tsx` 602 líneas siguen mezclando filtros/formulario (R1-12 diferido) | C |
| A1-03 | Resuelto | B3 `37be361` (suscripciones acotadas, debounce 250 ms) | P |
| A1-04 | Resuelto | B1 `049e07f` (UUID local por línea) | P |
| A1-05 | Resuelto | B2 `33feb29` (carga/error/vacío separados; refetch conserva datos con FX `b8f9ef3`) | N |
| A1-06 | Resuelto | B3 `0692928` (invalida `['mi-comision']`) | P |
| A1-07 | Resuelto | B2 `f234cdd` (consultas por sección) | P |
| A1-08 | **Diferido** | Sin paginación/rango en `bodega/api.ts` (no hay `limit`/`range`); decisión explícita de B1/FX; `staleTime` 30 s sólo reduce refetch. Riesgo al crecer el historial | C |
| A1-09 | Resuelto | B1 `049e07f`; Despachos 375/375 en 4 roles | N |
| A1-10 | Resuelto | B2 `33feb29`/`f234cdd`; Incidencias 375/375 | N |
| A1-11 | Resuelto | B5 `9de9617`,`9d46897` (drawer modal, inert, foco); drawer visible en `c2-drawer-vendedor-375` | N |
| A1-12 | Resuelto | B3 `e257840` (`CampoFormulario`, aria-invalid/describedby) | P |
| A1-13 | Resuelto | B4 `06327c4` (ranking), B3/B2 (`EstadoVista` + Reintentar en gastos/venta/producción) | P |
| A1-14 | Resuelto | B5 `9ea468c` (`thCls` slate-600, 7,24:1); R1-10 completa bodega con FX | C |
| A1-15 | Resuelto | B6 `8088820` (`strict: true` en tsconfig app y node) | C |
| A1-16 | Resuelto | B6 `c71097e`/`8088820` (presupuesto JS/CSS inicial incluye preload Supabase) | P |
| A1-17 | Resuelto | B3 `37be361` (admin: aviso de alcance; FX2 R4-05 deshabilita el formulario) | N |
| A1-18 | Resuelto | B1 `049e07f` (jornada reactiva) en bodega; el mismo patrón en Indicadores es R2-09 (diferido) | P |
| A1-19 | Resuelto | B5 `987aef7` (`role=alert`, `aria-describedby`) | P |

### A2 (UX/UI)

| ID | Estado | Resuelto por / razón | Ver. |
|---|---|---|---|
| UX-01 | Resuelto | B1 `049e07f`; `/despachos` 375/375 (antes 382) | N |
| UX-02 | Resuelto | B2 `33feb29`/`f234cdd` (tablas → tarjetas <640); 375/375. Ver N-02 por longitud | N |
| UX-03 | Resuelto | B5 `9de9617` ("Próximamente" + badge en menú); `c2-reportes-admin-375` | N |
| UX-04 | Resuelto | B3 `37be361`; registrar venta 375 ≈ 2.067 px (antes 2.863) con barra fija de total/Confirmar | N |
| UX-05 | Resuelto | B3 `0692928`,`37be361` (resumen persistente, sin redirección) | P |
| UX-06 | Resuelto | B3 `37be361` (banners + Confirmar bloqueado) | P |
| UX-07 | Resuelto | B4 `06327c4` | N |
| UX-08 | Resuelto | B4 `06327c4` (mes Santiago, selects nativos, truncado) — `c2-ranking-vendedor-375` | N |
| UX-09 | Resuelto (con límite) | B5 `c285e2d` + B1/B2/B4 usan `fmtFecha*`; `toLocaleString` sólo queda en `lib/ui.ts:37` y `lib/format.ts`. Los `input type=date` dependen del idioma del navegador: no verificable en headless | C |
| UX-10 | Resuelto (parcial de datos) | B1 `049e07f` ("Vendedor no disponible" + id corto); en `/stock` quedan 2 "Desconocido" (N-01); causa de nombres: R1-14/R4-08 | N |
| UX-11 | Resuelto | B5 `987aef7` (`EstadoVista`) adoptado en B1–B4 | C |
| UX-12 | Resuelto | B2 `f234cdd` (Toast en mutaciones) | P |
| UX-13 | Resuelto | B2 `f234cdd` (título "Producción · Historial", chips de sección) — visible en captura | N |
| UX-14 | Resuelto | B5 `9de9617` (campana retirada, rol/sucursal en drawer, `document.title` por ruta) | N |
| UX-15 | Resuelto | B4 `9ee9b08` (copy por rol) | P |
| UX-16 | Resuelto | B4 `9ee9b08`, B3 `37be361` | P |
| UX-17 | Resuelto | B3 `e257840` (tipo vacío, `$`, miles); FX2 R4-14 centra el `$` | N |
| UX-18 | Resuelto | B5 `987aef7` (inputs 44 px, mostrar contraseña) | P |
| UX-19 | Resuelto | B1 `2ea23ae` (exportación oculta, Actualizar secundario) | P |
| UX-20 | Resuelto | B3 `37be361`, B5 `987aef7`; 0 controles < 44 px en 420 celdas | N |
| UX-21 | Resuelto | B3 `e257840` (`type=tel`, `inputMode`) | C |

### R1 (revisión B1)

| ID | Estado | Resuelto por / razón | Ver. |
|---|---|---|---|
| R1-01 | Resuelto | FX `8ffe5f0` (alert dentro del Dialog); FX2 `f391419` añade foco/asociación | P |
| R1-02 | Resuelto | FX `8ffe5f0` (refetch fallido conserva datos) | P |
| R1-03 | Resuelto | FX `8ffe5f0`; etiquetas Vendedor/Producto/Cantidad/Bandejas visibles en `c2-despachos-modal-bodega-375` | N |
| R1-04 | Resuelto | FX `8ffe5f0` (`staleTime` 30 s). La lectura de 11 consultas sin límite persiste → A1-08 | P |
| R1-05 | Parcial | FX: selector bloqueado durante la RPC; sin persistencia de clave tras recarga/cambio de sucursal posterior a respuesta desconocida | P |
| R1-06 | Resuelto | FX (selector deshabilitado en vuelo) | P |
| R1-07 | Resuelto | FX (sólo admin consulta sucursales) | P |
| R1-08 | Resuelto | FX (copy "las devoluciones") | P |
| R1-09 | Resuelto | FX (`EstadoVista` en Suspense) | P |
| R1-10 | Resuelto | FX (slate-600/amber-700/emerald-700) | P |
| R1-11 | Resuelto | FX (`aria-expanded`/`aria-controls`) | P |
| R1-12 | **Diferido** | Refactor de modal/filtros no obligatorio; `Despachos.tsx` 816 líneas | C |
| R1-13 | Resuelto | FX (tarjetas <640 px en detalle de devoluciones) | N (`c2-devoluciones-bodega-768`) |
| R1-14 | **Diferido** | Observación de datos: `vendedores_sucursal` sólo devuelve activos y bodega no lee otros perfiles bajo RLS; requiere backend (FX2/R4-08). Sigue "Vendedor no disponible" en datos locales | N |

### R2 (revisión B2)

| ID | Estado | Resuelto por / razón | Ver. |
|---|---|---|---|
| R2-01 | Resuelto | FX `b8f9ef3` (refetch conserva contenido, `aria-busy`) | P |
| R2-02 | Resuelto | FX `b8f9ef3` (límites Santiago → UTC, incl. DST) | P |
| R2-03 | Resuelto | FX `b8f9ef3` (errores persistentes junto al campo); FX2 `f391419` enfoca y no duplica | P |
| R2-04 | **Diferido** | `registrarProduccion` sigue siendo `insert` directo sin clave de idempotencia (`produccion/api.ts:146`); requiere RPC/backend, fuera del alcance frontend | C |
| R2-05 | Resuelto | FX `b8f9ef3` (roles de tabla explícitos) | P |
| R2-06 | Resuelto | FX `b8f9ef3` | P |
| R2-07 | Resuelto | FX `b8f9ef3` (selector bloqueado en escritura) | P |
| R2-08 | **No resuelto** (diferido) | `versionDatos` sigue como prop muerta en clave de consulta (`IndicadoresProduccion.tsx:17,28`; `HistorialProduccion.tsx:14`) | C |
| R2-09 | **No resuelto** (diferido) | La clave de Indicadores sigue sin la jornada; pestaña abierta a medianoche conserva "hoy" | C |
| R2-10 | Resuelto | FX `b8f9ef3` ("Nombre no disponible") | P |
| R2-11 | **No resuelto** (no reproducido) | `void supabase.removeChannel` persiste (`produccion/api.ts:178`) | C |
| R2-12 | Parcial | Nombre "Actualizar lista"; posición sin mover | N |
| R2-13 | **Diferido** | Refactor común de formularios no abordado | C |

### R3 (revisión B5/B4/B7)

| ID | Estado | Resuelto por / razón | Ver. |
|---|---|---|---|
| R3-01 | Resuelto | FX2 `474f91d`: éxito invalida `['ventas','ranking']` (`useRegistrarVenta.ts:51`) | C |
| R3-02 | Resuelto | FX3 `b24e882` (sucursal del drawer por ámbito) | P |
| R3-03 | Resuelto | FX3 `b24e882` (fecha civil sin desplazar) | P |
| R3-04 | Resuelto | FX3 `b24e882` (años 2020…actual; ver en `c2-ranking`); piso 2020 es constante, no política | N |
| R3-05 | Resuelto | FX3 `b24e882` (`aria-label` en Cerrar sesión colapsado) | P |

### R4 (revisión B3/FX)

| ID | Estado | Resuelto por / razón | Ver. |
|---|---|---|---|
| R4-01 | Resuelto | FX2 `474f91d` (cliente controlado) | P |
| R4-02 | **Parcial / decisión de producto** | Ventas de $0 siguen permitidas por contrato de BD (`precio_unitario >= 0`); la UI exige confirmar "por $0". Pendiente: confirmar si la gratuidad es válida (FX2) | P |
| R4-03 | Resuelto | FX2 `474f91d` | P |
| R4-04 | Resuelto | FX2 `474f91d` (foco en h1, `role=status`) | P |
| R4-05 | Resuelto | FX2 `474f91d` (`fieldset disabled`); `c2-registrar-venta-admin-375` | N |
| R4-06 | Resuelto | FX2 `474f91d` | P |
| R4-07 | Resuelto | FX2 `f391419` | P |
| R4-08 | Parcial | Foco/scroll al detalle resuelto; nombres históricos = límite de RLS (R1-14) | P |
| R4-09 | Resuelto | FX2 `f391419` | P |
| R4-10 | Resuelto | FX2 `f391419` | P |
| R4-11 | Resuelto | FX2 `f391419` | P |
| R4-12 | Parcial | Roles de tabla; etiqueta sigue siendo "Cantidad de <producto>" y envuelve en 2 líneas a 375 (`FilaProductoVenta.tsx:41`; `c2-registrar-venta-vendedor-375`) | N |
| R4-13 | Parcial | Total de la tarjeta oculto <640 px; folio sigue siendo UUID completo (decisión: copia íntegra) | C |
| R4-14 | Resuelto | FX2 `474f91d` | P |

**Totales:** A1 17 resueltos / 1 parcial (A1-02) / 1 diferido (A1-08); UX 21/21 resueltos (UX-09 y UX-10 con límites); R1 11 resueltos / 1 parcial (R1-05) / 2 diferidos (R1-12, R1-14); R2 7 resueltos / 1 parcial (R2-12) / 5 diferidos o no resueltos (R2-04, 08, 09, 11, 13); R3 5/5; R4 10 resueltos / 4 parciales (R4-02, 08, 12, 13).

## 3. Defectos nuevos

| ID | Sev. | Dónde | Evidencia | Problema | Propuesta |
|---|---|---|---|---|---|
| N-01 | P3 | `/stock` · bodega, admin | `domains/bodega/pages/Stock.tsx:198,225` (`?? 'Desconocido'`) | Mismo copy opaco que UX-10 corrigió en Despachos/Devoluciones; quedó en Stock | "Producto no disponible"/"Envase no disponible" (coherente con "Nombre no disponible") |
| N-02 | P3 | `/produccion/historial` · producción, admin · 375 | `c2-produccion-historial-produccion-375.png`: documento de **6.074 px** con 200 registros como tarjetas de 5 líneas; 0 overflow | Sin paginación/"ver más"; el límite de 200 es silencioso salvo el texto "Máximo 200 registros". En móvil la lista es muy larga y cuesta llegar al pie | Paginar/"Cargar más" o compactar la tarjeta (fecha+producto en una fila); relacionado con A1-08 |

No se encontraron regresiones de layout, overflow, controles táctiles ni errores de consola.

## 4. Pendientes que requieren decisión externa

1. **Ventas de $0** (R4-02): decidir si la gratuidad es válida y si exige justificación (backend + frontend).
2. **Nombres de vendedores históricos en bodega** (R1-14/R4-08): requiere cambio de RPC/RLS.
3. **Idempotencia de registrar producción** (R2-04): RPC con clave de reintento.
4. **Paginación de historiales** (A1-08, N-02).
5. Verificación con lector de pantalla, dispositivo físico, `input date` en navegador es-CL y producción/preview con CSP: fuera del alcance de este barrido.

## Capturas

`capturas/c2-*.png` (16): inicio-vendedor-375, drawer-vendedor-375, registrar-venta-vendedor-375/1280, ranking-vendedor-375, mi-comision-vendedor-375, clientes-modal-vendedor-375, despachos-modal-bodega-375, devoluciones-bodega-768, stock-bodega-375, produccion-historial/incidencias/indicadores-produccion-375, produccion-registrar-admin-global-1024, reportes-admin-375, registrar-venta-admin-375.
