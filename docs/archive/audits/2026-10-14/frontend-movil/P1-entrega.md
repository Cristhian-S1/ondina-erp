# P1 — Paginación compartida y Bodega

Fecha: 2026-10-14, America/Santiago. Tarea Orca `task_707cad2fe26e`, dispatch `ctx_0e2215f90cfb`; Beads `OND-c07.10`, **parte 1**. Base comprobada: `4809b1a` de `origin/feature/frontend-ux`. Entrega local para cherry-pick; sin push, merge ni PR.

## Resultado

Despachos y el selector/listado de Devoluciones consultan el servidor en páginas de 20 filas con conteo exacto y filtros de sucursal, vendedor y jornada/fecha. Los detalles, envases y devoluciones se leen únicamente para los IDs de esa página. Las dos vistas muestran **Página 1 de 16 · 316 registros** en la prueba local con 300 cabeceras sintéticas adicionales.

Se eligió un único patrón compartido: **Anterior / Siguiente**, página actual, número de páginas y total filtrado. `Paginacion` incluye landmark con etiqueta, botones nativos deshabilitados en los extremos y durante una lectura, anuncio `aria-live="polite"`/`aria-atomic`, y controles de 44 px de alto. El contrato está documentado en la nueva sección inglesa `Server pagination` de `docs/engineering/frontend.md`.

## Archivos y decisiones

- `frontend/src/components/Paginacion.tsx` y `.test.tsx`: componente compartido; props `pagina`, `total`, `tamanoPagina?`, `onCambiar`, `cargando?`, `etiqueta?`.
- `frontend/src/lib/paginacion.ts` y `.test.ts`: `TAMANO_PAGINA = 20`, `Pagina<T> = { filas, total }`, `rangoPagina()` inclusivo y `totalPaginas()`.
- `frontend/src/domains/bodega/api.ts` y `.test.ts`: `obtenerPaginaDespachos()` aplica filtros antes del rango, `count: 'exact'` y orden descendente por `creado_en` más `id` para desempatar; `obtenerDespacho()` limita la consulta individual por sucursal e ID. El servicio anterior `obtenerDespachos()` permanece por compatibilidad, pero los historiales de la aplicación ya no lo consumen.
- `frontend/src/domains/bodega/hooks/useDatosBodega.ts`: separa catálogo, vendedores, stock de productos/envases y carga de vendedor del historial; los saldos siguen proviniendo de sus tablas autoritativas.
- `frontend/src/domains/bodega/hooks/usePaginaBodega.ts` y `.test.tsx`: keys con identidad, rol, sucursal del perfil, sucursal seleccionada, filtros y página; `keepPreviousData` sólo entre páginas del mismo ámbito/filtros, sin conservar datos de otra identidad o sucursal. Cambiar filtros vuelve a página 1, incluso al volver a un filtro ya visitado. `isPending` cubre carga inicial y `isFetching` informa actualización sin vaciar la lista.
- `frontend/src/domains/bodega/hooks/filtrosHistorial.ts` y `.test.ts`: convierte días civiles de Santiago a límites UTC, incluyendo cambios de horario y medianoche inexistente; el extremo superior es exclusivo. Conserva el comportamiento del filtro de siete días existente.
- `frontend/src/domains/bodega/pages/Despachos.tsx` y `Devoluciones.tsx`, con sus pruebas: integran el paginador. El panel secundario de devoluciones se identifica como **Devoluciones de esta página** y su vacío describe ese alcance.

**Stock/carga y selección:** no se calcula ningún saldo sumando la página visible ni se necesita descargar todos los despachos del día. En Devoluciones, la selección queda fijada en una consulta independiente por ID/sucursal, inicializada con los detalles ya cargados de la página: navegar conserva el despacho y sus cantidades escritas. Un fallo al actualizar ese detalle conserva el borrador, muestra reintento y deshabilita guardar. Los éxitos de las mutaciones invalidan todas las páginas y recursos de Bodega del ámbito actual, `['stock', perfilId, sucursalId]` y `['ventas', 'carga']`; los errores no invalidan ni limpian el borrador.

El **JSX del modal Nuevo despacho quedó idéntico a `4809b1a`**, comprobado mediante comparación literal del bloque `<Dialog>`. No se editaron `ventas/`, `produccion/`, SQL, migraciones ni `.opencode/`.

## Medición local antes/después

La medición usa exclusivamente `http://127.0.0.1:54321`, la service key obtenida en memoria mediante `supabase status -o env`, y la API REST. El script rechaza cualquier URL distinta de localhost/127.0.0.1:54321; no imprime ni escribe claves. Se compara la misma sucursal y todos sus despachos, con 316 cabeceras totales. Son bytes del cuerpo HTTP decodificado, sin cabeceras ni estimación de compresión.

| Recurso | Antes: filas / bytes / HTTP | Después: filas / bytes / HTTP |
| --- | --- | --- |
| despachos | 316 / 124.370 B / 200 | 20 / 7.836 B / 206, `Content-Range: 0-19/316` |
| despacho_detalles | fallo / 13 B / 414 | 0 / 2 B / 200 |
| despacho_envases | fallo / 13 B / 414 | 0 / 2 B / 200 |
| devoluciones_productos | fallo / 13 B / 414 | 0 / 2 B / 200 |
| devoluciones_envases | fallo / 13 B / 414 | 0 / 2 B / 200 |

La respuesta de **cabeceras disminuye 93,70 %**. La suma de cuerpos observados es 124.422 B antes y 7.844 B después, pero **no se presenta como comparación de dos lecturas completas exitosas**: antes, el listado de más de 300 UUIDs produce `414 URI too long` al pedir cualquiera de los cuatro recursos relacionados. El navegador del baseline recibe fallos de red/CORS en esas solicitudes y muestra el error con Reintentar; las capturas «antes» documentan ese resultado real. Después, las cuatro peticiones relacionadas devuelven respuestas válidas y llevan como máximo 20 IDs, confirmado también en el tráfico del navegador.

Las 300 filas sintéticas son **cabeceras sin detalles ni movimientos**, por autorización explícita del coordinador; por eso las primeras páginas sintéticas tienen cero unidades y arrays relacionados vacíos. Esta prueba demuestra el límite de cabeceras/IDs y la eliminación del 414, no estima el ahorro para una distribución real de detalles por despacho. Pruebas unitarias cubren detalles y devoluciones no vacíos, límites de productos y conservación del borrador.

Evidencia: [respuestas.json](capturas/P1/respuestas.json), [semilla.json](capturas/P1/semilla.json), [visual.json](capturas/P1/visual.json).

## Datos sintéticos y limpieza pendiente autorizada

**Permanecen 300 cabeceras sintéticas en la BD local**, sucursal `10000000-0000-0000-0000-000000000001`. Marcador UUID: `e1b0de00-707c-4ad2-8e26-`, sufijos `000000000001` a `000000000300`. La tabla no tiene columna `observaciones`, por lo que el marcador vive en el ID determinista. La primera ejecución insertó 300 filas; repetirla insertó 0. Se verificaron iguales las filas completas de `stock_bodega`, `stock_envases` y `carga_vendedor` antes/después de la siembra.

`proteger_movimiento_b3` impide DELETE también con service role. Se consultó al coordinador, quien autorizó expresamente **dejarlas sin anular** y asumió la restauración de la BD local al cierre de toda la sesión mediante `supabase db reset` y la siembra UX existente. Este worker no ejecutó reset, DELETE, anulación, SQL ni cambios de triggers. La reversibilidad queda en esa restauración local coordinada; no hay una limpieza destructiva oculta dentro del script.

Comandos reproducibles desde la raíz del repo:

```bash
node frontend/scripts/p1-despachos-local.mjs seed
node frontend/scripts/p1-despachos-local.mjs status
node frontend/scripts/p1-despachos-local.mjs measure docs/archive/audits/2026-10-14/frontend-movil/capturas/P1/respuestas.json
node frontend/scripts/p1-despachos-local.mjs cleanup
```

`cleanup` **no cambia datos**: termina con código 2 e informa la restricción y la responsabilidad del coordinador. El comando de limpieza acordado para el coordinador, **sólo al cerrar la sesión y tras coordinar a todos los workers**, es `supabase db reset` seguido del script UX de la sesión; no debe ejecutarse como parte de esta entrega ni con workers activos.

## Pruebas y verificaciones

Se observó una fase roja antes de implementar: componente/hook inexistentes y dos pruebas de API fallando por ausencia del servicio paginado. La fase verde incluye primera/última página, botones deshabilitados, vacío y anuncio; rango `40..59` para página 3, filtros y conteo exacto; detalles sólo de IDs visibles; retención de filas mientras la página siguiente está pendiente; reset de página al cambiar y volver a filtros; invalidación de páginas activas/inactivas, recursos, detalle seleccionado, stock y carga, sin invalidar otra identidad; selección/borrador conservados fuera de la página y regresiones existentes de Bodega.

Ejecutado desde `frontend/`:

| Gate | Resultado |
| --- | --- |
| `npm run lint` | PASS, sin errores ni warnings |
| `npm run build` | PASS; persiste el warning previo `INEFFECTIVE_DYNAMIC_IMPORT` de `dashboard.ts` |
| `npm run size` | PASS: JS entrada 103.585 B gzip; chunk mayor 328.048 B; JS inicial total 162.014 B gzip; CSS inicial 7.389 B gzip |
| `npm run test -- --maxWorkers=2` | PASS: **59 archivos, 736 pruebas**, sin modificar timeouts |

La primera suite con concurrencia por defecto falló bajo carga de CPU compartida (timeouts y una aserción temporal de Stock); se informó al coordinador y se repitió limitando workers. La ejecución final completa pasó en 24,56 s. No se ejecutó `test:integration`, reservado al coordinador. Evidencia textual: [P1-verificacion.txt](P1-verificacion.txt).

## Navegador y viewports

Chrome real `/usr/bin/google-chrome`, Playwright headless, cuenta local `ux-bodega@example.invalid`. Baseline servido desde un `git archive 4809b1a` en `/tmp/ondina-p1-base` (puerto 5178); implementación en 5177. Ambas versiones consultan la misma BD local con 300 cabeceras sintéticas. Se espera el final de las transiciones CSS de la barra lateral antes de medir cada viewport: se observó overflow transitorio al redimensionar, no en el estado estable capturado. No se cambió el shell compartido.

Para ambas vistas, la página siguiente hace una solicitud real `offset=20&limit=20`, devuelve 20 UUIDs y muestra página 2. En el estado final hubo **0 page errors, 0 errores de consola, 0 requests fallidas y 0 respuestas API ≥400**. Todas las peticiones de detalles llevan ≤20 IDs. Los botones Anterior/Siguiente miden 89,59×44 y 97,02×44 px. Se revisaron visualmente las capturas móviles y tablet; hay 30 PNG optimizados sin pérdida: 10 antes, 10 después y 10 acercamientos del paginador.

| Vista | Viewport | scrollWidth / innerWidth después | Antes | Después | Paginador |
| --- | --- | --- | --- | --- | --- |
| Despachos | 412×915 | 412 / 412 | [PNG](capturas/P1/despachos-412x915-antes.png) | [PNG](capturas/P1/despachos-412x915-despues.png) | [PNG](capturas/P1/despachos-412x915-paginacion.png) |
| Despachos | 375×812 | 375 / 375 | [PNG](capturas/P1/despachos-375x812-antes.png) | [PNG](capturas/P1/despachos-375x812-despues.png) | [PNG](capturas/P1/despachos-375x812-paginacion.png) |
| Despachos | 768×1024 | 768 / 768 | [PNG](capturas/P1/despachos-768x1024-antes.png) | [PNG](capturas/P1/despachos-768x1024-despues.png) | [PNG](capturas/P1/despachos-768x1024-paginacion.png) |
| Despachos | 1024×1366 | 1024 / 1024 | [PNG](capturas/P1/despachos-1024x1366-antes.png) | [PNG](capturas/P1/despachos-1024x1366-despues.png) | [PNG](capturas/P1/despachos-1024x1366-paginacion.png) |
| Despachos | 1280×800 | 1280 / 1280 | [PNG](capturas/P1/despachos-1280x800-antes.png) | [PNG](capturas/P1/despachos-1280x800-despues.png) | [PNG](capturas/P1/despachos-1280x800-paginacion.png) |
| Devoluciones | 412×915 | 412 / 412 | [PNG](capturas/P1/devoluciones-412x915-antes.png) | [PNG](capturas/P1/devoluciones-412x915-despues.png) | [PNG](capturas/P1/devoluciones-412x915-paginacion.png) |
| Devoluciones | 375×812 | 375 / 375 | [PNG](capturas/P1/devoluciones-375x812-antes.png) | [PNG](capturas/P1/devoluciones-375x812-despues.png) | [PNG](capturas/P1/devoluciones-375x812-paginacion.png) |
| Devoluciones | 768×1024 | 768 / 768 | [PNG](capturas/P1/devoluciones-768x1024-antes.png) | [PNG](capturas/P1/devoluciones-768x1024-despues.png) | [PNG](capturas/P1/devoluciones-768x1024-paginacion.png) |
| Devoluciones | 1024×1366 | 1024 / 1024 | [PNG](capturas/P1/devoluciones-1024x1366-antes.png) | [PNG](capturas/P1/devoluciones-1024x1366-despues.png) | [PNG](capturas/P1/devoluciones-1024x1366-paginacion.png) |
| Devoluciones | 1280×800 | 1280 / 1280 | [PNG](capturas/P1/devoluciones-1280x800-antes.png) | [PNG](capturas/P1/devoluciones-1280x800-despues.png) | [PNG](capturas/P1/devoluciones-1280x800-paginacion.png) |

Reproducción visual: levantar las dos versiones en los puertos indicados y ejecutar `PLAYWRIGHT_MODULE=<ruta-al-index.mjs-de-Playwright-instalado> node frontend/scripts/p1-visual.mjs docs/archive/audits/2026-10-14/frontend-movil/capturas/P1`. El script usa Chrome instalado; no modifica dependencias del proyecto ni realiza mutaciones de negocio.

## Límites y siguiente consumidor

Entrega limitada a P1: el coordinador integra los commits y ejecuta integración; P2 cubre los otros dominios. `OND-c07.10` no se cierra con esta parte. No se verificó ni modificó la BD remota. Las filas sintéticas y sus registros de auditoría locales quedan deliberadamente hasta el reset/reseed coordinado, como se detalla arriba. La protección de borrado y la semilla sólo de cabeceras son ajustes aprobados explícitamente por el coordinador a los requisitos originales de fixture/limpieza.

Commit de implementación: `2ef3100` (`feat(bodega): paginate dispatch histories on the server`). El informe, scripts y capturas se entregan en un commit local separado. Beads `OND-c07.10` queda `in_progress` con metadata `p1_status=delivered-local` y la ruta de este informe; el cierre del conjunto corresponde al coordinador.
