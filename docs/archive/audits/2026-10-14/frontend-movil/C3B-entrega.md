# C3-B · Bodega: entrega y verificación

Fecha de ejecución: **15-10-2026**, America/Santiago. Auditoría de referencia: [C3-barrido-final.md](C3-barrido-final.md), C3-03/04/05.
Rama: `Cristhian-S1/c3b-bodega`. Base realmente recibida: `942a5b5cd9628a02973366603b3f4f7d4a13a7cb` (incluye el informe C3), posterior al `4809b1a` mencionado en el despacho.
Task `task_3c6ced253b63`, Dispatch `ctx_0ecc26d13e8c`.

## Resultado

- **C3-03 corregido:** cantidad con ancho suficiente para `9.999.999` y dos flechas de 44 × 44 px. En contenedores angostos, disponibilidad y carga aparecen sobre el campo.
- **C3-04 corregido:** conteo/estado pasan a otra fila del encabezado cuando la sección mide menos de 32rem. El producto ya devuelto muestra `Devuelto 1`, conserva `Despachado 2` y oculta `Disponible`; las filas editables conservan su disponibilidad y validación.
- **C3-05 reclasificado, con aceptación del coordinador:** **no reproducido para vendedores activos**. Valentina se resolvía correctamente en la base recibida. Se añadió cobertura del catálogo tardío y del detalle individual, y se corrigió el fallback para vendedores ausentes del catálogo: `Vendedor no disponible (#693c941e)`, avatar neutro `?`, decorativo y oculto para lectores de pantalla. El identificador puede envolver en las listas estrechas.

## C3-05: investigación de causa raíz

La premisa del despacho atribuía a un bug frontend los 302 despachos de Valentina. La reproducción independiente mostró otra causa para los registros con fallback:

1. Con `ux-bodega@example.invalid`, la respuesta real de `POST /rest/v1/rpc/vendedores_sucursal` incluye `Valentina Rojas`, ID `c5dabc9c-80cb-48fa-ac3f-0960ac71cd72`, y al vendedor fixture `20000000-0000-0000-0001-000000000004`.
2. Los cuatro despachos de Hoy visibles al comenzar el 15-10 pertenecían a `693c941e-1e31-44f2-9d95-32df73b7f0dc` y `18e82542-4fb9-4037-9b34-ecf34ef075c2`. **No eran despachos de Valentina** y ninguno de esos IDs estaba en la respuesta de la RPC. Durante la ejecución otros ensayos locales añadieron dos registros de otro vendedor sintético; no los creó este worker.
3. Con `ux-admin`, filtro `Valentina Rojas` y `Todo`, la UI de la base original mostró **302 registros, nombre Valentina Rojas y avatar VR**. La coincidencia de ID entre RPC e historial es exacta.
4. El flujo no pierde el catálogo: `api.ts:53` → `useDatosBodega.ts` → `Despachos.tsx:89/114` o `Devoluciones.tsx:59/69` → `usePaginaBodega.ts:56`. El mapa se construye en cada render; el enriquecimiento se aplica tanto a la lista como a `individual` (`usePaginaBodega.ts:71/72`), después de leer la caché. No congela los nombres en la respuesta inicial de la consulta.
5. El coordinador corrigió expresamente su hipótesis mediante la respuesta a `orchestration ask`: los IDs ausentes corresponden a vendedores sintéticos **inactivos de test:integration**, excluidos por diseño. Autorizó documentar el caso activo como no reproducido, protegerlo con pruebas y corregir el fallback.

**Causa del síntoma observado:** despachos históricos de vendedores excluidos del catálogo activo; el frontend generaba las iniciales `VN` a partir del texto de fallback. No se encontró una causa frontend que impidiera resolver a Valentina. No se modificó la RPC, no se amplió acceso a perfiles ni se inventaron nombres/estados de vendedores. La exposición de nombres históricos de inactivos sigue siendo la limitación R1-14 fuera de este lote.

La verificación final repitió las dos vistas con los tres roles:

| Cuenta | Despachos | Devoluciones | Detalle fuera de la página visible |
| --- | --- | --- | --- |
| ux-bodega | 302 registros; 20 filas visibles de Valentina | 302; nombre correcto | Conserva `Devolución de Valentina Rojas` al pasar a página 2 |
| ux-admin | 302; nombre correcto | 302; nombre correcto | Conservado |
| ux-admin-global, Sucursal Sintética A | 302; nombre correcto | 302; nombre correcto | Conservado |

Bodega sólo ofrece Hoy: se fijó **el reloj del navegador** al 14-10-2026 20:50 de Santiago para leer los despachos de esa jornada. Para administradores se usó Todo con el reloj real. No se cambió el reloj del sistema ni se alteraron fechas en la BD.

## Archivos y cambios

Todos los cambios de aplicación y pruebas están bajo `frontend/src/domains/bodega/`:

| Archivo | Cambio |
| --- | --- |
| `components/LineaDespacho.tsx:38/65/78` | Container query; cantidad de 13rem, disponibilidad encima cuando no caben lado a lado. Un único control numérico. |
| `components/SeccionDevolucion.tsx:39` | Grupo de conteo/estado con `basis-full` bajo `@lg`, alineado con el título. |
| `pages/Devoluciones.tsx:402/453/470` | Fallback que envuelve, badge sin compresión, disponibilidad sólo al editar y etiqueta explícita de devolución. |
| `hooks/usePaginaBodega.ts:59` | ID corto en fallback y `vendedorDisponible` para distinguir nombres reales de texto sustitutivo. |
| `pages/Despachos.tsx:58/452` | Avatar neutro para vendedor ausente; iniciales reales para nombres disponibles. |
| `pages/Despachos.test.tsx:161` | Regresión: ID del vendedor ausente y avatar neutro, sin VN. |
| `pages/Devoluciones.test.tsx:131` | Regresión: `Devuelto 1`, sin Disponible ni input para producto ya devuelto en Bodega. |
| `hooks/usePaginaBodega.test.tsx:15` | Catálogo posterior al historial: resuelve Valentina en lista y detalle fuera de página, y vuelve al fallback al retirar el catálogo. Se completó el ID de vendedor de un fixture existente de paginación. |
| `c3b.visual.mjs` | Ensayo real local con Chrome/Playwright: cinco viewports, dimensiones de texto/campo, título, devolución, avatar, controles ≥44 px, overflow, errores de navegador y ausencia de mutaciones de negocio. |

## Pruebas y controles

La fase roja de las nuevas pruebas de página produjo **2 fallos esperados y 56 pruebas correctas**: faltaban el ID/avatar neutro y `Devuelto 1`. La prueba del vendedor activo con catálogo tardío **ya pasaba antes del cambio**; es cobertura de un comportamiento existente, no evidencia de una corrección frontend inexistente. La medición original de C3-03 demostró el recorte: 38 px útiles para un texto de 63,56 px.

Desde `frontend/`, resultado final:

| Control | Resultado |
| --- | --- |
| `npm run lint` | PASS |
| `npm run build` | PASS, TypeScript y Vite |
| `npm run size` | PASS, cinco métricas dentro de presupuesto |
| `npm run test` | **774/774**, 64 archivos |
| `npm run test -- src/domains/bodega` | **143/143**, 9 archivos |
| `git diff --check` | PASS |
| Chrome real, `c3b.visual.mjs despues` | PASS, cinco viewports, 0 errores de consola/página/peticiones fallidas y 0 mutaciones REST de negocio |

El shell inicial usa Node 26.3.1; los cuatro controles completos también se ejecutaron con **Node 22.23.3** mediante `npm exec --yes --package=node@22 -- sh -c 'node --version && npm run lint && npm run build && npm run size && npm run test'`, para respetar `.nvmrc`.

Bundle final: entrada JS gzip `91.391`, entrada CSS gzip `8.028`, mayor chunk JS `294.375`, JS inicial total gzip `149.349`, CSS inicial total gzip `8.028` (bytes, separador de miles es-CL y base `c2bcd87` del verificador; todos OK).

Repetición visual desde `frontend/`, con Vite local en 5183 y Playwright disponible:

```bash
npm run dev -- --host 127.0.0.1 --port 5183
# In another terminal; the module path can be changed to the local installation.
C3B_PLAYWRIGHT_MODULE=/home/cristhian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node src/domains/bodega/c3b.visual.mjs despues
```

El ensayo usa el despacho sintético existente `753b571b-5419-490f-a160-c67b4df04a6d`; requiere esa fixture y su jornada visible para Bodega. No crea datos. `antes` permite capturar la base y termina con fallo de las aserciones si los defectos siguen presentes. La salida geométrica se guarda en `/tmp/c3b-<fase>.json`; el directorio de capturas está acotado a los diez nombres siguientes.

## Evidencia por viewport

Campo: mismo `9.999.999`, ancho total **64 → 112 px**, área útil **38 → 86 px**, texto requerido **63,56 px** en los cinco viewports. Flechas de 44 × 44 px. Todos los controles visibles de main/modal medidos cumplen ≥44 px; los avatares son decorativos.

| Viewport | Título de Productos, antes → después | Overflow horizontal después | Evidencia persistida |
| --- | --- | --- | --- |
| 375×812 | 3 → 1 líneas | 375 ≤ 375 | Ensayo geométrico, sin captura adicional por límite de 10 |
| 412×915 | 2 → 1 líneas | 412 ≤ 412 | Modal y devolución, antes/después |
| 768×1024 | 1 → 1 líneas | 768 ≤ 768 | Modal, antes/después |
| 1024×1366 | 3 → 1 líneas | 1024 ≤ 1024 | Devolución, antes/después |
| 1280×800 | 1 → 1 líneas | 1280 ≤ 1280 | Lista/fallback, antes/después |

Diez PNG optimizados sin cambiar dimensiones, **50.946–191.067 bytes**, cada uno <200.000 bytes:

| Vista | Antes | Después |
| --- | --- | --- |
| Despacho 412×915 | [antes](capturas/C3B/despacho-modal-412x915-antes.png) | [después](capturas/C3B/despacho-modal-412x915-despues.png) |
| Despacho 768×1024 | [antes](capturas/C3B/despacho-modal-768x1024-antes.png) | [después](capturas/C3B/despacho-modal-768x1024-despues.png) |
| Devolución 412×915 | [antes](capturas/C3B/devolucion-412x915-antes.png) | [después](capturas/C3B/devolucion-412x915-despues.png) |
| Devolución 1024×1366 | [antes](capturas/C3B/devolucion-1024x1366-antes.png) | [después](capturas/C3B/devolucion-1024x1366-despues.png) |
| Despachos 1280×800 | [antes](capturas/C3B/despachos-1280x800-antes.png) | [después](capturas/C3B/despachos-1280x800-despues.png) |

## Límites y entrega

Chrome headless real con emulación de viewport, no dispositivo físico/teclado virtual ni lector de pantalla. Las capturas muestran la zona del defecto dentro del viewport; no son páginas completas. Se verificó Vite de desarrollo contra Supabase **local**, no un despliegue de producción. No se ejecutó `test:integration`, reservado al coordinador. No se validó una escritura de despacho/devolución: sólo lecturas y edición de borrador sin enviar.

No se tocaron SQL, migraciones, `.opencode/`, la BD remota, otros dominios ni componentes compartidos. `.env.local` se copió del entorno local autorizado y permanece ignorado. Entrega mediante commits locales; sin push, merge ni PR. R1-14 queda pendiente de decisión backend si se requiere mostrar nombres de vendedores inactivos.

Commits de implementación, listos para cherry-pick en este orden:

1. `779536e` — `fix(bodega): clarify unavailable sellers and protect name resolution`.
2. `9ecc0e5` — `fix(bodega): prevent clipped quantities and clarify returned products`.

El commit documental posterior contiene este informe y las diez capturas; su SHA se comunica en la entrega al coordinador.
