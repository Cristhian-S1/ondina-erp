# D2 — Aplicación de la propuesta de color aprobada (Beads OND-c07.22, fase 2)

Fecha: 2026-10-14 · Base: `origin/feature/frontend-ux` (acda408) · Rama del worktree: `Cristhian-S1/d2-colores` · Decisión del responsable: **opciones recomendadas** de [`D1-propuesta.md`](D1-propuesta.md) (B, N1, A, Q1).

## Qué cambió

| Tema | Cambio |
|---|---|
| Escala `brand` | `index.css`: 50–500 monótona (#f0f8fe, #e0f1ff, #c4e4ff, #9ed1fa, #77b9ec, #56a0d7); **`brand-600` → #2c7bb1** (blanco 4,59:1); 700–900 sin cambios. |
| Nav activa N1 | `DashboardLayout.tsx`: `bg-brand-700 text-white shadow-[inset_4px_0_0_#fff]` (sólo clases de color; el logo/estructura quedan para L1). |
| Texto secundario | `text-slate-500` → `text-slate-600` en 51 líneas / 21 archivos (excepto icono decorativo de avatar en `Clientes` y la ✕ de `Dialog`); `text-slate-400` → `text-slate-600` en `Dashboard`. |
| Errores | `errorTextCls`, `errorBlockCls` y 7 `text-red-600` sueltos → `text-red-700`. |
| Estados | `amber-700` → `amber-800` (badges Devoluciones/Dashboard y textos de Despachos); puntos `amber-500`/`emerald-500` → `-600` (`Despachos`). |
| Quitar (Q1) | Nueva `btnDangerOutline` en `lib/ui.ts` (borde/texto `red-700`, fondo blanco, hover `red-50`, `min-h-11`), usada en `FilaProductoVenta` (Registrar venta) y `LineaDespacho` (Nuevo despacho). `btnDanger` sólido queda para acciones irreversibles. |
| Tarjeta de producción | `TablaProduccionResponsive`: nueva prop `cantidad`; en móvil, producto + cantidad en una fila y fecha/observaciones como metadato `slate-600` debajo. Escritorio (tabla) y paginación sin cambios. |
| Barrido | `InputNumerico.tsx`: ▴/▾ en **una fila** (`flex-row`) junto al input, 44×44 px cada una; API y comportamiento intactos. |
| Docs | `DESIGN.md` (valores definitivos, sin nota "pendiente"; nav, `btnDangerOutline`, estados) y `docs/engineering/frontend.md`. |

Commits: `028a308` (producción + InputNumerico), `a01e0de` (color, ui, nav, docs).

## Archivos

`frontend/src/index.css`, `lib/ui.ts`, `lib/ui.test.ts`, `components/{DashboardLayout,InputNumerico,SucursalSelector,ErrorBoundary,ProtectedRoute}.tsx`, `domains/bodega/{pages/{Despachos,Devoluciones,Stock},components/LineaDespacho}.tsx`, `domains/produccion/{components/{TablaProduccionResponsive,HistorialProduccion,ProduccionReciente,FiltrosProduccion,IndicadoresProduccion},pages/Produccion}.tsx`, `domains/ventas/{components/FilaProductoVenta,pages/{Clientes,Gastos,MiComision,RegistrarCliente,RegistrarVenta,Ventas}}.tsx`, `pages/{Dashboard,Login}.tsx`, `DESIGN.md`, `docs/engineering/frontend.md`. Evidencia: `D2-capturar.mjs`, `scripts/d2-lighthouse.mjs`, `D2-contrastes.txt`, `D2-color-contrast.txt`, `lighthouse-d2/`, `capturas/D2/`.

## Verificación

- **Cuatro verificaciones (en `frontend/`)**: `npm run lint` OK · `npm run build` OK · `npm run size` "Presupuesto OK" · `npm run test` **64 archivos / 768 pruebas** en verde (3 nuevas en `ui.test.ts`: `btnDangerOutline` 44 px, errores en `red-700`, borde/texto/fondo del outline). Ninguna prueba previa fijaba clases literales afectadas.
- **Contraste calculado** (`D1-generar.mjs` sobre el `index.css` aplicado → `D2-contrastes.txt`): escala monótona; primario 4,59; nav 5,20 (barra 8,85); `slate-600` 6,92/7,58; errores 5,86–6,42; badge ámbar 6,36; puntos 3,20/3,65 (≥3:1 no textual). Único par < umbral: borde `brand-200` del botón secundario (1,32:1, decorativo, sin cambio respecto de D1; el texto brand-800 mide 6,82).
- **Lighthouse 12.8.2, `color-contrast`** (`D2-color-contrast.txt`; servidor `servidor-local-a3.mjs`, build con Supabase local, 1 corrida por combinación): Login, Dashboard, Registrar venta, Despachos, Devoluciones, Stock y Producción (historial) a **412×915 y 1280×800: 14/14 con 0 elementos fallidos**, accesibilidad 100 (línea base Q1: 94–95).
- **Navegador real (Chrome headless/CDP, `D2-capturar.mjs`)**: 7 vistas × 412×915, 768×1024, 1280×800, antes y después (42 PNG + `medidas-*.json`). En las 21 combinaciones "después": `scrollWidth ≤ innerWidth` y **0 controles visibles < 44 px**. "Antes" capturado desde un worktree efímero de acda408.
- Revisión visual del riesgo de escala: avatar (brand-100 con texto brand-700, legible), hover/activo de Stock (`bg-brand-600` ahora más oscuro, el contenedor `brand-100` más claro: mayor separación), badges de rol y de Devoluciones (sin pérdida de legibilidad) y tarjeta de producción compacta.

## Límites

- Lighthouse mide la navegación a cada ruta: el **modal abierto de Despachos** y el **detalle de Devoluciones** sólo se verificaron por captura y por cálculo de contraste, no por auditoría automática.
- 1 corrida por combinación (suficiente para una auditoría determinista de contraste; no es una campaña de rendimiento — los puntajes de performance de `lighthouse-d2/` no son comparables con Q1).
- Estados `disabled` (opacity-60) fuera de AA por diseño. Foco/anillo (propuesta D1 `foco-outline`) no estaba en la decisión y no se tocó.
- El texto "Observaciones" de la tarjeta de producción conserva su etiqueta visible; sólo cambió su peso (metadato).
- No se ejecutó `npm run test:integration` (lo hace el coordinador).
