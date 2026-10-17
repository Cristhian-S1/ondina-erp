# R1 — Revisión cruzada del lote B1 (Bodega)

Revisor: Sonnet 5.5 · Alcance: commits `049e07f` y `2ea23ae` (`frontend/src/domains/bodega/**`) · Fecha: 2026-10-13 · Sólo lectura de código; sin cambios en la app.

Método: lectura completa de `AmbitoBodega`, `useDatosBodega`, `useJornadaSantiago`, `Despachos`, `Devoluciones` y el diff de `Stock`; contraste con A1-01/02/04/09/18, UX-01/10/19 y `b1-entrega.md`; app levantada (`vite dev`, Supabase local) y recorrida con Chrome headless (CDP) con `ux-bodega`, `ux-admin` y `ux-admin-global` en `/despachos`, `/devoluciones`, `/stock` a 375/768/1280. No se ejecutaron pruebas de integración ni se escribieron datos (sí se abrió el modal y se pulsó "Registrar despacho" vacío, que sólo valida en cliente).

## Veredicto: **aprobar con cambios**

La carrera de sucursal (A1-01), las keys (A1-04) y la jornada reactiva (A1-18) están bien resueltas y cubiertas. No hay regresión en RPC, claves de reintento dentro de una misma montura ni política de devoluciones. Queda un defecto funcional visible (R1-01: errores de validación invisibles tras el modal) y un riesgo de pérdida de pantalla en refetch fallido (R1-02) que conviene corregir antes de integrar a `develop`.

## Hallazgos

| ID | Sev. | Evidencia | Problema | Corrección propuesta |
| --- | --- | --- | --- | --- |
| R1-01 | **P1** | `Despachos.tsx:319-321` (alert) frente a `:604-775` (Dialog); captura `capturas/r1-despachos-modal-global-375.png` | `error` se pinta fuera del `<Dialog>`. Con el modal abierto (`showModal`) el `role="alert"` queda tapado/inerte: en los tres roles, al pulsar "Registrar despacho" sin datos, `elementFromPoint` sobre el alert devuelve el `dialog` y la captura no muestra mensaje. "Stock insuficiente…", errores de la RPC y validaciones quedan sin feedback visible. Existía antes (A2 no lo capturó) pero B1 declara "errores de mutación anunciados con alert" y no lo cubre. | Renderizar `error` dentro del `Dialog` (cerca de los botones) con `role="alert"` y limpiar al abrir/cerrar; conservar el de página sólo para errores fuera del modal. Prueba: validación fallida con el modal abierto muestra el alert dentro de `dialog`. |
| R1-02 | P2 | `Despachos.tsx:292-293`, `Devoluciones.tsx:249-250`; `useDatosBodega.ts:15` (`retry:false`) | `datos.isError` reemplaza toda la página aunque ya haya datos. Un refetch fallido (foco de ventana sin red, o el `await load()` tras un despacho/devolución ya registrado) sustituye la vista por "No fue posible cargar", cierra visualmente el modal y oculta que la operación sí se guardó. | Condicionar a `isError && !datos.data` y, con datos previos, mostrar un aviso inline con Reintentar manteniendo la vista; opcional `retry: 1`. Prueba: refetch con error conserva lista y borrador. |
| R1-03 | P2 | `Despachos.tsx:654-709` (`<span className="sr-only">Producto/Cantidad</span>`, `placeholder=""`); captura modal | En el modal las líneas muestran sólo un select y una caja vacía sin etiqueta visible; en la captura el campo de cantidad es indistinguible (también "Bandejas", `:734-747`). Accesible por lector, no por usuario vidente. | Etiqueta visible ("Cantidad", "Bandejas") o `placeholder` descriptivo; alinear con `labelCls`. |
| R1-04 | P2 | `useDatosBodega.ts:12-40`; `Despachos.tsx:80`, `Devoluciones.tsx:46` | Un único `queryFn` encadena 11 lecturas sin límite (A1-08 diferido) con `staleTime` por defecto 0: cada foco de ventana o remontaje por cambio de sucursal rehace todas. Con `Fragment key` en `AmbitoBodega.tsx:34` cada cambio A→B→A remonta y vuelve a pedir. | `staleTime` (p. ej. 30 s) y `refetchOnWindowFocus` acotado; separar catálogos (`obtenerProductos`, `obtenerTiposEmpaque`) en queries propias cacheables. |
| R1-05 | P3 | `Despachos.tsx:96,189-192`, `Devoluciones.tsx:62,229-232`; remonte en `AmbitoBodega.tsx:34` | La clave de idempotencia vive en `useRef` del subárbol que se remonta al cambiar de sucursal/identidad. Si un envío quedó con respuesta desconocida, volver a la sucursal y reenviar el mismo contenido genera clave nueva (posible duplicado si el primero sí se aplicó). Es un caso estrecho; dentro de la misma montura el reintento es correcto. | Mantener `intento` en un store por `identidad:sucursalId` (p. ej. `useRef` en `AmbitoBodega` o Map a nivel de módulo) o bloquear el selector mientras `enviando`. Sin cambios en `api.ts`. |
| R1-06 | P3 | `Despachos.tsx:192-206` | Si la sucursal cambia con la RPC en vuelo, el subárbol se desmonta y el resultado (éxito o error) no se muestra en ninguna parte. | Deshabilitar el selector de sucursal mientras hay un envío o notificar vía Toast global. |
| R1-07 | P3 | `AmbitoBodega.tsx:13-20`, `:21` | Los usuarios con `sucursal_id` asignado (bodega) esperan y dependen de la consulta de sucursales aunque no la usan; un fallo de `obtenerSucursales` bloquea `/despachos` y `/devoluciones` a un rol que no necesita el catálogo. | Habilitar la query sólo para `administrador` y usar `perfil.sucursal_id` directo para el resto. |
| R1-08 | P3 | `Devoluciones.tsx:249` | Copy con error de concordancia: "No fue posible cargar los devoluciones". | "las devoluciones". |
| R1-09 | P3 | `bodega/index.tsx:32-34` | Los fallbacks de Suspense siguen siendo `<p role="status">Cargando página...</p>`; B1 adoptó `EstadoVista` en las páginas pero no aquí (sí B4 lo hizo en ventas). | `EstadoVista variante="cargando"` en los tres fallbacks para coherencia con B5. |
| R1-10 | P3 | `Despachos.tsx:327`, `:429`, `:517,533,752` (`text-slate-400`, `text-amber-600`), `:424` (`bg-emerald-600` + blanco `text-xs`) | Contraste por debajo de AA 4,5:1 para texto pequeño (slate-400 ≈2,5:1, amber-600 ≈3,2:1, blanco sobre emerald-600 ≈3,8:1). B5 corrigió `thCls` pero no estos usos en bodega. | `text-slate-600`, `text-amber-700`, `bg-emerald-700`. |
| R1-11 | P3 | `Despachos.tsx:405-409` | El botón que expande un despacho no expone `aria-expanded` ni `aria-controls`; el estado sólo se transmite por el glifo `▼` oculto. | `aria-expanded={expandido}` y `aria-controls` al panel. |
| R1-12 | P3 | `Despachos.tsx` (778 líneas), `Devoluciones.tsx` (587); `:179-183` vs `:254-260` en Devoluciones; filtros de día en `Despachos.tsx:238-250` y `Devoluciones.tsx:70-82` | A1-02 pedía extraer también filtros y formulario; sólo se extrajeron lectura y ámbito. Persisten filtro de día, lógica de estado/corrección y `OPCIONES_DIA` duplicados y dos copias del cálculo `esCorreccion`. | Extraer `FiltroDiaVendedor` y un helper `estadoDespacho/esCorreccion`; el modal en `NuevoDespachoDialog`. |
| R1-13 | P3 | `Devoluciones.tsx:407,481` (regiones con `overflow-x-auto`); captura `capturas/r1-devoluciones-global-375.png` | A 375 el detalle usa tabla con scroll interno (documento sin desbordar, 375/375). Cumple A1-09 pero no la convención tabla→tarjetas <640 px de `docs/engineering/frontend.md`. Aceptable como decisión, a documentar. | Documentar la excepción o pasar a tarjetas con `<dl>` en móvil. |
| R1-14 | P3 (observación) | `useDatosBodega.ts:34`; captura `capturas/r1-despachos-global-375.png` | En datos locales los 10 despachos de Sucursal A aparecen con "Vendedor no disponible" (`nombres.get(...)` sin coincidencia). El fallback de UX-10 es correcto, pero ocultaría un desajuste real entre `obtenerVendedores(sucursalId)` y `despachos.vendedor_id` (p. ej. vendedores inactivos o de otra sucursal). No se pudo discriminar con los datos sintéticos. | Verificar con datos reales; si son vendedores inactivos, incluirlos en la lectura o distinguir "Vendedor inactivo". |

## Comprobaciones que pasan

- **A1-01 carrera**: la clave de consulta incluye identidad, rol, sucursal asignada y seleccionada, y el subárbol se remonta (`AmbitoBodega.tsx:34`); una respuesta tardía de B no puede escribir sobre A. Borrador, selección y filtros se descartan al cambiar de contexto. `Despachos.test.tsx`/`Devoluciones.test.tsx` cubren A→B→A con éxito y error.
- **A1-04 keys**: `LineaProducto.id` con `crypto.randomUUID()` (`Despachos.tsx:38-40,650`); el `id` local no entra en el payload (`:179-182`).
- **A1-18 jornada**: `useSyncExternalStore` con reloj de 1 s, `focus` y `visibilitychange`; el snapshot es un string estable, sin re-render espurio (`useJornadaSantiago.ts:52-69`); filtros derivados en render, sin efecto.
- **RPC y política**: `api.ts` intacto; claves de idempotencia por contenido (`:188-191`, `Devoluciones.tsx:229-232`) incluyen tipo de operación y sucursal; permisos de admin/bodega sin cambios.
- **UX-10/UX-19**: fallback de vendedor, `fmtFechaHora`/`fmtFecha` de `lib/format`, exportación pendiente oculta y Actualizar en `btnSecondary` (`Stock.tsx`).
- **Responsive**: `scrollWidth <= innerWidth` en las 27 combinaciones (los 15 px de diferencia a 768/1280 son la barra de scroll de la ventana headless, no desbordamiento). Selector de sucursal visible con etiqueta para administrador; `role="status"` en vacíos y `alert`/Reintentar en errores de lectura.
- **Tamaño de pruebas**: 37 casos en las tres suites de páginas y `useJornadaSantiago.test.tsx` para tiempo.

## Capturas

- [Modal con error invisible, global 375](capturas/r1-despachos-modal-global-375.png)
- [Despachos, global 375](capturas/r1-despachos-global-375.png)
- [Devoluciones, global 375](capturas/r1-devoluciones-global-375.png)

## Límites

- No se reprodujo una carrera A→B→A en navegador (cubierta por pruebas; el entorno local no permite retrasar respuestas sin interceptar red).
- Sin datos locales para operaciones de escritura exitosas ni para ver Devoluciones con un despacho seleccionado.
- `npm run size` y `test:integration` fuera de alcance.
