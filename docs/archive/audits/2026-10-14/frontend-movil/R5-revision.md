# R5 · Revisión cruzada de C3-B (Bodega) y C3-C (Producción)

Fecha: 2026-10-15. Revisor: Sonnet 5.5, sobre el código de `Cristhian-S1/r5-revision` (HEAD `96b6a1c`). Solo lectura del código de la app. Commits revisados: `83e47a7`, `2c66fe5` (C3-B) y `b5a2913`, `4569ab3` (C3-C).

## Método

- Lectura de los diffs completos, de `C3B-entrega.md`, `C3C-entrega.md` y `DESIGN.md`.
- Navegador real (Chrome, Playwright) contra Supabase local con Vite en el puerto 5191. Cuentas `ux-bodega` y `ux-produccion`, a 412×915, 768×1024, 1024×1366 y 1280×800.
- Se midieron controles <44 px, desbordamiento horizontal, recorte de `9.999.999`, semántica de pestañas y teclado.
- **0 escrituras REST y 0 errores de consola/página.** No se reinició la BD ni se crearon datos.
- No se ejecutó `test:integration`, ni se tocó SQL, `supabase/` o `.opencode/`.

### Lo que se verificó correcto

- Cantidad `9.999.999`: `scrollWidth` 110 = `clientWidth` 110 px, sin recorte en los 4 viewports.
- Cero controles <44 px en Despachos, Devoluciones, Producción, Historial, Indicadores y Mermas, y cero desbordamiento horizontal.
- Un único árbol RHF: ni `LineaDespacho` ni `TabsIncidencias` duplican registros. Los dos formularios siguen montados y el panel inactivo solo lleva `hidden`.
- Pestañas: `tablist`/`tab`/`tabpanel`, `aria-selected`, flecha derecha mueve el foco y la selección, y solo hay pestañas bajo 640 px.
- Merma: `aria-invalid="true"` y `aria-describedby="disponible-merma campo-merma-cantidad-error"`; el error y el saldo quedan asociados.
- Colores: solo `brand`, `slate`, `amber-800` y `red-700`, todos aprobados en DESIGN.md.
- Claves de React Query con identidad/sucursal; `versionDatos` eliminado.

## Hallazgos

| ID | Sev. | Evidencia | Problema | Corrección propuesta |
| --- | --- | --- | --- | --- |
| R5-01 | P2 | `produccion/api.ts:175`; `supabase/migrations/20261013000100_align_repo_design.sql:300`; `supabase/tests/004_b4_performance_realtime.test.sql:10` | El canal escucha `stock_bodega`, pero esa tabla **no está en la publicación `supabase_realtime`** (solo `producciones`, `mermas`, `stock_envases`, `incidencias_produccion`; una prueba pgTAP fija esa lista exacta). El evento nunca llega, y C3C-entrega.md afirma que el stock se refresca "con Realtime de `stock_bodega`". El saldo mostrado solo se actualiza por foco, botón manual o escrituras propias; un despacho de otra sesión no lo cambia. | Quitar el listener muerto y corregir la afirmación del informe; el saldo se apoya en `refetchOnWindowFocus`. Si se quiere tiempo real, decisión backend aparte (migración + prueba pgTAP). |
| R5-02 | P3 | `produccion/api.ts:172` | `crypto.randomUUID()` está indefinido en contextos no seguros (HTTP por IP de LAN, p. ej. probar en un celular/tablet con `--host`). Se ejecuta dentro de un `useEffect`, así que lanzaría durante el montaje y activaría el ErrorBoundary de todo Producción. Los otros usos del repo están en manejadores de eventos. No verificado en navegador (localhost es contexto seguro). | Usar un contador de módulo o `Math.random().toString(36)` para el sufijo del tópico. |
| R5-03 | P3 | `produccion/components/IndicadoresProduccion.tsx:12`; `produccion/api.ts:167` | Acoplamiento entre dominios: Producción importa `useJornadaSantiago`/`inicioPeriodo` desde `bodega/hooks` y reexporta `obtenerStockBodega` de `bodega/api`. AGENTS.md pide mantener la lógica dentro de su dominio. El `import` queda además separado del bloque de imports. | Mover `useJornadaSantiago`/`inicioPeriodo` a `src/lib` y consumirlos desde ambos dominios. |
| R5-04 | P3 | `bodega/pages/Devoluciones.tsx:470` (captura `capturas/R5/bodega-devolucion-412x915.png`) | Un producto de una sección "Ya devueltos" sin devolución real muestra `Devuelto 0` junto a `Devuelto 2` (visible en la captura: "Hielo CUBO · Devuelto 0"). Resulta confuso; antes era `−0`. | Mostrar "Sin devolución" o "—" cuando la cantidad devuelta es 0. |
| R5-05 | P3 | `bodega/pages/Despachos.tsx:454`; `bodega/hooks/usePaginaBodega.ts:59` | El fallback visible `Vendedor no disponible (#56d3d7aa)` convive en la misma fila con el `#3c902333` del despacho (ver captura de Devoluciones): dos identificadores con `#` sin etiqueta, ambiguos para el usuario. Además, la nueva `usePaginaBodega.ts:59` hace `d.vendedor_id.slice` sin guarda. | Etiquetar: `Vendedor no disponible · ref. 56d3d7aa`, y proteger con `?.`/`?? ''` aunque el tipo sea `string`. |
| R5-06 | P3 | `bodega/components/LineaDespacho.tsx:40/65`; `bodega/components/SeccionDevolucion.tsx:39`; `produccion/components/TablaProduccionResponsive.tsx:35`; `produccion/components/FiltrosProduccion.tsx:17` | Los arreglos de layout (recorte de cantidad, encabezado envuelto, tarjetas compactas, filtros en dos columnas) **no tienen aserción en la suite de vitest**; jsdom no calcula layout. La única guarda son `c3b.visual.mjs` y `C3C.visual.mjs`, que no corren en `npm run test` y dependen de rutas locales (`/home/cristhian/.cache/...`) y de un ID de fixture fijo. La prueba de Despachos solo comprueba la subcadena `inactive`. | Aceptable para este lote; documentar los `.mjs` como verificación manual y, si se quiere regresión automática, añadir una prueba de clase CSS mínima o Playwright en CI. Considerar mover los `.mjs` fuera de `src/`. |
| R5-07 | P3 | `produccion/components/TablaProduccionResponsive.tsx:36`; `:47` | `resumenNumerico` codifica `index === 1 ? 'col-start-1' : 'col-start-2'`: solo es correcto para tablas de 3 columnas. En modo compacto, los rótulos de columna van `sr-only` y además `aria-hidden`, de modo que el usuario visual pierde "Fecha"/"Observaciones" y el lector depende de la cabecera de tabla. | Derivar la posición de la columna de su orden, o validar con una aserción de 3 columnas; revisar con producto si "Observaciones" sin rótulo es aceptable. |
| R5-08 | P3 | `produccion/components/TabsIncidencias.tsx:25` | Las pestañas usan `rounded-xl` y `bg-brand-800`; DESIGN.md §3 pide `rounded-lg` para pills de tabs y §4.2 usa `brand-700` para el estado activo. Es un desvío menor (colores sí aprobados). | Alinear con `rounded-lg`, o actualizar DESIGN.md con el patrón. |

Sin hallazgos P0 ni P1.

## Capturas (4)

- `capturas/R5/bodega-despacho-412x915.png`: modal con `9.999.999`, error de stock y flechas de 44 px.
- `capturas/R5/bodega-devolucion-412x915.png`: detalle de devolución con `Devuelto N`, `Devuelto 0` (R5-04) y fallback de vendedor (R5-05).
- `capturas/R5/produccion-merma-412x915.png`: merma con error asociado y `Disponible: 100`.
- `capturas/R5/produccion-indicadores-412x915.png`: KPI en dos columnas y tarjeta compacta por producto.

## Veredicto por lote

| Lote | Veredicto | Condición |
| --- | --- | --- |
| C3-B · Bodega | **Aprobar** | R5-04 y R5-05 son pulidos opcionales; ninguno bloquea. |
| C3-C · Producción | **Aprobar con cambios** | Resolver R5-01 (listener muerto y afirmación incorrecta del informe) y, preferentemente, R5-02/R5-03. |

## Límites

Chrome headless con emulación de viewport; sin dispositivo físico ni lector de pantalla. Los datos locales hacen que casi todos los despachos aparezcan con vendedor no disponible, por lo que el caso con nombre real solo se confirmó por pruebas. No se probaron escrituras. R5-02 es una inferencia desde el código, no reproducida.
