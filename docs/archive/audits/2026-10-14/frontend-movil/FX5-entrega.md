# FX5 — Corrección de la revisión cruzada R5 (Bodega y Producción)

Fecha: 2026-10-15 · Rama: `Cristhian-S1/r6-revision` (rebaseada sobre `origin/feature/frontend-ux` b06ac64). Continúa el avance parcial de Codex (WIP c8e7520), verificado y reorganizado en commits coherentes.

## Qué cambió

| ID | Cambio |
|---|---|
| R5-01 | Se elimina el listener Realtime de `stock_bodega` (tabla no publicada). El stock de bodega para mermas se invalida ante `producciones` y `mermas` (eventos publicados) y tras las mutaciones propias; `staleTime: 30_000`, con relectura al foco/actualización manual. `usePaginaBodega.actualizar` invalida también la lectura de stock de Producción. Corregida la afirmación errónea en `C3C-entrega.md`. |
| R5-02 | El canal Realtime usa una secuencia local en lugar de `crypto.randomUUID()` (no disponible en HTTP por IP de LAN). |
| R5-03 | `useJornadaSantiago`/`inicioPeriodo` viven en `frontend/src/lib/jornada.ts` (con prueba). Producción ya no reexporta `bodega/api`: `obtenerStockBodega` es una lectura propia en `produccion/api.ts` con tipo `StockBodegaProduccion`. |
| R5-04 | Devolución sin unidades devueltas muestra «Sin devolución» en lugar de «Devuelto 0». |
| R5-05 | Identificadores etiquetados: «Vendedor no disponible · ref. 56d3d7aa», «Despacho #3c90…»; guarda sobre `vendedor_id?.slice`. |
| R5-07 | `TablaProduccionResponsive` deriva fila/columna de cada celda según el orden de columnas (sin posición fija 3) y muestra rótulos visibles en vista compacta. |
| R5-08 | Pestañas de Incidencias: `rounded-lg` y `bg-brand-700` activo (DESIGN.md). |
| R5-06 | Pruebas de clases/estructura para los arreglos de layout (`LayoutBodega.test.tsx`, `TablaProduccionResponsive.test.tsx`, `FiltrosProduccion.test.tsx`, `TabsIncidencias.test.tsx`). |

## Commits

- `fix(bodega): mover jornada a lib y etiquetar identificadores y devoluciones (R5-03, R5-04, R5-05, R5-06)`
- `fix(produccion): retirar Realtime de stock_bodega, canal sin randomUUID y lectura propia de stock (R5-01, R5-02, R5-03)`
- `fix(produccion): derivar posición de columnas, rótulos compactos y pestañas según DESIGN.md (R5-06, R5-07, R5-08)`
- `docs(movil): FX5 entrega y capturas`

## Pruebas

- R5-01: `api.realtime.test.ts`, `useDatosProduccion.test.tsx` (invalidación ante `producciones`/`mermas`, sin suscripción a `stock_bodega`), `api.test.ts` (lectura propia).
- R5-02: `api.realtime.test.ts` (canal sin `crypto.randomUUID`, tópicos simultáneos distintos).
- R5-04/R5-05: `Devoluciones.test.tsx`, `usePaginaBodega.test.tsx`.
- R5-03: `lib/jornada.test.tsx`.

Verificaciones en `frontend/` (2026-10-15): `npm run lint` OK · `npm run build` OK · `npm run size` OK (JS inicial 149,3 kB gzip; CSS +9,8 %, dentro del presupuesto) · `npm run test` OK (799 pruebas, 0 fallos).

## Evidencia visual

Capturas en `capturas/FX5/` (6 archivos, todos < 80 KB). Entorno: Supabase local, cuentas `ux-*`.

| Vista | 412×915 | 1024×1366 |
|---|---|---|
| Devoluciones | `devoluciones-412x915-{antes,despues}.png` — «Sin devolución» y etiqueta «Vendedor no disponible · ref.» | `devoluciones-1024x1366-despues.png` |
| Incidencias | `incidencias-412x915-{antes,despues}.png` — pestañas `rounded-lg`/brand-700, error de stock | `incidencias-1024x1366-despues.png` |

## Límites

- No se tocó SQL ni la publicación `supabase_realtime`: un despacho de otra sesión no emite evento para el stock de mermas; la lectura se renueva por foco, actualización manual o `staleTime` (30 s).
- La verificación en los demás viewports (375, 768, 1280) se apoya en pruebas de estructura; no hay capturas adicionales por el máximo de 6.
- `npm run test:integration` no se ejecutó (lo hace el coordinador).
