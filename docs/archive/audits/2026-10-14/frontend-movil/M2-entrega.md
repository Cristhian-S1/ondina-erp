# M2 — Bodega móvil y barrido del resto (OND-c07.20 parte 2 y OND-c07.13 / #86)

## Qué cambió
- **Nuevo despacho** (`Despachos.tsx`): una tarjeta por línea (`LineaDespacho`, nuevo en `bodega/components/`): insignia `Línea N` + nombre del producto, selector de Producto, "En bodega" / "Carga del vendedor" a la izquierda y Cantidad a la derecha, `Quitar` de 44 px en el encabezado. Contador "N líneas", bandejas en panel propio y botones apilados en teléfono. Mismo lenguaje que Registrar venta (M1); `Quitar` va en el encabezado (outline rojo) y no a todo el ancho para no triplicar la altura. Estado `lineas` y ids/aria sin cambios (un único árbol).
- **Devoluciones** (`Devoluciones.tsx` + `SeccionDevolucion`): las dos tablas pasan a secciones con borde y encabezado de color propio (ámbar + icono paquete = Productos; verde + icono reciclaje = Envases), conteo de líneas y "Ya devueltos". Cada producto es una fila compacta: nombre + "Despachado · Disponible · Carga" a la izquierda, input acotado (`w-36`/`w-44`) a la derecha. Envases: nombre + datos y dos inputs Buenos/Malos en 2 columnas. Los cambios de layout usan *container queries* (`@lg`), porque en escritorio la columna de detalle es angosta aunque la ventana sea ancha. Bajo 32 rem se ocultan las flechas de `InputNumerico` (CSS; teclado numérico y ↑/↓ siguen), que duplicaban el alto de la fila.
- **Stock**: tablas → tarjetas compactas bajo 640 px (mismo DOM, CSS), pestañas a todo el ancho, categoría/tipo legibles ("Uso interno").
- **Mi comisión**: KPI principal a todo el ancho + 2 columnas; detalle por tipo en 2×2. **Carga**: tarjeta compacta (nombre+tipo / unidades en una fila; ~75 px en vez de ~118). **Ranking**: selector Mes/Año más ancho para el mes, texto secundario slate-600.
- No se tocaron tokens/paleta, paginación ni `ventas/api.ts`/hooks.

## N-01 (Stock "Desconocido") — causa y corrección
Causa: `Stock` leía `obtenerTiposEmpaque()` que filtra `activo = true`; un tipo desactivado conserva existencias en `stock_envases` y no se resolvía (RLS sí permite leerlo). Reproducido en local desactivando temporalmente "Caja Interna Sintética" (se restauró). Para productos ya se usaba `obtenerProductos(true)`.
Cambio mínimo: `lib/catalog.ts::obtenerTiposEmpaque(incluirInactivos = false)` (los formularios siguen usando sólo activos) y Stock pasa `true`; copy de respaldo "Producto/Envase no disponible". `bodega/api.ts` sin cambios.

## Tabla de ítems #86
| ID | Estado | Detalle |
|---|---|---|
| N-01 | **Resuelto** | Ver sección anterior; prueba `Stock.test.tsx`. |
| N-02 (Historial producción 200 tarjetas) | Pendiente | Fuera de mi propiedad (`produccion/`); paginación la cubre otro worker (P1). |
| R1-12 (Despachos 816 líneas, modal mezclado) | **Resuelto parcial** | Líneas del modal extraídas a `LineaDespacho`; la página sigue ~780 líneas (filtros/lista/detalle). |
| R1-14 (vendedores históricos "no disponible") | Pendiente | Límite de RLS/RPC; requiere backend (fuera de alcance). |
| R2-08 (`versionDatos` prop muerta) | Pendiente | `produccion/**` no es de M2; sin tocar. |
| R2-09 (Indicadores sin jornada en la clave) | Pendiente | Idem. |
| R2-11 (`void removeChannel`) | Pendiente | Idem (`produccion/api.ts`). |
| R2-13 (refactor común de formularios) | Pendiente | Sin abordar; no es maquetación. |
| R4-12 (etiqueta "Cantidad de…" envuelve a 375) | Fuera de M2 | Registrar venta (M1). |
| Ranking / Mi comisión / Carga / Stock | **Resuelto** | Capturas 5 viewports; sin overflow ni controles < 44 px. |
| Clientes, Gastos | Hallazgos anotados | Sin cambios (otro worker los pagina). Medidos: 0 overflow, 0 < 44 px. Gastos mide 19.000 px de alto con la lista completa (sin paginar): lo cubre su worker. Clientes sin filas en la BD local, sin evidencia de tarjetas. |

## Archivos
`bodega/components/{LineaDespacho,SeccionDevolucion}.tsx`, `bodega/pages/{Despachos,Devoluciones,Stock}.tsx`, `lib/catalog.ts`, `ventas/pages/{RankingVendedores,MiComision,Carga}.tsx`, pruebas `Despachos/Devoluciones/Stock/Carga.test.tsx`, script `M2-capturar.mjs`.

## Pruebas y verificaciones (en `frontend/`)
`npm run lint`, `npm run build`, `npm run size` (JS 158,9 kB gzip, OK) y `npm run test` (742 pruebas) en verde. Nuevas: tarjeta por línea de despacho con Quitar `min-h-11` y sin controles duplicados; secciones Productos/Envases diferenciadas con conteo y filas compactas; Stock N-01 y estructura de tarjetas; tarjeta de Carga. Se actualizaron 3 pruebas que asumían tabla/región con scroll en Devoluciones y `.grid` en Despachos.

## Evidencia
`capturas/M2/<vista>-<ancho>x<alto>-{antes,despues}.png` para despachos-nuevo-3-productos, despachos-lista, devoluciones-detalle (3 productos + 3 envases), stock-productos, stock-envases, ranking, mi-comision, carga, clientes y gastos en 412×915, 375×812, 768×1024, 1024×1366 y 1280×800. `medidas-*.json`: `scrollWidth <= innerWidth` en todos los casos y 0 controles < 44 px (excluye flechas ocultas por CSS y `display:none`). Reproducible con `node M2-capturar.mjs <antes|despues> [filtro]`.

## Límites
- Las capturas de la corrida completa (antes y después) se tomaron con "Caja Interna Sintética" desactivada para evidenciar N-01; por eso Stock/Envases la muestra como "Desconocido" (antes) y con nombre (después). Nuevo despacho se recapturó con el tipo activo (antes con el código base en un worktree aparte), de modo que ya muestra el campo Bandejas. Tipo restaurado a activo al terminar.
- Se creó por la UI un despacho de prueba (3 productos, 22 u.) en la BD local para Devoluciones.
- El encabezado de sección de Devoluciones envuelve a 3 líneas en la columna angosta de 1024 px.
- Capturas de página completa con el shell fijo muestran la cabecera superpuesta (artefacto de `captureBeyondViewport`).
- Sin dispositivo físico ni lector de pantalla.
