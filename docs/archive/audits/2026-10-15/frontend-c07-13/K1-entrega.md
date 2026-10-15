# K1 · Entrega Bodega: R1-12 y R2-13

Fecha: 2026-10-15 (America/Santiago). Beads: `OND-c07.13`. Task: `task_514e5c784c09`. Dispatch: `ctx_2387cbeb58b9`.
Base verificada: `69070fc`. Rama: `Cristhian-S1/k1-bodega`. Cuenta visual: `ux-bodega@example.invalid`, Supabase local.

## Resultado

R1-12 y R2-13 completados en el alcance de Bodega. `Despachos.tsx` pasa de **776 a 85 líneas** (−691, −89,0 %), por debajo de 300. La extracción mantiene los textos, controles, IDs de control, roles, comportamiento del foco, filtros, ámbito y contratos existentes. Las 12 capturas de control tras el refactor, antes de aplicar R2-13, resultaron **idénticas píxel a píxel** a las 12 previas.

Todos los campos de los formularios indicados usan directamente `components/CampoFormulario.tsx`, incluyendo los que contienen `InputNumerico`. Los errores de vendedor, producto, cantidad y bandejas del despacho quedan bajo su campo, enlazados por ARIA y persistentes hasta corregir/editar; los errores generales de lectura o mutación conservan su resumen. Las cantidades de devolución mantienen validación en vivo; el exceso de envases sigue siendo advertencia permitida, con confirmación antes del envío.

## Commits locales y orden de integración

1. `16a2bd3` — `refactor(bodega): extract dispatch history and new dispatch dialog` (R1-12, sin cambio de comportamiento).
2. `ac666f0` — `feat(forms): support stable field IDs and additional descriptions` (extensión compartida autorizada, sus pruebas y una frase de documentación).
3. `d61800e` — `fix(bodega): link dispatch and return field labels and errors` (R2-13, más seis regresiones DOM de Bodega).
4. El commit de este informe y sus ocho capturas se identifica como `docs(bodega): record K1 validation and viewport evidence` en el historial local.

No hay push, merge ni PR. El coordinador integra mediante cherry-pick en este orden; la extensión compartida precede a sus consumidores de Bodega.

## Propiedad y autorización adicional

La implementación propia está en `frontend/src/domains/bodega/**`. La única ampliación está expresamente autorizada por el coordinador: mensaje `msg_b616d801b655` del 2026-10-15 11:13:42 CL y respuesta al `orchestration ask` sobre `alerta`.

La autorización permite `components/CampoFormulario.tsx`, su nueva prueba `components/CampoFormulario.test.tsx` y una frase en `docs/engineering/frontend.md`. Se añadieron exclusivamente props opcionales `id?: string`, `descripcionId?: string` y `alerta?: boolean` (false por defecto). El comentario documenta las tres; sin ellas se conservan IDs generados, clases y marcado. No quedó ningún wrapper duplicado en Bodega. Las pruebas existentes de Ventas/Producción no se editaron.

## Mapa de componentes y líneas

Las rutas abreviadas `bodega/` corresponden a `frontend/src/domains/bodega/`.

| Archivo | Antes (69070fc) | Después | Responsabilidad |
| --- | ---: | ---: | --- |
| `bodega/pages/Despachos.tsx` | 776 | 85 | Orquestación: ámbito, recursos, filtros, paginación y coordinación del modal. |
| `bodega/components/FiltrosHistorialDespachos.tsx` | — (nuevo) | 82 | Filtros de día/fecha/vendedor y reinicio de la expansión. |
| `bodega/components/HistorialDespachos.tsx` | — (nuevo) | 125 | Lista responsive única, avatar, totales, expansión y llegada. |
| `bodega/components/DetalleDespacho.tsx` | — (nuevo) | 131 | Detalle de productos/envases y devoluciones; enlace a registrar devolución. |
| `bodega/components/DevolucionesHistorialDespachos.tsx` | — (nuevo) | 111 | Agrupación y panel lateral de devoluciones de esta página. |
| `bodega/components/ModalNuevoDespacho.tsx` | — (nuevo) | 327 | Borrador, validación, foco, bandejas, reintento idempotente y envío. |
| `bodega/components/despachos.types.ts` | — (nuevo) | 6 | Tipos derivados de los contratos de recursos/historial, sin nuevos servicios. |
| `bodega/components/LineaDespacho.tsx` | 86 | 87 | Producto/cantidad con CampoFormulario e InputNumerico. |
| `bodega/pages/Devoluciones.tsx` | 575 | 579 | Campos de devolución de productos y envases dentro de SeccionDevolucion. |
| `components/CampoFormulario.tsx` | 24 | 31 | Extensión aditiva autorizada: id, descripcionId y alerta. |

La lista original ya usaba tarjetas/lista responsive para todas las anchuras; se conserva ese único árbol DOM. No se introduce una segunda tabla ni se duplican controles. `SeccionDevolucion.tsx` continúa como contenedor semántico de las secciones Productos/Envases: los nuevos campos se integran en sus hijos desde `Devoluciones.tsx`, sin modificar sus encabezados ni su contrato.

En el original, filtros comienzan en `Despachos.tsx:371`, lista en `:426`, detalle en `:481`, panel lateral en `:603` y modal en `:647`. El estado/registro del borrador estaba desde `:96`; ahora pertenece al modal, que permanece montado al cerrarlo para conservar el borrador y la clave de reintento.

`useDatosBodega`, `usePaginaBodega`, `filtrosHistorial`, `AmbitoBodega`, servicios y tipos de base de datos no se modificaron. La página conserva las claves y los filtros del hook, la paginación de servidor, el bloqueo del ámbito durante un envío y la actualización posterior a un registro. La API de presentación deriva los tipos de los hooks con `import type`, sin otro cliente Supabase.

## Accesibilidad y validación

- Despacho: label explícito para vendedor, producto, cantidad y bandejas. IDs de control conservados (`despacho-vendedor`, `despacho-producto-<id>`, `despacho-cantidad-<id>`, `despacho-bandejas`). Los errores ahora se enlazan al párrafo `<id>-error` del propio campo; el resumen `error-despacho` permanece para errores generales.
- Producto del despacho conserva la ayuda de disponibilidad enlazada, independiente de la etiqueta. `InputNumerico` recibe los atributos del campo compartido; `CampoFormulario` es el único dueño del párrafo de error, evitando duplicar mensajes.
- Devolución de producto: label visible «Cantidad a devolver», ID de control previo y nombre accesible con el producto. `aria-describedby` mantiene `ayuda-devolucion-cantidad` y añade el error cuando corresponde.
- Envases: labels visibles «Buenos»/«Malos», IDs explícitos por tipo/estado y nombres accesibles originales. La advertencia suma buenos y malos, se anuncia con `role="status"` y describe ambos campos. Conserva `aria-invalid="false"`, cantidades libres y botón habilitado; requiere la confirmación existente.
- El foco inicial sigue en Vendedor; enviar datos incompletos enfoca el primer campo señalado. Escape devuelve el foco al botón Nuevo despacho. Editar o quitar una línea descarta el error de envío anterior; la validación en vivo se recalcula con los valores vigentes.

## Pruebas y verificaciones

Comandos finales ejecutados desde `frontend/`, Node 22.23.3; todos los gates finales sobre el código de `d61800e` pasan.

| Verificación | Resultado |
| --- | --- |
| Base, `npx vitest run src/domains/bodega/pages/Despachos.test.tsx` | 31/31 antes de editar |
| R1-12, mismo comando sin editar el archivo de pruebas | 31/31 |
| Regresiones DOM R2-13 antes de corregir | 4 fallos / 56 verdes; vendedor sin htmlFor, error de producto fuera del grupo, producto/envases de devolución sin label enlazado |
| Caso de envío sin líneas después de quitar la última | 1 fallo antes de corregir; el resumen general vuelve a ser visible tras la corrección |
| Extensión compartida antes de corregir | 2 fallos / 1 verde (id externo y descripción adicional ignorados) |
| Extensión + pruebas Ventas/Producción | 383/383, 37 archivos |
| Bodega + CampoFormulario tras migración | 157/157, 10 archivos |
| `npm run lint` | PASS, salida 0 |
| `npm run build` | PASS, salida 0, TypeScript estricto |
| `npm run size` | PASS, las 5 métricas dentro del presupuesto |
| `npm run test` | **810/810, 70 archivos**, salida 0 |
| Suite sin `.env.local` | **810/810, 70 archivos**, salida 0; archivo restaurado |
| `git diff --check` | PASS |
| Conservación de pruebas existentes | Los archivos de Despachos/Devoluciones mantienen byte a byte el contenido de `69070fc` como prefijo; sólo se añaden pruebas |

Las verificaciones preliminares usaron el Node 26.3.1 del shell; al detectar la diferencia con `.nvmrc` se repitieron los cuatro gates y la suite sin entorno con Node 22.23.3, usando la instalación local en el PATH.

Se añadieron seis pruebas DOM de Bodega y cinco casos para la extensión compartida: labels estables, estado inválido, IDs de descripciones que resuelven al mensaje, error local visible, corrección sin remount/pérdida de foco y advertencia permitida para envases. Las aserciones de comportamiento existentes permanecen intactas.

Para aislar CI se movió temporalmente el archivo de entorno con restauración mediante `trap`:

```bash
backup_env=$(mktemp /tmp/k1-env.XXXXXX)
mv .env.local "$backup_env"
trap 'mv "$backup_env" .env.local' EXIT
npx vitest run
```

El CSS de entrada e inicial sigue en **8.405 B gzip**, límite **9.246 B**, sin incremento. JS de entrada 91.395 B, JS inicial 149.353 B; chunk mayor sin comprimir 294.375 B, todos dentro de sus límites. No se modificaron CSS ni presupuestos.

## Evidencia visual por viewport

Navegador real: Playwright con `/usr/bin/google-chrome`, `http://127.0.0.1:5188`, `locale=es-CL`. Antes: base `69070fc`, capturada antes de cualquier modificación de código. Después: implementación final con componente compartido. Se revisaron las imágenes y se midieron controles visibles en main/modal, excluyendo los árboles inertes.

Cada PNG compuesto contiene **tres paneles sin reescalar**, de izquierda a derecha: lista de Despachos, modal abierto con error de Vendedor, Devoluciones con error en vivo de producto. El panel de Devoluciones se desplaza a Productos del despacho para mostrar los campos. Así se conservan las **24 vistas exigidas en 8 archivos**, dentro del máximo de 12; el PNG compuesto es más ancho que el viewport y no implica desborde de la aplicación. Sólo se cuantizó la paleta para reducir tamaño; se conservaron las dimensiones de cada viewport, sin reescalar ni recortar.

| Viewport | Antes: lista/modal/devoluciones | Después: lista/modal/devoluciones | scrollWidth antes/después | Controles visibles <44 px |
| --- | --- | --- | --- | --- |
| 412×915 | PASS / PASS / PASS | PASS / PASS / PASS | 412 / 412 en las tres vistas | 0 / 0 |
| 768×1024 | PASS / PASS / PASS | PASS / PASS / PASS | 768 / 768 en las tres vistas | 0 / 0 |
| 1024×1366 | PASS / PASS / PASS | PASS / PASS / PASS | 1024 / 1024 en las tres vistas | 0 / 0 |
| 1280×800 | PASS / PASS / PASS | PASS / PASS / PASS | 1280 / 1280 en las tres vistas | 0 / 0 |

En una segunda pasada se verificaron **32 escenarios de campo** (8 por viewport): vendedor requerido, producto requerido, cantidad requerida, exceso de cantidad, exceso de bandejas, exceso de producto devuelto, envases buenos y envases malos. Se comprobaron label, `aria-invalid`, descripciones existentes y foco para los tres errores de envío. En los cuatro tamaños también se comprobó que enviar tras quitar todas las líneas mantiene el error general visible, sin enviar la operación. Se expandió el detalle del historial, se cerró el modal con Escape y se recorrió la confirmación de envases con Volver a revisar, conservando el borrador. En todos los viewports, `document.documentElement.scrollWidth <= innerWidth`; también `dialog.scrollWidth <= dialog.clientWidth` en modal y confirmación.

Ninguna de las pasadas finales registró errores de consola/JavaScript ni escrituras REST de dominio. La autenticación local y el RPC de lectura `vendedores_sucursal` están excluidos del contador de escrituras. Los errores fueron provocados sólo en el navegador; no se registraron despachos ni devoluciones.

| Captura | Bytes |
| --- | ---: |
| [despachos-modal-devoluciones-1024x1366-antes.png](capturas/K1/despachos-modal-devoluciones-1024x1366-antes.png) | 102941 |
| [despachos-modal-devoluciones-1024x1366-despues.png](capturas/K1/despachos-modal-devoluciones-1024x1366-despues.png) | 106960 |
| [despachos-modal-devoluciones-1280x800-antes.png](capturas/K1/despachos-modal-devoluciones-1280x800-antes.png) | 91052 |
| [despachos-modal-devoluciones-1280x800-despues.png](capturas/K1/despachos-modal-devoluciones-1280x800-despues.png) | 93452 |
| [despachos-modal-devoluciones-412x915-antes.png](capturas/K1/despachos-modal-devoluciones-412x915-antes.png) | 56979 |
| [despachos-modal-devoluciones-412x915-despues.png](capturas/K1/despachos-modal-devoluciones-412x915-despues.png) | 60001 |
| [despachos-modal-devoluciones-768x1024-antes.png](capturas/K1/despachos-modal-devoluciones-768x1024-antes.png) | 79486 |
| [despachos-modal-devoluciones-768x1024-despues.png](capturas/K1/despachos-modal-devoluciones-768x1024-despues.png) | 79591 |

## Límites y entrega

La validación es local con datos sintéticos existentes y la cuenta Bodega; no acredita producción ni la BD remota. La lista visible de esta cuenta tenía un despacho en el día actual: no se afirma navegación real a una segunda página en el navegador; el contrato de paginación y sus regresiones se mantienen y la suite completa pasa. La aceptación de K1 no incluye la integración ni `test:integration`, reservado al coordinador y no ejecutado.

No se tocó SQL, `supabase/`, `.opencode/`, datos de negocio ni secretos versionados. El `.env.local` local preexistente se restauró después de las comprobaciones sin entorno. Los límites pendientes de `OND-c07.13` ajenos a K1 (por ejemplo R1-14/backend y trabajos de otros dominios) siguen bajo responsabilidad del coordinador; no se cierra el ticket conjunto desde este worker.

Los únicos archivos fuera de Bodega son la ampliación compartida autorizada, su prueba, la frase de documentación y este informe/capturas. El cierre se entrega mediante un único `worker_done` con task/dispatch reales, resultado `succeeded`, archivos modificados e informe persistente.
