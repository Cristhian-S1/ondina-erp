# F2 — Feedback de Bodega: controles numéricos y devolución de envases

Verificado el 2026-10-14, America/Santiago. Beads: OND-c07.17.
Rama de trabajo reutilizada: `Cristhian-S1/fux-f1-numerico`.
Base actualizada mediante `git fetch origin && git reset --hard origin/feature/frontend-ux`: `c366c1322ddadea893ac9a97a8a02e3611956913`.

## Cambios entregados

### Nuevo despacho

La fila Producto/Cantidad ahora usa `items-start`. Cada control tiene su etiqueta explícita por `htmlFor` y la disponibilidad se renderiza fuera de la etiqueta, debajo del selector, enlazada mediante `aria-describedby`. La ayuda no cambia la altura inicial del control vecino; los errores siguen apareciendo debajo del campo y pueden aumentar la altura de la fila. Bajo 640 px los campos se apilan; desde 640 px los dos controles comparten la misma altura superior.

El máximo de líneas es `productos.filter(producto => producto.activo).length`. El botón `+ Agregar producto` se deshabilita al alcanzarlo y enlaza el motivo visible. El handler también comprueba el límite mediante una actualización funcional y el envío vuelve a comprobarlo si el catálogo se redujo. Los productos inactivos no cuentan ni aparecen en las opciones; quitar una línea vuelve a habilitar el botón.

Cantidad y Bandejas usan el `InputNumerico` integrado en F1, con formato de miles, placeholder `0`, botones ±1 de 44×44 px y soporte de ArrowUp/ArrowDown. La cantidad se valida en tiempo real contra el stock de bodega, sumando las líneas del mismo producto; las bandejas, contra el stock de su tipo de empaque. No se pasa el stock como `max`: recortar el valor impediría mostrar el error solicitado. La validación previa al envío se conserva, por lo que un exceso visible no se registra.

### Devoluciones y correcciones

Los campos de productos, envases buenos y envases malos usan `InputNumerico`, incluido el modo de corrección del administrador. Las magnitudes se guardan en el estado como cadenas de dígitos sin puntos y se envían como números; el componente se encarga de la presentación. Se retiraron los antiguos `type="number"` y límites nativos de envases.

El saldo de producto se calcula con `disponibleParaDevolver(despachado, devuelto, esCorreccion)` y se comprueba tanto al escribir como al enviar:

- Una devolución nueva tiene disponible `max(0, despachado - devuelto)`.
- Una corrección reemplaza las devoluciones previas completas, por lo que recupera el saldo que reemplaza: puede corregir hasta el total despachado. Restar nuevamente la devolución anterior rechazaría una corrección válida.

Las sumas de devolución ignoran filas anuladas. Se conserva la regla de edición existente por estado/rol: este cambio no habilita nuevas devoluciones parciales ni modifica permisos. El error de producto aparece inmediatamente debajo, enlazado mediante ARIA; un envío inválido también enfoca ese campo.

## Decisión sobre envases

La devolución de envases puede superar lo despachado y el stock actual de bodega: pueden proceder de clientes. Es el contrato deliberado de `private.insertar_devolucion` en `supabase/migrations/20261013184049_b3_data_integrity.sql:761`, que contiene `No cap on empty containers: these need not originate in this dispatch`. La corrección de la misma migración anula las devoluciones previas antes de insertar su reemplazo, coherente con el saldo recuperado de productos.

Por eso no se bloquea ni se recorta una cantidad de envases por stock/despacho. Se suma Buenos + Malos para cada tipo y, si supera los envases despachados de ese tipo, aparece una advertencia en tiempo real, con `role="status"`, asociada a ambos inputs. Ejemplo probado:

> Devuelves 1.234 envases de Bidón 10L y se despacharon 0. Pueden venir de clientes; revisa las cantidades antes de registrar.

La advertencia no marca el input como inválido ni deshabilita el registro. Al registrar con alguna advertencia se abre el `Dialog` compartido `Confirmar devolución de envases`, que explica el motivo y permite `Volver a revisar` o `Confirmar y registrar` / `Confirmar y guardar corrección`. La API se llama sólo después de confirmar; cancelar o Escape conservan los valores y devuelven el foco al botón de registro. Un reintento con advertencia vuelve a requerir confirmación. Se preservan las claves de idempotencia y se impide un segundo envío mientras la solicitud está en vuelo.

Sólo los envases buenos vuelven al stock según las reglas existentes de la BD; no se modificó SQL ni se reprodujeron movimientos de stock en el frontend.

## Pruebas y verificación

TDD: antes de implementar se ejecutaron las pruebas nuevas. Fallaron por `items-end`, ausencia de límite dinámico, aceptación de letras, ausencia de errores inmediatos y ausencia de advertencia/confirmación; también falló la importación del helper todavía inexistente. Después se adaptaron las pruebas previas al rol `textbox` del componente compartido y sus valores de texto. Dos casos que necesitan dos líneas ahora simulan dos productos activos, y la prueba anterior de reintento sin advertencia incluye un envase despachado para mantener ese escenario.

Pruebas nuevas:

- Estructura con alineación superior, disponibilidad fuera del label y nombre accesible estable de Producto.
- Catálogos de 7 y 10 productos, exclusión de uno inactivo, límite con descripción y habilitación al quitar una línea.
- Letras/pegado/flechas/formato y exceso de stock de producto/bandejas antes de enviar.
- Saldo de devolución nueva y saldo recuperado por corrección.
- Error de devolución de producto inmediatamente al escribir y corrección del error con ArrowDown.
- Suma de Buenos + Malos por tipo, advertencia sin bloqueo y sin tope por stock, cancelación sin perder valores, confirmación y payload real enviado a la API simulada.
- Advertencia cuando se despacharon cero envases y Escape con restauración de foco.
- Corrección de administrador con producto válido y confirmación de envases excedentes.

Última ejecución desde `frontend/`, con `.env.local` de Supabase local:

| Comando | Resultado |
| --- | --- |
| `npx vitest run src/domains/bodega` | PASS: 129 pruebas en 7 archivos. |
| `npm run lint` | PASS. |
| `npm run build` | PASS: TypeScript y Vite. |
| `npm run size` | PASS: cinco métricas OK. |
| `npm run test` | PASS: 720 pruebas en 55 archivos. |
| `git diff --check` | PASS. |

Se conserva el aviso preexistente `INEFFECTIVE_DYNAMIC_IMPORT` de `lib/dashboard.ts`; el build termina correctamente. No se alteraron dependencias ni presupuestos.

| Métrica | Actual, bytes | Presupuesto, bytes | Estado |
| --- | ---: | ---: | --- |
| JS de entrada, gzip | 94.870 | 105.567 | OK |
| CSS de entrada, gzip | 7.389 | 47.853 | OK |
| Mayor chunk JS, sin comprimir | 298.621 | 332.108 | OK |
| JS inicial total, gzip | 151.516 | 174.765 | OK |
| CSS inicial total, gzip | 7.389 | 48.053 | OK |

La búsqueda de `type="number"`, `inputMode="numeric"` y `formatMilesInput` dentro de `frontend/src/domains/bodega` no encuentra controles numéricos anteriores: las cinco ubicaciones editables usan el componente compartido. Los inputs de fecha conservan `type="date"`.

## Revisión visual local

Google Chrome headless mediante Playwright, build en Vite preview `http://127.0.0.1:5184`, Supabase local `http://127.0.0.1:54321`. Cuentas `ux-bodega@example.invalid` y `ux-admin-global@example.invalid`, sucursal sintética A. Como en [F1](F1-entrega.md), el contexto de Playwright usa `bypassCSP: true` para permitir el backend HTTP local que la CSP del preview bloquea; no se editaron las cabeceras ni `vercel.json`.

Se revisaron ambas vistas con ambos roles y las tres anchuras. En cada fila `scrollWidth` es el de `document.documentElement`; también se midió la anchura interior del diálogo abierto.

| Rol | Vista | Viewport / innerWidth | scrollWidth | Resultado |
| --- | --- | ---: | ---: | --- |
| Bodega | Despachos | 375 | 375 | PASS |
| Bodega | Despachos | 768 | 768 | PASS |
| Bodega | Despachos | 1280 | 1280 | PASS |
| Bodega | Devoluciones | 375 | 375 | PASS |
| Bodega | Devoluciones | 768 | 768 | PASS |
| Bodega | Devoluciones | 1280 | 1280 | PASS |
| Admin global | Despachos | 375 | 375 | PASS |
| Admin global | Despachos | 768 | 768 | PASS |
| Admin global | Despachos | 1280 | 1280 | PASS |
| Admin global | Devoluciones | 375 | 375 | PASS |
| Admin global | Devoluciones | 768 | 768 | PASS |
| Admin global | Devoluciones | 1280 | 1280 | PASS |

En Despachos, Producto y Cantidad tienen `top = 336 px` a 768 y 1280 px, aun con disponibilidad y error visibles. A 375 px se apilan (`top = 258` y `358 px`). Los diálogos tienen `scrollWidth = clientWidth`: 343 px en móvil y 512 px en las otras anchuras. Los cuatro botones de paso del modal miden 44×44 px. Las regiones de tabla en Devoluciones conservan su scroll horizontal interno cuando el contenido lo necesita; no producen overflow de la página, y bajo 640 px mantienen el mismo árbol como tarjetas.

En Devoluciones se introdujo una cantidad de producto que excede lo despachado, se comprobó el error y se corrigió con ArrowDown. Se introdujeron 1.234 envases de un tipo con cero despachados, se comprobó `aria-invalid="false"` y la advertencia, se abrió la confirmación y se cerró con Escape, conservando valor y foco. Se comprobó además la confirmación de una corrección administrativa sobre un despacho con devoluciones previas. Cero errores de consola/pageerror, cero HTTP >=400 y cero llamadas de registro/corrección de devolución durante esta ejecución visual.

Para disponer de un despacho pendiente con ambos grupos editables, se creó **por la app local** un despacho de una unidad de Bidón POL a Valentina Rojas: `daf9ed02-a3ca-4e83-94b6-4e4a9d478f3c`. Esa fue la única escritura de preparación; afecta sólo datos sintéticos locales y no se revirtió mediante SQL. La revisión de confirmaciones no llegó a confirmar devoluciones ni correcciones. No se utilizaron interceptores de red en el navegador.

Seis capturas revisadas, de 47 a 152 kB aproximadamente:

- [Despachos — Bodega — 375](capturas/f2-despachos-375.png)
- [Despachos — Bodega — 768](capturas/f2-despachos-768.png)
- [Despachos — Bodega — 1280](capturas/f2-despachos-1280.png)
- [Devoluciones — Admin global — 375](capturas/f2-devoluciones-375.png)
- [Devoluciones — Admin global — 768](capturas/f2-devoluciones-768.png)
- [Devoluciones — Admin global — 1280](capturas/f2-devoluciones-1280.png)

## Entrega y límites

- `0ae6bb2` — `feat(bodega): align dispatch fields and validate numeric stock`.
- `acea569` — `feat(bodega): confirm excess container returns`.
- Este informe y las seis capturas se entregan en un tercer commit de documentación.

Sólo se editaron archivos de `frontend/src/domains/bodega/**`, este informe y las seis capturas autorizadas; `.env.local` continúa ignorado. `InputNumerico` se consumió sin modificarlo. No se crearon/cerraron issues, ni se ejecutaron pruebas de integración, resets de BD, SQL, migraciones o acciones en producción. Las pruebas unitarias simulan las API de escritura; la visual prueba interacción y lecturas locales, con la escritura mínima de preparación indicada, y no acredita RLS de producción, CSP desplegada, RPC de devolución extremo a extremo ni lector de pantalla. No hay push, merge ni PR; queda la integración al coordinador.
