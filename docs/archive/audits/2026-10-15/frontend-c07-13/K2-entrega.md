# K2 · Producción R2-13 — entrega (2026-10-15)

## Qué cambió
Los tres formularios de Producción (registrar producción, incidencia, merma) reemplazan el patrón propio `accesibilidad()`/`errorCampo()` por `components/CampoFormulario.tsx`:

- Label estable con `htmlFor` ↔ `id` del control (generado por `useId`).
- `aria-invalid` y `aria-describedby` hacia un único mensaje persistente bajo el campo; nunca toast.
- Cantidad (`InputNumerico`): recibe `id`/`aria-describedby` de `CampoFormulario` y su propio `error` (`errorEnvases ?? error de envío`, o `errorStockMerma ?? error de envío` en merma); `CampoFormulario` no recibe `error` en ese caso, por lo que el mensaje aparece una sola vez. En merma, `aria-describedby` apunta a «Disponible: N» y `InputNumerico` añade el id del error.
- Foco al primer error: ahora se localiza con `[data-campo="…"]` en lugar de `#campo-…`.
- Se conservan: validación en vivo contra stock de bodega y contra envases vacíos, pestañas Incidencias/Mermas en móvil y todos los textos.
- `components/CampoFormulario.tsx` no se tocó.

## Archivos
- `frontend/src/domains/produccion/pages/Produccion.tsx`
- `frontend/src/domains/produccion/pages/Produccion.branch.test.tsx`
- `frontend/src/domains/produccion/C3C.visual.mjs` (selectores `#campo-merma-*` → `[data-campo]`)

## Pruebas
- Nuevas (DOM, por formulario y campo): vínculo label/control, `aria-invalid`, `aria-describedby` → mensaje, un único mensaje; y cantidad de merma enlazada a error + «Disponible».
- Ajustadas: el mensaje de campo ya no tiene `role="alert"` (el patrón compartido no lo define); las pruebas verifican `aria-invalid`/descripción accesible. Los `alert` de Toast y de `EstadoVista` no cambian.
- `npm run lint`, `npm run build`, `npm run size` (CSS 8.405 B, sin cambio), `npm run test` (69 archivos / 806 pruebas) y la suite sin `.env.local` (806): en verde. No se ejecutó `test:integration`.

## Evidencia visual (Chrome headless, `ux-produccion@example.invalid`)
Capturas en `capturas/K2/formularios-<ancho>x<alto>-{antes,despues}.png`: cada una apila los tres formularios con un error visible (producto sin elegir, descripción vacía, cantidad de merma que excede el stock). «Antes» = commit 69070fc.

| Viewport | scrollWidth ≤ innerWidth | Controles < 44 px (antes / después) |
|---|---|---|
| 412×915 | sí / sí | 0 / 0 |
| 768×1024 | sí / sí | 0 / 0 |
| 1024×1366 | sí / sí | 0 / 0 |
| 1280×800 | sí / sí | 0 / 0 |

Medido sobre inputs, selects, textareas y botones de los formularios en registrar, incidencia y merma (incluidas las flechas ±).

## Límites
- Se entregan 8 capturas (3 formularios apilados por viewport/estado) por el tope de 12 archivos.
- Los mensajes de error de campo ya no se anuncian como `role="alert"`; el foco se mueve al campo y el mensaje se lee vía `aria-describedby`. Si se quiere `alert`, requiere un cambio aditivo en `CampoFormulario` (compartido).
- La sutil diferencia visual es que ahora el `select` también muestra borde rojo en error.
