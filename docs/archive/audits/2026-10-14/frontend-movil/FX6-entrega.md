# FX6 · Corrección de R6 (Registrar venta)

Fecha: 2026-10-15. Base: `origin/feature/frontend-ux` (`10473e5`). Corrige R6-01, R6-02 y R6-03 (los tres P3 de C3-A). Solo cambian `RegistrarVenta.tsx`, `FilaProductoVenta.tsx` y `RegistrarVenta.test.tsx`; `ResumenFormularioVenta.tsx` no requirió cambios.

## Qué cambió

| Hallazgo | Cambio |
| --- | --- |
| R6-01 · cantidad recortada a 375 px | Cantidad y Precio comparten fila solo desde 400 px (antes 360); por debajo se apilan a todo el ancho. A 375 px el input pasa de `clientWidth` 75 / `scrollWidth` 88 a 201 / 201: `9.999.999` cabe junto a las flechas de 44 px. |
| R6-02 · desfase de 20 px | Entre 400 y 639 px las etiquetas de Cantidad y Precio tienen altura fija de dos líneas (`h-10`, `line-clamp-2`). A 412 px los inputs quedan en y=710 / 710 (antes 690 / 710). No se tocó `CampoFormulario`. |
| R6-03 · barra cubre Quitar | El formulario añade `scroll-mb-28` a los `button` (además de `input`/`select`) bajo `sm`. Con tres líneas y Tab desde Cliente, ningún control del formulario queda bajo la barra (antes Quitar: bottom 859 > barra 846). |

Un único `useForm`/`useFieldArray` y una fila por `field.id`; sin duplicación de inputs.

## Pruebas

`RegistrarVenta.test.tsx`: umbral 400 px en las dos celdas, `scroll-mb-28` en botones y altura común de etiquetas. Son aserciones estructurales: jsdom no calcula geometría, por eso la geometría se midió en Chrome real (abajo).

En `frontend/`: `npm run lint` PASS; `npm run build` PASS; `npm run size` PASS (JS inicial gzip 149,351 KB / 164,284); `npm run test` PASS, 786/786 en 66 archivos. No se ejecutó `test:integration`.

## Evidencia en navegador (Chrome, Supabase local, `ux-vendedor`, sin escrituras)

| Viewport | Cantidad `1.234.567` (cw/sw) | Y Cantidad / Precio | Cubierto por la barra | Overflow |
| --- | --- | --- | --- | --- |
| 375×812 | 75/88 → **201/201** | apilados (690 / 790) | Quitar cubierto → **ninguno** | 375 ≤ 375 |
| 412×915 | 98/98 | 690/710 → **710/710** | Quitar cubierto 13 px → **ninguno** | 412 ≤ 412 |
| 1024×1366 | 226/226 | 630/630 (sin cambio) | ninguno | 1024 ≤ 1024 |

Capturas en `capturas/FX6/` (6, máx. 57,6 KB): `venta-linea-375x812-*`, `venta-linea-412x915-*`, `venta-foco-412x915-*` (antes/después). 1024×1366 no cambia y se documenta solo con medidas por el límite de seis capturas.

## Límites

Chrome headless con emulación de viewport, sin teclado virtual ni lector de pantalla. La barra mide ~70 px; `scroll-mb-28` (112 px) deja margen incluso con área segura. No se comprobó Shift+Tab hacia el encabezado fijo superior.
