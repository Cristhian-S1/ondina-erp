# FX — Correcciones de revisión R1 y R2

Fecha: 2026-10-14. Beads: `OND-c07.12`. Rama: `Cristhian-S1/fux-b1-bodega`. Base: `ca44d3c` (`origin/feature/frontend-ux` al comenzar).

Implementación limitada a `frontend/src/domains/bodega/**` y `frontend/src/domains/produccion/**`. El coordinador autorizó explícitamente este informe, hasta ocho capturas `fx-*.png` y `frontend/.env.local` ignorado mediante la respuesta `msg_53f4cb7385cf`. Sin push, merge, PR, SQL, migraciones, cambios de permisos/rutas ni modificación del presupuesto de bundle; no se crearon ni cerraron issues.

## Hallazgos resueltos

| ID | Resultado | Commit |
| --- | --- | --- |
| R1-01 | Validación, stock insuficiente y errores de RPC se presentan con `role="alert"` dentro del Dialog. Abrir/cerrar limpia el error; cerrar se bloquea durante el envío. | `d8ff596` |
| R1-02 | Un fallo de refetch conserva lista, detalle, controles y borrador cuando existen datos. Aviso no bloqueante con Reintentar, también dentro del modal abierto. El catálogo de sucursales conserva el ámbito al fallar después de cargar. El primer fallo sin datos sigue mostrando error de carga. | `d8ff596` |
| R1-03 | Etiquetas visibles Producto, Cantidad y Bandejas en el modal. | `d8ff596` |
| R1-04 | `staleTime: 30_000` en datos y catálogo de sucursales: el foco dentro de ese intervalo reutiliza los datos; los refetch explícitos siguen disponibles. | `d8ff596` |
| R1-05/06 | El selector se deshabilita mientras crear despacho, registrar devolución o corregir devolución están en vuelo. El subárbol conserva la clave y recibe el resultado; la prueba comprueba reutilización de clave tras error y reintento. | `d8ff596` |
| R1-07 | Sólo administrador consulta sucursales; bodega con sucursal asignada entra directamente aunque ese catálogo falle. | `d8ff596` |
| R1-08 | Copy corregido a «las devoluciones». | `d8ff596` |
| R1-09 | Los tres fallbacks de Suspense usan `EstadoVista`. | `d8ff596` |
| R1-10 | Textos pequeños pasan a slate-600, amber-700 y emerald-700; badge Llegada usa emerald-700 con blanco. Medición de los colores computados: slate-600/blanco 7,58:1, amber-700/blanco 5,03:1, emerald-700/blanco 5,36:1; supera 4,5:1 en los usos señalados. | `d8ff596` |
| R1-11 | Botón de despacho con `aria-expanded` y `aria-controls` enlazado al detalle. | `d8ff596` |
| R1-13 | Tablas de productos/envases se convierten en tarjetas bajo 640 px mediante CSS en un único árbol; etiquetas de celda visibles y roles de tabla explícitos, sin duplicar inputs. | `d8ff596` |
| R2-01 | Primera carga usa `isPending`. Un refetch pendiente conserva el nodo/lista y las métricas de Historial, Indicadores y secciones de producción; `aria-busy` y «Actualizando...» indican el trabajo en segundo plano. Se mantiene el error explícito al terminar un refetch fallido en producción, conforme al contrato A1-05 existente. | `6735cc5` |
| R2-02 | Los límites Desde/Hasta representan jornadas de America/Santiago y se envían como instantes UTC explícitos. Se busca el primer instante del día local; el final es el primer instante del día siguiente menos 1 ms, incluyendo jornadas de 23/25 horas. | `6735cc5` |
| R2-03 | Errores de validación persisten junto a producto/cantidad de producción, descripción de incidencia y producto/cantidad/motivo de merma. `aria-invalid`, `aria-describedby`, ID y `role="alert"` vinculan campo/mensaje; editar limpia el error correspondiente. El Toast se conserva y su cierre no elimina el mensaje del campo. | `6735cc5` |
| R2-05 (P3) | Roles `table`, `rowgroup`, `row`, `columnheader` y `cell` explícitos; encabezado accesible con `sr-only` en móvil, etiquetas visuales de tarjeta excluidas del nombre por duplicación. | `6735cc5` |
| R2-06 (P3) | Administrador con sucursal asignada empieza en ella; administrador global mantiene selección vacía explicativa. | `6735cc5` |
| R2-07 (P3) | Selector bloqueado mientras cualquiera de las tres escrituras está en vuelo; prueba de resultado notificado antes de permitir otro ámbito. Se conserva el indicador compartido de guardado. | `6735cc5` |
| R2-10 (P3) | Nombres faltantes en Historial/Indicadores/listas muestran «Nombre no disponible» para expresar el dato incompleto. El error de catálogo permanece explícito. | `6735cc5` |

## Parciales y diferidos

- **R2-04: no implementado, por instrucción.** Registrar producción sigue siendo un insert sin idempotencia de backend. Una respuesta perdida puede duplicar producción/stock al reintentar; requiere RPC/contrato backend y queda fuera de esta propiedad. Deshabilitar controles durante el envío no resuelve esa condición.
- **R2-12: parcial.** El nombre «Actualizar lista» aclara el alcance. Se conserva su posición actual; moverlo a la cabecera requiere coordinar el control padre y queda diferido como pulido.
- **R1-05:** se adoptó la opción autorizada de bloqueo durante la RPC. No se agregó persistencia durable de claves entre recargas, navegación o cambios de sucursal posteriores a una respuesta desconocida.
- **R1-12:** refactor amplio del modal/filtros y eliminación de duplicaciones diferido; no era corrección obligatoria de FX.
- **R1-14:** los datos sintéticos aún contienen vendedores no disponibles. No se cambian filtros de identidad/actividad ni se consulta producción para discriminar el origen.
- **R2-08/09/11/13:** props/claves heredadas, jornada de Indicadores al dejar la pestaña abierta a medianoche, secuenciación de canales Realtime y refactor común de formularios quedan diferidos para evitar ampliar el lote. Las pruebas actuales de suscripción y aislamiento siguen verdes.
- **A1-08:** paginación/separación de lecturas continúa diferida; `staleTime` reduce refetch repetidos, no limita el volumen de una consulta.

## Regresión y ciclo TDD

Primero se añadieron y ejecutaron pruebas que fallaban sobre la base: 12 fallos en R1-01/02/03/05/07 y R2-01/02/03. Después se implementaron las correcciones. El caso adicional del catálogo de sucursales y el modo tarjeta de devoluciones también se ejecutaron en rojo antes de corregirlos.

- `Despachos.test.tsx`: alert dentro del diálogo y etiquetas visibles; lista/modal/borrador conservados tras fallo; ámbito bloqueado durante RPC y misma clave en reintento; bodega sin catálogo de sucursales; ámbito conservado ante fallo del catálogo; foco dentro de 30 segundos sin repetir lecturas.
- `Devoluciones.test.tsx`: detalle/input conservados al fallar; misma celda/control en tarjeta; selector bloqueado durante RPC.
- `api.test.ts` de producción: invierno, jornada de octubre con registro a las 22:00 Santiago, hora repetida del 4 de abril y medianoche omitida del 6 de septiembre; límites UTC exactos.
- `EstadosProduccion.test.tsx`: Historial/Indicadores conservan nodos y números mientras hay refetch pendiente; los ensayos existentes mantienen el comportamiento explícito ante error terminado.
- `Produccion.branch.test.tsx`: lista de incidencias conservada; validaciones de los tres formularios asociadas al campo y persistentes después de cerrar o autocerrar Toast; cantidad/motivo se limpian al editar; sucursal propia inicial y bloqueo durante escritura.
- Se ajustaron los ensayos anteriores que exigían selección vacía para todo administrador o desaparición de toda validación con el Toast, pues contradicen los nuevos criterios; los ensayos de foco ahora simulan caché vencida.

## Cuatro verificaciones finales

Ejecutadas desde `frontend/`, con **Node 22.23.3**, `frontend/.env.local` ignorado apuntando a Supabase local `127.0.0.1:54321` y su ANON_KEY local. Los cuatro comandos terminaron con código 0:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Sin errores. |
| `npm run build` | TypeScript y Vite verdes. Aviso existente `INEFFECTIVE_DYNAMIC_IMPORT` de `lib/dashboard.ts`; no impide la compilación y está fuera de propiedad. |
| `npm run size` | Cinco métricas OK, sin modificar límites. |
| `npm run test` | **646/646 pruebas, 51/51 archivos**. |

| Métrica de bundle | Actual (bytes) | Límite (bytes) |
| --- | ---: | ---: |
| JS de entrada gzip | 102.169 | 105.567 |
| CSS de entrada gzip | 44.054 | 47.853 |
| Chunk JS mayor sin comprimir | 323.505 | 332.108 |
| JS inicial total gzip | 158.867 | 174.765 |
| CSS inicial total gzip | 44.054 | 48.053 |

## Verificación visual local

Chrome headless/Playwright sobre Vite dev local, cuenta sintética administrador global y Sucursal Sintética A. No se escribieron operaciones en base: el despacho vacío y la incidencia vacía sólo activan validación cliente. Sin errores JavaScript en los doce escenarios; tablas comprobadas `block` a 375 y `table` desde 768. Alert del despacho visible y comprobado mediante `elementFromPoint` dentro del diálogo en los tres anchos.

| Vista y estado | 375: scrollWidth/innerWidth | 768 | 1280 |
| --- | --- | --- | --- |
| Despachos, modal y error abiertos | 375/375 | 768/768 | 1280/1280 |
| Devoluciones, detalle abierto con productos/envases | 375/375 | 768/768 | 1280/1280 |
| Producción · Historial, registros visibles | 375/375 | 768/768 | 1280/1280 |
| Producción · Incidencias, error persistente tras cerrar Toast | 375/375 | 768/768 | 1280/1280 |

Ocho capturas, todas inferiores a 300 KB. Para respetar el máximo, Historial/Incidencias a 768/1280 se verificaron y revisaron sin añadir más imágenes al repositorio:

- [Despachos 375](capturas/fx-despachos-admin-global-375.png), [768](capturas/fx-despachos-admin-global-768.png), [1280](capturas/fx-despachos-admin-global-1280.png).
- [Devoluciones 375](capturas/fx-devoluciones-admin-global-375.png), [768](capturas/fx-devoluciones-admin-global-768.png), [1280](capturas/fx-devoluciones-admin-global-1280.png).
- [Historial 375](capturas/fx-produccion-historial-admin-global-375.png).
- [Incidencias 375](capturas/fx-produccion-incidencias-admin-global-375.png).

Límites: no se ejecutó `npm run test:integration`; no se verificó producción ni el preview con CSP; las carreras de RPC y refetch se verificaron mediante pruebas con promesas controladas, no mediante escrituras en navegador; no se realizó una auditoría completa con lector de pantalla. `.env.local` está ignorado y no forma parte de los commits.
