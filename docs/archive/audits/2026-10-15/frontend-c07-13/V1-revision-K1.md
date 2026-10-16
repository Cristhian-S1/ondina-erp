# V1 · Revisión cruzada de K1 (Bodega R1-12 y R2-13) — 2026-10-15

Alcance: commits `16a2bd3`, `ac666f0`, `d61800e`, `e50c0c8` del worktree `k1-bodega` (revisión de sólo lectura; el código se ejecutó con `vite --port 5191` desde ese worktree). Cuentas: `ux-bodega@` y `ux-admin-global@example.invalid`, Supabase local. Escrituras de negocio: ninguna (las peticiones no-GET a `/rest/v1/` se abortaron en el navegador; 0 interceptadas).

## Veredicto: **APROBAR** (sin P1/P2; 3 hallazgos P3 opcionales)

## 1. R1-12 sin cambio de comportamiento
Método: comparación de `Despachos.tsx` en `69070fc` con `pages/Despachos.tsx` + los cinco componentes nuevos; extracción de todos los literales de texto, `id`, `aria-*`, `role`, `htmlFor` de ambos lados y diferencia de conjuntos.
- Textos, roles y ARIA: el conjunto «sólo en el antiguo» se reduce a imports y a las dos expresiones de id de línea (reescritas con `primeraLinea`, mismo resultado). No desaparece ningún texto de usuario.
- Ids de control conservados: `despacho-vendedor`, `despacho-producto-<id>`, `despacho-cantidad-<id>`, `despacho-bandejas`, `limite-productos-despacho`, `despacho-<id>` (aria-controls).
- Foco: foco inicial en Vendedor (medido: `despacho-vendedor` en los 8 casos), primer error enfocado (medido), Escape devuelve el foco a «Nuevo despacho» (medido).
- Estados de carga/error, paginación de servidor (`usePaginaBodega` + `Paginacion` con `etiqueta`), ámbito por sucursal (`AmbitoBodega`, `setOcupado`) y firma de hooks: sin cambios; `useDatosBodega`/`usePaginaBodega` fuera del diff.
- Un único árbol DOM (lista responsive única), sin duplicar controles.

## 2. R2-13 y extensión de `CampoFormulario`
- Modal de despacho, `LineaDespacho` y Devoluciones usan `CampoFormulario` con `<label htmlFor>`, `aria-invalid`, `aria-describedby` al error y mensaje bajo el campo. `InputNumerico` no recibe `error` (no hay mensaje duplicado: `dupMsgs=false`, un `<p>` por error).
- Extensión `id`/`descripcionId`/`alerta` (`CampoFormulario.tsx:12-30`): retrocompatible. Sin props se obtiene el mismo `useId`, clases y `aria-describedby` (`undefined` o `errorId`); `role` queda `undefined`. Los llamadores de Ventas/Producción no pasan las props nuevas y no se tocan; K1 reportó 383/383 en esos dominios y yo comprobé que mi rama K2 (Producción) sólo usa `{etiqueta,error,children}`.
- Documentación: se pidió y se hizo, una viñeta en `docs/engineering/frontend.md:74`. Cubre las tres props.
- `CampoFormulario.test.tsx` (nuevo) cubre id externo, descripción adicional y `alerta`.

## 3. Barrido en navegador (412×915, 768×1024, 1024×1366, 1280×800)
| Comprobación | bodega | admin global |
|---|---|---|
| `scrollWidth ≤ innerWidth` (lista, detalle, modal con cada error, devoluciones) | sí, 4/4 | sí, 4/4 |
| Controles < 44 px (input/select/button/a) | 0 | 0 |
| Foco al primer error al enviar (vendedor, producto, cantidad, bandejas) | sí | sí |
| Nombre accesible = label visible | sí | sí |
| `aria-describedby` → mensaje existente, único | sí | sí |

Árbol accesible de campos en error (medido, idéntico en los 4 anchos): Vendedor → «Selecciona un vendedor y agrega al menos un producto.»; Cantidad (vivo) → «Excede el stock en bodega: disponibles 100.»; Cantidad (envío) → «Stock insuficiente en bodega para Bidón 10L: disponible 100, solicitado 9.999.999.»; Bandejas → «Excede el stock de bandejas: disponibles 98.» / «Stock insuficiente de envases…». Devoluciones: «Cantidad a devolver» (aria-label «…de Bidón POL») descrito por la ayuda + «No puedes devolver más de 4…»; envases: label «Buenos»/«Malos», descritos por la advertencia de exceso (`aria-invalid=false`, permitido por diseño).
Capturas (8) en `capturas/V1/`.

## Hallazgos
**V1-01 · P3 · Mensaje genérico bajo Producto.** Al enviar con vendedor elegido y producto vacío, el campo Producto muestra «Selecciona un vendedor y agrega al menos un producto.» (`ModalNuevoDespacho.tsx`, `registrarDespacho`, rama `!vendedorId || lineasValidas.length === 0`). Es el texto original, pero ahora queda asociado a un campo concreto y menciona al vendedor. Corrección: mensajes por campo («Selecciona un producto», «Ingresa una cantidad») conservando el original sólo para el caso sin líneas.

**V1-02 · P3 · Orden de la descripción en cantidad de devolución.** `descripcionId` antecede al error: el lector anuncia primero la ayuda larga («La devolución de cada producto tiene como límite…») y luego el error (`Devoluciones.tsx:460-461`, `CampoFormulario.tsx`). Corrección: invertir el orden (error primero) cuando hay error, o acortar la ayuda.

**V1-03 · P3 · El borrador del modal se pierde si la página cae al estado de error/carga completo.** `Despachos.tsx` retorna antes de renderizar `ModalNuevoDespacho` cuando `datos.isError && !datos.data` o `isPending`; antes el estado vivía en el mismo componente (hooks por encima del `return`) y se conservaba. Sólo ocurre sin datos previos; riesgo bajo. Corrección: mantener el modal montado o subir el borrador.

## Observaciones (no atribuibles a K1)
- En mis recargas completas el menú lateral móvil (`DashboardLayout`) apareció abierto y capturó los clics a 412–1024 px hasta cerrarlo; `DashboardLayout.tsx` no está en el diff de K1, así que no se evalúa aquí (conviene un chequeo aparte).
- Los errores en vivo (exceso de stock) no usan `role="alert"` (sólo los de envío, vía `alerta`); es coherente con el comportamiento previo.

## Límites
Comparación textual por conjuntos (no un diff semántico completo); no se ejecutó la suite de K1 (la reportó 810/810). No se confirmó ningún despacho ni devolución.
