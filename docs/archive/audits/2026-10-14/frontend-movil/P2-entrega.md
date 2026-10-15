# P2 — Paginación del resto de historiales

Fecha: 2026-10-14, America/Santiago. Task `task_fdff1163f438`, dispatch `ctx_f39d551447ae`; Beads `OND-c07.10`, parte 2. Rama comprobada: `Cristhian-S1/p2-paginacion-resto`, base `adeb646`. El directorio físico conserva el nombre `p1-paginacion-bodega`, pero la rama y el dispatch son nuevos. Entrega mediante commits locales para cherry-pick; sin push, merge ni PR.

## Resultado y alcance confirmado

Se paginan en servidor **Producción reciente**, **Historial de producción**, **Incidencias recientes**, **Mermas recientes**, **Clientes/cartera** y **Gastos de hoy**. Cada listado usa `range` y `count: 'exact'`, con filtros anteriores y un ID como desempate del orden. Ya no hay consumidores de historiales de Producción que dependan del corte silencioso `.limit(30)`/`.limit(200)`.

Se reutilizan **sin modificar** `components/Paginacion.tsx` y `lib/paginacion.ts` de P1: Anterior / Siguiente, página, total, anuncio accesible y botones de al menos 44 px. Producción utiliza el prop documentado `tamanoPagina={10}` en las cuatro vistas para acortar el desplazamiento de tarjetas y resolver N-02; Clientes/Gastos usan el tamaño compartido por defecto, 20. El tamaño es igual en móvil y escritorio, sin duplicar controles.

**Auditoría está excluida por confirmación explícita del coordinador.** `administracion/pages/Auditoria.tsx` sólo muestra `ModulePage` con «Próximamente»; no existe un historial ni API de administración para paginar. El coordinador confirmó dejar el placeholder y retiró las capturas obligatorias de esa vista. No se creó una función nueva de auditoría ni se cambiaron sus mensajes.

No hay otro listado de transacciones de ventas implementado que crezca sin límite en las páginas disponibles: `Ventas.tsx` muestra accesos y un resumen explícito de carga con «Ver todo»; el resumen de una venta muestra un único folio. Ranking, comisión y carga son consultas de agregados/catálogo y páginas excluidas del ownership. El selector de clientes de Registrar venta conserva su contrato independiente (`useClientesRuta`/`obtenerClientesRuta`), porque no es la cartera y esa página está en manos de otro worker. La nueva cartera usa `useCarteraPaginada` para evitar limitar ese selector accidentalmente.

## Datos y agregados completos

- `useDatosProduccion`: cada recurso paginado tiene página propia en la key; `usePaginaProduccion` reinicia al cambiar identidad/sucursal. Historial y reciente filtrado incluyen producto, fechas y página. `keepPreviousData` conserva filas sólo al navegar dentro del mismo ámbito y filtros; no se usa como placeholder de otra identidad/sucursal/filtro. Cambiar o limpiar filtros vuelve a la página 1.
- `subscribeProduccion` mantiene su suscripción por sucursal y su protección contra callbacks de una suscripción desmontada. La invalidación por prefijo alcanza todas las páginas, incluidas las inactivas, y las variantes filtradas de historial/reciente. Registrar producción sigue invalidando producción, historial, indicadores y envases; incidencias/mermas invalidan sus recursos respectivos. Los errores de escritura conservan los formularios.
- `useCarteraPaginada`: key con usuario, sucursal, vendedor seleccionado, rol y página. Cambiar sucursal/vendedor reinicia página; la invalidación existente de `useCrearCliente` coincide con el prefijo y refresca todas las páginas de la cartera afectada.
- `useGastosHoy`: el listado se pagina por usuario, rol, sucursal, **jornada de Santiago** y página. El reloj/focus/visibility detecta cambio de jornada y vuelve a página 1, sin reiniciar el formulario. Registrar un gasto invalida las páginas y el total diario; una escritura fallida no los invalida.

**Gastos sí necesita paginación aunque sólo muestre hoy:** la fecha limita el período, no el número de registros. Se observó una jornada de 303 gastos. El total mostrado no se calcula con la página visible: `obtenerTotalGastosHoy` lee únicamente montos activos en lotes de hasta 500 filas con conteo exacto, por el mismo vendedor/sucursal/día, y suma todos los lotes. El total diario es una query independiente y se conserva al pasar a página 2. No se necesita activar agregaciones de PostgREST ni crear SQL.

**Indicadores / Totales por producto no se pagina en la UI.** Es una agregación por producto y día para períodos acotados (hoy, 7 o 30 días), no un historial de movimientos; paginar sus filas de transporte y sumar sólo la página haría incorrectas las métricas. `obtenerIndicadoresProduccion` ahora recorre lotes de transporte de hasta 500 filas de la vista existente, con orden estable, hasta completar el período, y mantiene su contrato de agregado completo. Una prueba de 501 filas verifica que no se corta en la primera tanda. Los componentes y fórmulas de indicadores no cambiaron.

Los servicios de Producción con contrato antiguo de array se conservan como adaptadores de compatibilidad sobre lecturas acotadas por rango. Los historiales activos consumen los servicios `obtenerPagina*` y muestran total y navegación; ninguna vista se queda atrapada en esos adaptadores de una sola página.

## Archivos

- Producción: `api.ts`; `hooks/useDatosProduccion.ts`; nuevo `hooks/usePaginaProduccion.ts`; `components/HistorialProduccion.tsx`, `components/ProduccionReciente.tsx`; integración de los dos paginadores de incidencias/mermas en `pages/Produccion.tsx`; pruebas de API, hooks, estados, filtros y páginas.
- Ventas: `api.ts`; nuevo `hooks/useCarteraPaginada.ts`; `hooks/useGastosHoy.ts`; `pages/Clientes.tsx`, `pages/Gastos.tsx`; pruebas de API, invalidación, cambios de ámbito/jornada, estados y navegación.
- Evidencia: scripts [p2-local.mjs](scripts/p2-local.mjs) y [p2-visual.mjs](scripts/p2-visual.mjs), este informe, [P2-verificacion.txt](P2-verificacion.txt), JSON y PNG bajo `capturas/P2/`.

Se comparó literalmente el renderer `TablaProduccionResponsive.tsx` contra la base, y todos los bloques `<form>…</form>` de Producción/Gastos: **idénticos**. Las tarjetas de Clientes tampoco cambiaron; sólo se añadió el paginador fuera de sus árboles de presentación. No se editaron Bodega, el componente de paginación compartido, las páginas/componentes excluidos de Ventas, SQL, migraciones ni `.opencode/`.

## Semilla local, impacto y limpieza

Por autorización explícita del coordinador se sembró **sólo vía API local**, usando la service key obtenida en memoria de `supabase status -o env`. El script rechaza cualquier URL distinta de `http://127.0.0.1:54321`/`http://localhost:54321`; no imprime ni persiste claves. Se añadieron:

| Recurso | Filas sintéticas | Ámbito |
| --- | ---: | --- |
| producciones | 300 | Sucursal 2, producto sintético no retornable |
| mermas | 300 | Sucursal 2, mismo producto, cantidades compensadas |
| incidencias_produccion | 300 | Sucursal 2 |
| clientes | 300 | Vendedor de prueba de sucursal 2 |
| gastos_extras | 300 | Cuenta `ux-vendedor@example.invalid`, sucursal 1 |
| productos | 1 | Catálogo global: `P2 sintético · Hielo de prueba` |

Marcador común: `e2a00710`. IDs: `e2a00710-000K-4000-8000-NNNNNNNNNNNN`, con K=1 producto, 2 producción, 3 merma, 4 incidencia, 5 cliente y 6 gasto; sufijos 1..300 para movimientos/listas. Producto: `e2a00710-0001-4000-8000-000000000001`. Sucursal 2: `10000000-0000-0000-0000-000000000002`; vendedor: `20000000-0000-0000-0002-000000000004`. Hay además marcadores legibles P2 en nombres, observaciones, motivos y descripciones.

La primera ejecución insertó 300 filas por listado y un producto. Repetirla insertó **0** filas en todos ellos. Las producciones y mermas se compensan: el stock del producto sintético queda en **0**, y los saldos preexistentes de `stock_bodega`, `stock_envases` y `carga_vendedor` quedaron idénticos durante las dos ejecuciones. Evidencia: [semilla.json](capturas/P2/semilla.json) e [idempotencia.json](capturas/P2/idempotencia.json).

**Quedan 1.500 registros sintéticos, el producto, su fila de stock cero y la auditoría generada en la BD local**, deliberadamente hasta la limpieza del coordinador. No se ejecutaron DELETE, anulaciones, reset ni cambios de triggers. El coordinador aprobó restaurar al cierre de toda la sesión con `supabase db reset` y la siembra UX existente; este worker no ejecuta ese comando. El subcomando `cleanup` no modifica datos, termina con código 2 y recuerda esa responsabilidad.

El impacto compartido se reduce usando sucursal/vendedor 2 para cuatro vistas; el producto sigue siendo globalmente visible y los 300 gastos cambian la jornada de la cuenta UX de sucursal 1. Se informó al coordinador para las mediciones paralelas de Lighthouse. Durante la verificación otro worker registró una producción real de prueba en sucursal 2: el total pasó de 307 a 308; los JSON y capturas preservan los conteos observados en cada momento, sin atribuir esa fila al fixture P2.

Desde la raíz del repositorio:

```bash
node docs/archive/audits/2026-10-14/frontend-movil/scripts/p2-local.mjs seed
node docs/archive/audits/2026-10-14/frontend-movil/scripts/p2-local.mjs status
node docs/archive/audits/2026-10-14/frontend-movil/scripts/p2-local.mjs measure docs/archive/audits/2026-10-14/frontend-movil/capturas/P2/respuestas.json
node docs/archive/audits/2026-10-14/frontend-movil/scripts/p2-local.mjs cleanup
```

El comando de limpieza acordado para el **coordinador al cerrar la sesión y coordinar todos los workers** es `supabase db reset` seguido de la siembra UX de la sesión. No debe ejecutarse como parte de esta entrega ni mientras otros workers estén activos.

## Tamaños de respuesta antes/después

Medición de cuerpos HTTP decodificados, sin cabeceras ni compresión, misma sucursal/filtros y orden para cada par. Antes se reproducen los límites de la base (30/200 en Producción, sin paginación en Clientes/Gastos); después se aplica la primera página con conteo exacto. Gastos se filtra por el día civil actual de Santiago. Evidencia íntegra: [respuestas.json](capturas/P2/respuestas.json).

| Vista | Antes: filas / bytes | Después: filas / bytes | Total exacto después | Reducción del listado |
| --- | --- | --- | --- | --- |
| Producción reciente | 30 / 11.208 B | 10 / 3.748 B | `0-9/308` | 66.56% |
| Historial | 200 / 74.618 B | 10 / 3.748 B | `0-9/308` | 94.98% |
| Mermas | 30 / 11.248 B | 10 / 3.748 B | `0-9/300` | 66.68% |
| Incidencias | 30 / 9.418 B | 10 / 3.138 B | `0-9/300` | 66.68% |
| Clientes | 301 / 70.922 B | 20 / 4.686 B | `0-19/301` | 93.39% |
| Gastos | 303 / 89.242 B | 20 / 5.898 B | `0-19/303` | 93.39% |

Todas las páginas posteriores responden HTTP 206 con `Content-Range` y las lecturas previas HTTP 200. El ahorro de la tabla es del **listado**, no del agregado financiero. El total diario de Gastos añade una respuesta compacta de 5.465 B con 303 montos y total $ 4.574.355; listado más total suman 11.363 B, frente a 89.242 B de la lectura completa anterior (87.27% menos en el conjunto medido). Al navegar sólo cambia la query del listado; no se suma la página para actualizar el total.

## N-02 y verificación visual

N-02 en `docs/archive/audits/2026-10-13/frontend-ux/C2-barrido-final.md` describe 6.074 px de historial a 375 px y un límite de 200. Se resuelve con **10 tarjetas por página y total/navegación**, manteniendo el renderer de M1. En esta prueba, con más de 300 producciones en la misma BD:

| A 375×812 | Antes | Después |
| --- | ---: | ---: |
| Tarjetas visibles en Historial | 200 | 10 |
| Alto del documento | 42.165 px | 3.122 px |
| Alto de la sección | 41.661 px | 2.618 px |

Las diferencias frente a los 6.074 px del hallazgo histórico corresponden a otro snapshot/dataset y al diseño M1 ya integrado; la comparación nueva usa la misma base y datos locales para antes/después. La longitud de la página ahora depende del tamaño 10 y del contenido de esas tarjetas, no del crecimiento total del historial.

Chrome real `/usr/bin/google-chrome` con Playwright, zona `America/Santiago`. Baseline `git archive adeb646` en `/tmp/ondina-p2-base`, puerto 5188; implementación en 5187. Producción/Clientes se verifican con admin global seleccionando sucursal 2 y el vendedor de prueba; Gastos con el vendedor UX de sucursal 1. Se esperan las transiciones del shell antes de medir. No se interceptan respuestas ni se simulan filas en el navegador: los datos están en la BD local.

**30/30 combinaciones** (seis vistas × cinco viewports) cumplen `scrollWidth <= innerWidth`. Anterior y Siguiente miden 89,59×44 y 97,02×44 px; las seis vistas hacen una petición real de página 2 con offset 10 o 20 y reciben ese número de filas. Después: **0 page errors, 0 errores de consola, 0 requests fallidas y 0 API ≥400**. Evidencia: [visual.json](capturas/P2/visual.json), 90 PNG de la matriz optimizados sin pérdida (30 antes, 30 después y 30 del paginador), aproximadamente 9,5 MB, más una captura adicional de la última página.

| Vista | Viewport | scrollWidth / innerWidth después | Filas después | Antes | Después | Paginador |
| --- | --- | --- | ---: | --- | --- | --- |
| Producción reciente | 412×915 | 412 / 412 | 10 | [PNG](capturas/P2/reciente-412x915-antes.png) | [PNG](capturas/P2/reciente-412x915-despues.png) | [PNG](capturas/P2/reciente-412x915-paginacion.png) |
| Producción reciente | 375×812 | 375 / 375 | 10 | [PNG](capturas/P2/reciente-375x812-antes.png) | [PNG](capturas/P2/reciente-375x812-despues.png) | [PNG](capturas/P2/reciente-375x812-paginacion.png) |
| Producción reciente | 768×1024 | 768 / 768 | 10 | [PNG](capturas/P2/reciente-768x1024-antes.png) | [PNG](capturas/P2/reciente-768x1024-despues.png) | [PNG](capturas/P2/reciente-768x1024-paginacion.png) |
| Producción reciente | 1024×1366 | 1024 / 1024 | 10 | [PNG](capturas/P2/reciente-1024x1366-antes.png) | [PNG](capturas/P2/reciente-1024x1366-despues.png) | [PNG](capturas/P2/reciente-1024x1366-paginacion.png) |
| Producción reciente | 1280×800 | 1280 / 1280 | 10 | [PNG](capturas/P2/reciente-1280x800-antes.png) | [PNG](capturas/P2/reciente-1280x800-despues.png) | [PNG](capturas/P2/reciente-1280x800-paginacion.png) |
| Historial | 412×915 | 412 / 412 | 10 | [PNG](capturas/P2/historial-412x915-antes.png) | [PNG](capturas/P2/historial-412x915-despues.png) | [PNG](capturas/P2/historial-412x915-paginacion.png) |
| Historial | 375×812 | 375 / 375 | 10 | [PNG](capturas/P2/historial-375x812-antes.png) | [PNG](capturas/P2/historial-375x812-despues.png) | [PNG](capturas/P2/historial-375x812-paginacion.png) |
| Historial | 768×1024 | 768 / 768 | 10 | [PNG](capturas/P2/historial-768x1024-antes.png) | [PNG](capturas/P2/historial-768x1024-despues.png) | [PNG](capturas/P2/historial-768x1024-paginacion.png) |
| Historial | 1024×1366 | 1024 / 1024 | 10 | [PNG](capturas/P2/historial-1024x1366-antes.png) | [PNG](capturas/P2/historial-1024x1366-despues.png) | [PNG](capturas/P2/historial-1024x1366-paginacion.png) |
| Historial | 1280×800 | 1280 / 1280 | 10 | [PNG](capturas/P2/historial-1280x800-antes.png) | [PNG](capturas/P2/historial-1280x800-despues.png) | [PNG](capturas/P2/historial-1280x800-paginacion.png) |
| Incidencias | 412×915 | 412 / 412 | 10 | [PNG](capturas/P2/incidencias-412x915-antes.png) | [PNG](capturas/P2/incidencias-412x915-despues.png) | [PNG](capturas/P2/incidencias-412x915-paginacion.png) |
| Incidencias | 375×812 | 375 / 375 | 10 | [PNG](capturas/P2/incidencias-375x812-antes.png) | [PNG](capturas/P2/incidencias-375x812-despues.png) | [PNG](capturas/P2/incidencias-375x812-paginacion.png) |
| Incidencias | 768×1024 | 768 / 768 | 10 | [PNG](capturas/P2/incidencias-768x1024-antes.png) | [PNG](capturas/P2/incidencias-768x1024-despues.png) | [PNG](capturas/P2/incidencias-768x1024-paginacion.png) |
| Incidencias | 1024×1366 | 1024 / 1024 | 10 | [PNG](capturas/P2/incidencias-1024x1366-antes.png) | [PNG](capturas/P2/incidencias-1024x1366-despues.png) | [PNG](capturas/P2/incidencias-1024x1366-paginacion.png) |
| Incidencias | 1280×800 | 1280 / 1280 | 10 | [PNG](capturas/P2/incidencias-1280x800-antes.png) | [PNG](capturas/P2/incidencias-1280x800-despues.png) | [PNG](capturas/P2/incidencias-1280x800-paginacion.png) |
| Mermas | 412×915 | 412 / 412 | 10 | [PNG](capturas/P2/mermas-412x915-antes.png) | [PNG](capturas/P2/mermas-412x915-despues.png) | [PNG](capturas/P2/mermas-412x915-paginacion.png) |
| Mermas | 375×812 | 375 / 375 | 10 | [PNG](capturas/P2/mermas-375x812-antes.png) | [PNG](capturas/P2/mermas-375x812-despues.png) | [PNG](capturas/P2/mermas-375x812-paginacion.png) |
| Mermas | 768×1024 | 768 / 768 | 10 | [PNG](capturas/P2/mermas-768x1024-antes.png) | [PNG](capturas/P2/mermas-768x1024-despues.png) | [PNG](capturas/P2/mermas-768x1024-paginacion.png) |
| Mermas | 1024×1366 | 1024 / 1024 | 10 | [PNG](capturas/P2/mermas-1024x1366-antes.png) | [PNG](capturas/P2/mermas-1024x1366-despues.png) | [PNG](capturas/P2/mermas-1024x1366-paginacion.png) |
| Mermas | 1280×800 | 1280 / 1280 | 10 | [PNG](capturas/P2/mermas-1280x800-antes.png) | [PNG](capturas/P2/mermas-1280x800-despues.png) | [PNG](capturas/P2/mermas-1280x800-paginacion.png) |
| Clientes | 412×915 | 412 / 412 | 20 | [PNG](capturas/P2/clientes-412x915-antes.png) | [PNG](capturas/P2/clientes-412x915-despues.png) | [PNG](capturas/P2/clientes-412x915-paginacion.png) |
| Clientes | 375×812 | 375 / 375 | 20 | [PNG](capturas/P2/clientes-375x812-antes.png) | [PNG](capturas/P2/clientes-375x812-despues.png) | [PNG](capturas/P2/clientes-375x812-paginacion.png) |
| Clientes | 768×1024 | 768 / 768 | 20 | [PNG](capturas/P2/clientes-768x1024-antes.png) | [PNG](capturas/P2/clientes-768x1024-despues.png) | [PNG](capturas/P2/clientes-768x1024-paginacion.png) |
| Clientes | 1024×1366 | 1024 / 1024 | 20 | [PNG](capturas/P2/clientes-1024x1366-antes.png) | [PNG](capturas/P2/clientes-1024x1366-despues.png) | [PNG](capturas/P2/clientes-1024x1366-paginacion.png) |
| Clientes | 1280×800 | 1280 / 1280 | 20 | [PNG](capturas/P2/clientes-1280x800-antes.png) | [PNG](capturas/P2/clientes-1280x800-despues.png) | [PNG](capturas/P2/clientes-1280x800-paginacion.png) |
| Gastos | 412×915 | 412 / 412 | 20 | [PNG](capturas/P2/gastos-412x915-antes.png) | [PNG](capturas/P2/gastos-412x915-despues.png) | [PNG](capturas/P2/gastos-412x915-paginacion.png) |
| Gastos | 375×812 | 375 / 375 | 20 | [PNG](capturas/P2/gastos-375x812-antes.png) | [PNG](capturas/P2/gastos-375x812-despues.png) | [PNG](capturas/P2/gastos-375x812-paginacion.png) |
| Gastos | 768×1024 | 768 / 768 | 20 | [PNG](capturas/P2/gastos-768x1024-antes.png) | [PNG](capturas/P2/gastos-768x1024-despues.png) | [PNG](capturas/P2/gastos-768x1024-paginacion.png) |
| Gastos | 1024×1366 | 1024 / 1024 | 20 | [PNG](capturas/P2/gastos-1024x1366-antes.png) | [PNG](capturas/P2/gastos-1024x1366-despues.png) | [PNG](capturas/P2/gastos-1024x1366-paginacion.png) |
| Gastos | 1280×800 | 1280 / 1280 | 20 | [PNG](capturas/P2/gastos-1280x800-antes.png) | [PNG](capturas/P2/gastos-1280x800-despues.png) | [PNG](capturas/P2/gastos-1280x800-paginacion.png) |

Reproducción visual: levantar el baseline en 5188 y la implementación en 5187, e invocar `PLAYWRIGHT_MODULE=<ruta-al-index.mjs-de-Playwright-instalado> node docs/archive/audits/2026-10-14/frontend-movil/scripts/p2-visual.mjs`. No se instala Playwright como dependencia del proyecto.

## Pruebas y cuatro gates

Fase roja observada antes de implementar: 8 pruebas nuevas de API por ausencia de servicios paginados, 3 pruebas de UI/navegación por ausencia del paginador en las vistas, y después una prueba del agregado de 501 filas que evidenció el corte en la primera tanda. Se adaptaron los fixtures anteriores a `Pagina<T>` conservando sus errores, promesas pendientes y aserciones de aislamiento; las pruebas de límites antiguos ahora verifican los rangos equivalentes, sin relajar mensajes públicos ni la validación de formularios.

Cobertura final:

- API: rangos correctos, conteo exacto, sucursal/vendedor/producto, activo/anulado, fechas de Santiago, orden estable y errores públicos; lectura completa de agregados/montos en dos tandas, con 501 filas.
- Historial/reciente: navegación, filas retenidas mientras se pide otra página, filtros/limpieza con reset, rango invertido sin consulta y estados de carga/error/vacío existentes.
- Incidencias/mermas: paginación independiente, reset por sucursal, vacíos con ambos extremos deshabilitados; conservación de formularios ante fallo de escritura.
- Clientes: total/navegación, cartera vacía, reset por vendedor y ámbito, protección de respuesta tardía, creación e invalidación de todas las páginas del vendedor.
- Gastos: total diario completo conservado al navegar, vacío con total cero válido, cambio de jornada a página 1, invalidación de páginas y total sólo con escritura exitosa, y borrador preservado ante fallo de lectura.
- Realtime: invalida todas las páginas inactivas del recurso afectado, conserva otras identidades y limpia la suscripción al cambiar ámbito/desmontar; mutaciones de Producción conservan los prefijos de recursos afectados.

Ejecutado desde `frontend/`, sin cambiar timeouts:

| Gate | Resultado |
| --- | --- |
| `npm run lint` | PASS, sin errores ni warnings |
| `npm run build` | PASS; permanece el warning previo `INEFFECTIVE_DYNAMIC_IMPORT` de dashboard |
| `npm run size` | PASS: JS entrada 103.574 B gzip, chunk mayor 328.053 B, JS inicial total 162.003 B gzip, CSS inicial 7.651 B gzip |
| `npm run test -- --maxWorkers=2` | PASS: **64 archivos, 761 pruebas**, 26,23 s |

Se limitó concurrencia a dos workers por la carga compartida de la sesión; no se aumentó ningún timeout. No se ejecutó `test:integration`, reservado al coordinador. Logs: [P2-verificacion.txt](P2-verificacion.txt).

## Índices y límites

No se creó ningún índice ni se ejecutó SQL. El repositorio ya declara índices de sucursal/fecha en producciones y mermas, vendedor/fecha en gastos, y sucursal/vendedor en clientes. Las lecturas locales de ≥300 filas funcionan sin un índice adicional; no se afirma que esto sustituya un EXPLAIN ni una prueba de carga de producción.

Si los historiales crecen mucho más, conviene evaluar índices compuestos que acompañen el orden y el ámbito: `incidencias_produccion(sucursal_id, creado_en DESC, id DESC)` y `clientes(sucursal_id, vendedor_id, nombre, id) WHERE activo`; revisar además si añadir `id` al final de los índices de fecha existentes mejora los desempates. Son propuestas para una tarea de base de datos con evidencia del plan, no cambios incluidos aquí. `count: 'exact'` y los offsets altos tienen un coste que deberá medirse a mayor escala; no se sustituyeron por cursores porque la aceptación pide el patrón de página/total de P1.

No se verificó ni modificó la BD remota. No se implementó Auditoría; su exclusión está aprobada por el coordinador. La restauración local de los fixtures y la integración de los commits quedan a cargo del coordinador; `OND-c07.10` no se cierra unilateralmente con esta parte.


Verificación adicional de acceso completo: se recorrieron **30 páginas filtradas por el producto sintético**, offsets 0..290 de diez en diez, obteniendo **300 UUIDs únicos**. La última página anuncia «Página 30 de 30 · 300 registros» y deshabilita Siguiente; al limpiar el filtro vuelve a «Página 1 de 31 · 308 registros». Esto comprueba acceso más allá del antiguo corte de 200, además de los seis recorridos de página 2. Evidencia: [recorrido-historial.json](capturas/P2/recorrido-historial.json), [última página a 375 px](capturas/P2/historial-375x812-ultima.png) y script reproducible [p2-recorrido.mjs](scripts/p2-recorrido.mjs), con la misma variable `PLAYWRIGHT_MODULE` y servidor 5187.

## Commits locales y entrega

- `666128d` — `feat(produccion): paginate histories without truncating aggregates`.
- `2fb1ba8` — `feat(ventas): paginate cartera and daily expenses`.
- El informe, scripts y capturas se entregan en un tercer commit local separado.

Beads `OND-c07.10` queda `in_progress`, con metadata `p2_status=delivered-local` y la ruta de este informe; el coordinador decide el cierre tras integrar y verificar el conjunto. La tarea/dispatch P2 se reporta una sola vez mediante `worker_done`, con los archivos reales y este informe.
