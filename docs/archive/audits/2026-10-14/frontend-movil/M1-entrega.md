# M1 — Tarjetas móviles en Registrar venta y Producción (OND-c07.20, parte 1)

## Qué cambió
- **Registrar venta**: cada línea de producto es una tarjeta (borde, fondo, sombra, separación) bajo 1024 px, con encabezado `Línea N` + nombre del producto, Disponible, Cantidad/Precio en rejilla de 2 columnas desde 640 px (1 columna en teléfono para que el control con flechas no se rompa), Subtotal destacado y `Quitar` a todo el ancho (44 px). Desde 1024 px se conserva la tabla. El umbral de la tabla pasó de 640 a 1024 px porque en 768 px el selector de producto aparecía truncado (`Bidón P…`). Un único árbol RHF (CSS single-view), sin duplicar inputs.
- **Producción**: `TablaProduccionResponsive` pasa a tarjetas por registro en móvil (insignia con fecha/hora, producto como título, etiqueta/valor para el resto). Aplica a Producción reciente, Historial, Totales por producto (Indicadores) y Mermas recientes. Las Incidencias recientes (lista) también son tarjetas con insignia de fecha. En ≥ 640 px se mantiene la tabla/lista. Las columnas aceptan `destacada` e `insignia`; las listas siguen recibiendo los registros por props (listas para que el worker de paginación pase una página).
- No se tocaron colores/tokens globales ni `lib/ui.ts`. Texto secundario ≥ slate-600.

## Archivos
`ventas/components/FilaProductoVenta.tsx`, `ventas/pages/RegistrarVenta.tsx`, `produccion/components/{TablaProduccionResponsive,ProduccionReciente,HistorialProduccion,IndicadoresProduccion}.tsx`, `produccion/pages/Produccion.tsx`, pruebas `RegistrarVenta.test.tsx` y `ProduccionReciente.test.tsx`.

## Pruebas y verificaciones (en `frontend/`)
`npm run lint`, `npm run build`, `npm run size`, `npm run test` (55 archivos, 725 pruebas) en verde. Nuevas: una tarjeta por línea con encabezado y `Quitar`, sin controles duplicados; una tarjeta por registro en Producción reciente con `formatMiles`.

## Evidencia
Capturas en `capturas/M1/<vista>-<ancho>x<alto>-{antes,despues}.png` (Registrar venta con 3 productos; Producción registrar/historial/indicadores/incidencias) en 412×915, 375×812, 768×1024, 1024×1366 y 1280×800. Medidas en `capturas/M1/medidas-{antes,despues}.json`: `scrollWidth <= innerWidth` en los 25 casos y 0 controles interactivos < 44 px.

## Límites
- Capturas de listas largas (Historial, hasta 200 registros) recortadas a 6000 px de alto.
- No hay descuento por línea: el descuento es global (paso "3 · Pago"), no aparece en la tarjeta.
- Las flechas de `InputNumerico` (componente compartido, fuera de alcance) se apilan en 2 filas.
- Paginación no implementada (otro worker).
