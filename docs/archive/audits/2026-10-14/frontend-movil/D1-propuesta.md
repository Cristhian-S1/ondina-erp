# D1 — Propuesta de contraste y escala de color (Beads OND-c07.22, fase 1)

Fecha: 2026-10-14 · Base: `origin/feature/frontend-ux` (4809b1a) · Estado: **propuesta pendiente de aprobación visual**. No se modificó `index.css`, `lib/ui.ts` ni componentes.

- Página visual: [`D1-propuesta-colores.html`](D1-propuesta-colores.html) (autocontenida, sin dependencias, legible en móvil).
- Capturas: `capturas/D1/propuesta-colores-412x8740.png` y `capturas/D1/propuesta-colores-1280x4822.png` (sin desborde horizontal: scrollWidth = innerWidth en ambos).
- Datos completos (27 combinaciones): [`D1-contrastes.json`](D1-contrastes.json).

## Método de verificación (reproducible)

```bash
node docs/archive/audits/2026-10-14/frontend-movil/D1-generar.mjs   # recalcula contrastes y regenera HTML + JSON
node docs/archive/audits/2026-10-14/frontend-movil/D1-capturar.mjs  # capturas con Chrome headless (CDP)
```

`D1-colores-lib.mjs` lee los tokens oklch de `frontend/node_modules/tailwindcss/theme.css` y los hex de `index.css`, convierte a sRGB y aplica la fórmula WCAG 2.x: `(L1+0,05)/(L2+0,05)`, con `L` = luminancia relativa. Umbrales: 4,5:1 texto normal; 3:1 elementos no textuales.

## Hallazgos verificados (difieren levemente del brief)

| Combinación | Brief | Medido | Estado |
|---|---|---|---|
| Blanco sobre `brand-600` #3284bd | 4,06 | **4,06** | falla AA |
| `slate-500` sobre `slate-100` | 4,34 | **4,35** | falla |
| `red-600` sobre `red-50` | 4,41 | **4,36** | falla |
| `slate-400` sobre blanco | 2,56 | **2,63** | falla |
| Blanco sobre `emerald-500` / `amber-500` | 2,54 / 2,15 | **2,47 / 2,13** | falla, pero **no es texto** |

Las diferencias (≤0,08) vienen de que el brief usó hex de Tailwind v3; v4 define neutros/estados en oklch. Además: los badges de devoluciones **no** usan blanco sobre 500, sino `amber-700/amber-100` (4,52) y `emerald-700/emerald-100` (4,72), que pasan; el blanco sobre 500 sólo aparece como punto de estado de 8 px en `Despachos.tsx:625` (no textual, exige 3:1: falla con 2,13 / 2,47).
Otros hallazgos: `errorTextCls` (red-600) pasa sobre blanco (4,77) pero **falla sobre el fondo de página** (4,35); `slate-400` se usa como texto sólo en `pages/Dashboard.tsx` (4 líneas).

## Tabla de cambios

| Token / clase | Actual | Propuesto | Antes → Después | Dónde (usos, vía grep) |
|---|---|---|---|---|
| `--color-brand-50` | #cbebfc | #f0f8fe | hover secundario 5,47 → 6,35 | `bg-brand-50`: 9 líneas / 9 archivos |
| `--color-brand-100` | #a4dbf9 | #e0f1ff | — | `bg-brand-100`: 3 |
| `--color-brand-200` | #bfdcf8 | #c4e4ff | — | `border-brand-200`: 5 (btnSecondary) |
| `--color-brand-300` | #89c3eb | #9ed1fa | — | sin usos |
| `--color-brand-400` | #56c4ec | #77b9ec | — | sin usos |
| `--color-brand-500` | #749ccc | #56a0d7 | — | sin usos |
| **Opción B:** `--color-brand-600` | #3284bd | #2c7bb1 | 4,06 → 4,59 | `bg-brand-600`: 9 líneas / 8 archivos (btnPrimary, nav activa, píldoras); foco `ring/border-brand-600` |
| **Opción A:** primario → `bg-brand-700 hover:bg-brand-800` | brand-600 | brand-700 | 4,06 → 5,20 | `btnPrimary` (24 usos / 10 archivos) + 8 usos sueltos de `bg-brand-600` |
| Nav activa | `bg-brand-600` | `bg-brand-700` + barra blanca 4 px (N1) o relleno blanco/texto brand-900 (N2) | 4,06 → 5,20 (N2: 8,85) | `DashboardLayout.tsx:190` |
| Texto secundario | `text-slate-500` | `text-slate-600` | 4,35 → 6,92 (sobre slate-100) | 76 líneas / 23 archivos |
| Texto Dashboard | `text-slate-400` | `text-slate-600` | 2,63 → 7,58 | `pages/Dashboard.tsx` 53, 59, 67, 75 |
| `errorBlockCls` y 8 `text-red-600` sueltos | red-600 | red-700 | 4,36 → 5,87 | `lib/ui.ts:30` (3 usos) + Gastos, Devoluciones, Despachos, SucursalSelector, FiltrosProduccion, FilaProductoVenta |
| `errorTextCls` | red-600 | red-700 | 4,35 → 5,86 (sobre página) | `lib/ui.ts:27` (10 usos) |
| Badge bodega / productos | amber-700 | amber-800 | 4,52 → 6,36 | `Devoluciones.tsx:25`, `Dashboard.tsx:8` |
| Puntos de estado | amber-500 / emerald-500 | amber-600 / emerald-600 | 2,13 → 3,20 / 2,47 → 3,65 | `Despachos.tsx:625` |
| "Quitar" en tarjetas móviles | `btnDanger` sólido | outline `border-red-700 text-red-700 bg-white` (Q1, recomendada) o tonal `bg-red-50 text-red-700 border-red-200` (Q2) | 4,77 → 6,42 / 5,87 (el sólido ya pasaba: el cambio es de peso visual) | `FilaProductoVenta.tsx:52`, `Despachos.tsx:729` |
| Tarjeta de producción | una celda por fila | producto + cantidad en una fila, fecha/observaciones como metadato (`text-slate-600`) | — | `TablaProduccionResponsive.tsx` |

Sin cambio (ya cumplen): botón secundario brand-800/blanco 6,82; badges emerald-700/100 4,72 y sky-700/100 5,09; enlace brand-700 sobre blanco 5,20 y sobre slate-100 4,75; `thCls` slate-600.

## Opciones con decisión estética real

1. **Primario.** A = `brand-700` existente (token ya aprobado; 9 usos a editar; hover `brand-800`). B = oscurecer `brand-600` a #2c7bb1 (1 línea en `index.css`, 0 clases; diferencia reposo/hover pequeña, ΔL 0,03). **Recomendación: B.**
2. **Nav activa.** N1 = `brand-700` + barra blanca (conserva el look de sidebar azul). N2 = pastilla blanca con texto `brand-900` (más contraste, cambio visual mayor). Sin indicador, `brand-700` sobre el sidebar mide 1,70:1. **Recomendación: N1.**
3. **slate-500.** A = reemplazar clases (76 líneas, explícito); B = redefinir `--color-slate-500` en `@theme` (1 línea, cambia semántica de un token Tailwind). **Recomendación: A.**
4. **Quitar.** Q1 outline vs Q2 tonal. **Recomendación: Q1** (más liviana al repetirse; Q2 se confunde con un aviso).

## Diff exacto previsto

`frontend/src/index.css` (Opción B):

```diff
-  --color-brand-50: #cbebfc;
-  --color-brand-100: #a4dbf9;
-  --color-brand-200: #bfdcf8;
-  --color-brand-300: #89c3eb;
-  --color-brand-400: #56c4ec;
-  --color-brand-500: #749ccc;
-  --color-brand-600: #3284bd;
+  --color-brand-50: #f0f8fe;
+  --color-brand-100: #e0f1ff;
+  --color-brand-200: #c4e4ff;
+  --color-brand-300: #9ed1fa;
+  --color-brand-400: #77b9ec;
+  --color-brand-500: #56a0d7;
+  --color-brand-600: #2c7bb1;
```

`frontend/src/lib/ui.ts`:

```diff
-export const errorTextCls = 'mt-1 block text-xs text-red-600'
+export const errorTextCls = 'mt-1 block text-xs text-red-700'
-export const errorBlockCls = 'rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600'
+export const errorBlockCls = 'rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700'
```

Con la Opción A se añade en `btnPrimary`: `bg-brand-600`→`bg-brand-700` y `hover:bg-brand-700`→`hover:bg-brand-800`.

Clases en componentes: `text-slate-500`→`text-slate-600` (76 líneas, 23 archivos); `text-slate-400`→`text-slate-600` (Dashboard, 4); `text-red-600`→`text-red-700` (8 líneas sueltas); `text-amber-700`→`text-amber-800` en el badge de Devoluciones/Dashboard; `bg-amber-500`/`bg-emerald-500`→`-600` (Despachos:625); nav activa en `DashboardLayout.tsx:190`; botón "Quitar" por una variante `btnDangerOutline` nueva en `lib/ui.ts`.

## Riesgos

- Cambiar tokens `brand-50…500` altera tonos en 9+3+5 usos; revisar visualmente avatares, hover de Stock y badges.
- Opción B reduce la separación reposo/hover del primario; verificar con teclado y táctil.
- Los tests que afirman clases literales (p. ej. `text-slate-500`, `btnDanger`) deberán actualizarse; ejecutar `npm run test`.
- `slate-600` en 76 líneas puede reducir la jerarquía entre texto principal (slate-900) y secundario; se mitiga con tamaño/peso.
- Solo se midieron pares estáticos; estados `disabled` (opacity-60) quedan fuera de AA por diseño.

## Cómo se verificará (fase 2)

1. Recalcular con `D1-generar.mjs` sobre el `index.css` aplicado (debe mostrar 0 fallos AA salvo disabled).
2. Lighthouse (categoría Accesibilidad, auditoría `color-contrast`) en Login, Dashboard, Ventas, RegistrarVenta, Stock, Despachos, Devoluciones y Producción a 412 px y 1280 px; objetivo: 0 elementos fallidos.
3. `npm run lint`, `npm run build`, `npm run test`, `npm run size`.
4. Capturas antes/después por vista y viewport (412, 375, 768, 1024, 1280).

## Cambios textuales en `DESIGN.md` (sin valores de color)

Erratas ("Uso típico", "Cada rol tiene"); campana y `fmtFecha` marcados como retirados/obsoletos; Mantine ya no existe; `slate-400` ya no se recomienda para texto (usar `slate-600`); documentados `EstadoVista`, `InputNumerico`, `CampoFormulario`, tarjetas móviles (un árbol RHF), paginación (remite a `docs/engineering/frontend.md`); sección de colores con nota "propuesta pendiente de aprobación (D1)".
