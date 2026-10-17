# C3-D — Iconos del menú de ventas y Paginacion sin botones vacíos

- **Fecha:** 2026-10-15 · **Base:** `2cded7f` (origin/feature/frontend-ux) · **Defectos:** C3-10, C3-11 (P3).

## Qué cambió

- **C3-10:** `TrophyIcon` (Ranking vendedores) y `PercentIcon` (Mi comisión) en `icons.tsx`, SVG inline con el mismo trazo (`stroke 2`, `aria-hidden`). Registrar venta conserva el carrito y Gastos el `$`; sin dependencias nuevas.
- **C3-11:** `Paginacion` no muestra Anterior/Siguiente con 0 o 1 página; el texto `aria-live` queda como "N registros" (sin "Página 1 de 1"). Con más de una página no cambia (botones ≥ 44 px, `btnSecondary`).

## Archivos

- `frontend/src/components/icons.tsx`, `icons.test.tsx` (nuevo), `Paginacion.tsx`, `Paginacion.test.tsx`
- `frontend/src/domains/ventas/index.tsx` (sólo iconos del menú)
- Fuera de la propiedad indicada, por depender del comportamiento antiguo: `ventas/pages/PaginacionVentas.test.tsx` y `produccion/pages/Produccion.branch.test.tsx` (aserciones de "botones deshabilitados en vacío" → "sin botones").
- `C3D-capturar.mjs` y `capturas/C3D/`.

## Pruebas

`lint`, `build`, `size` (presupuesto OK) y `test` (65 archivos, 774 pruebas) en verde. Nuevas: Paginacion con 0, 1 y varias páginas; iconos con `aria-hidden` y formas distintas. `test:integration` no ejecutado.

## Evidencia (`capturas/C3D/<vista>-<WxH>-{antes,despues}.webp`, ≤ 26 KB; medidas en `medidas-*.json`)

| Vista | Viewport | Antes → después |
|---|---|---|
| Menú móvil (drawer) | 375×812 y 412×915 | iconos de Ranking y Comisión distintos (trofeo, %); sin overflow, 0 controles < 44 px |
| Gastos vacío | 412×915 | 2 botones de paginación → 0; sin overflow, 0 controles < 44 px |
| Clientes vacío | 412×915 | 2 botones de paginación → 0; sin overflow, 0 controles < 44 px |

## Límites

- Capturas de viewport (no de página completa): en Clientes el bloque de paginación queda bajo el pliegue, por lo que la imagen antes/después es casi idéntica; la diferencia (2 → 0 botones) está en `medidas-*.json` y en las pruebas.
- Sólo se midieron 375/412 (menú) y 412 (vistas vacías), como pidió el lote; sin dispositivo físico.
