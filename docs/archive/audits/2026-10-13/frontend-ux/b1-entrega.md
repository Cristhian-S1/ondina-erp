# B1 — Entrega de correcciones de bodega

Fecha: 2026-10-13 (America/Santiago). Beads: OND-c07.4. Rama: `Cristhian-S1/fux-b1-bodega`. Base integrada: `ac385d6` (`origin/feature/frontend-ux`, incluye B5).

El código y la comprobación visual están entregados en commits locales. **El coordinador autorizó la entrega B1 con éxito bajo una excepción para `size`: lint, build y test pasan; size falla también al compilar la base sin B1, y la diferencia de B1 es menor de 0,1 %.** La cuarta verificación de la fase queda pendiente del lote B6. No se ha aumentado el presupuesto ni modificado configuración para evitar el fallo.

## Hallazgos resueltos

| ID | Resultado | Commit |
| --- | --- | --- |
| A1-01 | Consultas con clave por identidad, rol, sucursal asignada y sucursal seleccionada; una respuesta tardía de B no sustituye datos de A. `AmbitoBodega` mantiene disponible el selector mientras carga y reinicia formulario, selección, filtros, errores y clave de reintento al cambiar de contexto. | `1aaa92f` |
| A1-02 | Lectura en dos etapas y normalización de totales/nombres extraídas a `useDatosBodega`; selección inicial y aislamiento del formulario en `AmbitoBodega`. Se conserva la lectura de stock de productos sólo para Despachos. | `1aaa92f` |
| A1-04 | Cada línea del modal recibe UUID local al crearse; borrar una anterior conserva el nodo, valor y foco de la siguiente. El ID local no se envía a la RPC. | `1aaa92f` |
| A1-09 / UX-01 | Filas de Despachos apiladas bajo 640 px, badges con wrap, hijos del grid con `min-w-0`, filtros limitados al ancho disponible. Tablas del detalle de Devoluciones contenidas en regiones con nombre, foco de teclado y scroll interno. | `1aaa92f` |
| A1-18 | Jornada observada mediante `useSyncExternalStore`, reloj y eventos focus/visibilitychange; fecha calculada en America/Santiago. Filtros derivados durante render, sin efecto que copie estado derivado. | `1aaa92f` |
| UX-10 | “Vendedor no disponible”, fecha/hora de Santiago e identificador corto en despachos y grupos de devoluciones; formatos compartidos de B5. | `1aaa92f` |
| UX-19 | Se oculta la exportación pendiente; Actualizar usa `btnSecondary`. | `5eb4986` |
| Estados de bodega / UX-11 | Consumo de `EstadoVista` de B5: carga con status, error con alert y Reintentar; estados vacíos envueltos en status. Errores de mutación anunciados con alert. | `1aaa92f`, `5eb4986` |

Las RPC de despacho/devolución/corrección, las claves de reintento dentro de la misma operación y la política de devoluciones permanecen cubiertas por sus pruebas existentes. No se modificó `api.ts` ni permisos de rutas.

## Pruebas

Primero se añadieron las regresiones y se observaron **15 fallos / 25 aciertos** en las tres suites de páginas antes de la corrección. La regresión antigua que conservaba un borrador al cambiar de sucursal se ajustó al nuevo requisito explícito: ese cambio debe limpiarlo; otra prueba cubre que un reintento dentro de la misma sucursal sí conserva el borrador.

Se añaden **20 casos netos**, distribuidos entre las tres suites de páginas y `hooks/useJornadaSantiago.test.tsx`:

- A→B→A con respuesta B tardía, tanto éxito como error, en ambas páginas; ausencia de datos anteriores mientras B carga.
- Cambio de identidad con lectura previa pendiente y limpieza de selección/borrador.
- Conservación del nodo DOM, foco y cantidad de una línea al eliminar la anterior.
- Carga/vacío/error anunciados, reintento y fallback del vendedor con ID corto/hora.
- Cambio de día al reanudar y durante una pestaña abierta; limpieza del temporizador y periodos que cruzan mes/año/cambio horario.
- Regiones de tablas con nombre/foco, acción secundaria de Stock y ausencia de exportación pendiente.
- Conservación del borrador de Despachos tras error y reintento de lectura en la misma sucursal.

## Cuatro verificaciones

Ejecutadas desde `frontend/`. Verificación final con **Node 22.23.3**, mediante `npm exec --yes --package=node@22 -- npm run <script>`; también se comprobaron con el Node 26.3.1 disponible inicialmente. `npm ci --prefix frontend` se ejecutó sin cambios al lockfile.

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm run lint` | 0 | Sin errores ni warnings de ESLint. |
| `npm run build` | 0 | TypeScript y Vite completan. Vite avisa de import dinámico/estático de `lib/dashboard.ts` y chunk mayor de 500 KB. |
| `npm run size` | **1** | Entrada gzip **155.892 B > 105.567 B**; chunk máximo **533.027 B > 332.108 B**. CSS gzip 43.684 B <= 47.853 B. |
| `npm run test` | 0 | **571 pruebas, 48 archivos**, todos pasan. |

Para aislar el fallo de size se compiló `git archive ac385d6 frontend` en un directorio temporal, con las mismas dependencias y configuración local, **sin los cambios de B1**: entrada gzip **155.858 B**, chunk máximo **532.971 B**, y también exit 1. La diferencia frente a esa base es +34 B gzip en la entrada (**+0,0218 %**) y +56 B en el chunk máximo (**+0,0105 %**); esto acredita que la mayor parte del exceso ya aparece en la compilación de la base en este entorno, pero **no determina su causa**.

El fallo persiste después de `npm ci`, con Node 22 y con `env -u NODE_ENV npm run build`; no hay NODE_ENV ni variables NODE/VITE exportadas. Se escaló al coordinador, que después confirmó el diagnóstico: según su comprobación, el commit B5 `c56cd79` de la base, con `.env.local` real, hace que Rolldown fusione el chunk de Supabase en la entrada; el conjunto inicial casi no cambia. El coordinador asumió la corrección mediante B6 (chunk de vendor explícito y medición del conjunto inicial) y autorizó `outcome succeeded` para B1 con lint/build/test verdes y diferencia de size frente a la base menor de 0,1 %, condición que cumplen las mediciones anteriores. Este diagnóstico adicional es evidencia comunicada por el coordinador; la reproducción independiente de B1 acredita el fallo en la base y los deltas. **No se afirma que size pase ni que se cumplan las cuatro verificaciones.** `git diff --check` pasa.

## Navegador y capturas

Chrome headless mediante Playwright, app local en `127.0.0.1:5186`, Supabase local en `127.0.0.1:54321`, cuenta sintética de bodega. Sin operaciones de escritura ni datos de producción. Se abrió un despacho en Despachos y el detalle seleccionado en Devoluciones; Stock se comprobó con filas existentes.

| Vista | 375 px | 768 px | 1280 px |
| --- | --- | --- | --- |
| Despachos expandido | 375 / 375 | 768 / 768 | 1280 / 1280 |
| Devoluciones con detalle abierto | 375 / 375 | 768 / 768 | 1280 / 1280 |
| Stock | 375 / 375 | 768 / 768 | 1280 / 1280 |

Celdas: `document.documentElement.scrollWidth / innerWidth`. A 375 px el detalle de Devoluciones mantiene scroll interno en productos y envases (regiones de 299 px, contenido mayor), sin ensanchar el documento. Una prueba adicional interceptó sólo la respuesta de vendedores en el navegador para introducir un nombre largo: antes del límite del filtro medía 845/375; después ambas páginas miden 375/375. Cero excepciones de página en la pasada normal.

Se conservaron seis capturas de después, todas menores de 300 KB; las de Devoluciones muestran el detalle seleccionado, desplazando verticalmente la vista en móvil:

- [Despachos, 375](capturas/b1-despachos-bodega-375.png), [768](capturas/b1-despachos-bodega-768.png), [1280](capturas/b1-despachos-bodega-1280.png).
- [Devoluciones, 375](capturas/b1-devoluciones-bodega-375.png), [768](capturas/b1-devoluciones-bodega-768.png), [1280](capturas/b1-devoluciones-bodega-1280.png).

## Pendientes y límites

- **A1-08 diferido expresamente:** no se añade paginación ni se restringe el rango histórico de consultas.
- **Size pendiente de B6:** excepción de entrega B1 autorizada por el coordinador; B6 debe resolver la distribución/medición de chunks antes de aceptar la fase con cuatro verificaciones verdes.
- No se ejecutó `npm run test:integration`, reservado al coordinador. La comprobación visual corresponde al rol bodega; las carreras y cambios de identidad se prueban con Testing Library, incluyendo perfil administrador.
- No se cambió SQL, esquema, RLS, rutas, componentes/lib compartidos, presupuestos ni configuración. Sólo se modificó el dominio bodega y los artefactos de entrega autorizados. `.env.local` queda ignorado.
- Commits locales; sin push, merge ni PR, sin crear/cerrar issues de Beads. Los hooks de commit funcionaron y exportaron el tracker existente; no se omiten hooks.
