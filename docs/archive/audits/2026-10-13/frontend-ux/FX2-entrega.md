# FX2 — Correcciones de R4 y R3-01

Fecha: 2026-10-14. Rama: `Cristhian-S1/fux-b1-bodega`. Dispatch: `task_beed077d9d99` / `ctx_57325cd2cb75`.
Base inicial: `d2bf68c`. Se ejecutó el fetch/rebase solicitado por coordinación; base final: **`3a9f7010fb46da8883b41aaff9fd6803940cac78`**, con FX3 integrado. Los commits de implementación posteriores al rebase son:

- **`19da654893c1e5d65416a719e5def53415a33255`** — ventas, borradores, confirmación sin cobro, clientes y ranking.
- **`0ea819ed8d83ad205e56274ce0dc23728c8be2b9`** — feedback/foco de bodega y validaciones de producción.

Sólo se modificó código dentro de la propiedad de FX2. Este informe, ocho capturas `fx2-*.png` y `.env.local` ignorado son las excepciones expresas del despacho. Sin cambios de permisos/rutas, SQL/migraciones, librerías compartidas, CSP o presupuestos; sin push, merge ni PR; no se crearon ni cerraron issues.

## Hallazgos y resultado

| ID | Corrección o límite | Commit |
| --- | --- | --- |
| R4-01 | Cliente controlado por `Controller`; las opciones tardías muestran el valor restaurado. Si el cliente ya no existe en el catálogo, se vacía `clienteId` y queda un aviso persistente asociado al select. No se envía un cliente oculto. | `19da654` |
| R4-02 | Se mantiene precio/total cero conforme al contrato versionado de BD. El resumen advierte «El total de la venta es $0…» y Confirmar abre un Dialog que exige pulsar **Confirmar venta por $0** antes de llamar a la mutación. Volver a revisar/Escape conserva el formulario y no envía. Aplica tanto a precio cero como a descuento que lleva el total a cero. | `19da654` |
| R4-03 | «Agrega al menos un producto» y exceso/falta de carga usan errores RHF en cantidad, con `aria-invalid`, descripción persistente y foco. Se elimina el Toast duplicado de estas validaciones. Opciones sin carga se etiquetan «sin carga» y se deshabilitan para nuevas selecciones. | `19da654` |
| R4-04 | Resumen enfoca su h1 (`tabIndex=-1`), anuncia éxito con `role="status"` y devuelve foco al cliente al iniciar otra venta. Copia comunica éxito o fallo mediante status, incluido portapapeles ausente; el folio completo sigue seleccionable. | `19da654` |
| R4-05 | Datos, productos, pago y confirmación del administrador quedan dentro de `fieldset disabled`; aviso de alcance visible y Cancelar fuera del fieldset para poder salir. | `19da654` |
| R4-06 | Guardar se deshabilita después de éxito durante el cierre diferido existente. Un ref bloquea además dos submits antes de que React Query pinte el estado pendiente. El bloqueo se libera en error y se reinicia al reabrir el diálogo. | `19da654` |
| R4-07 | Toast «Despacho registrado.» tras éxito. El modal abre con foco en Vendedor; errores de validación/stock se asocian a Vendedor/Producto/Cantidad/Bandejas y enfocan el campo correspondiente. El error de RPC sigue siendo una alerta dentro del modal. | `0ea819e` |
| R4-08 | Se conserva **Vendedor no disponible**, conforme a la alternativa permitida: la RPC devuelve sólo activos y bodega no puede leer otros perfiles bajo la RLS actual. No se inventa que un vendedor ausente sea inactivo. El detalle de devoluciones sí recibe foco y scroll al seleccionarlo. | `0ea819e` (foco); nombres: límite documentado |
| R4-09 | Ayuda neutra «La devolución de cada producto tiene como límite la cantidad despachada», enlazada con `aria-describedby`. No aparece como error antes de ingresar datos; exceso real marca cantidad inválida y describe la alerta de validación al registrar. | `0ea819e` |
| R4-10 | Desde > Hasta muestra «Desde debe ser anterior o igual a Hasta», asociado a ambos campos, y deshabilita esa consulta. No sustituye el error de rango por lista vacía ni muestra filas de una búsqueda anterior. | `0ea819e` |
| R4-11 | Validaciones de producción/incidencia/merma persisten junto al campo y enfocan el primero inválido; ya no se repiten en Toast. Toast se mantiene para resultados de escritura. | `0ea819e` |
| R4-12, P3 | **Parcial:** roles table/rowgroup/row/columnheader/cell explícitos en ventas y encabezado accesible en móvil. Se conservan los nombres accesibles por producto; las etiquetas cortas y contexto separado quedan diferidos para revisar ese patrón con lector de pantalla. | `19da654` |
| R4-13, P3 | **Parcial:** total de la tarjeta oculto bajo 640 px; queda visible en la barra móvil. Se conserva el folio completo y su copia para mantener el identificador íntegro; no se agregó folio corto. | `19da654` |
| R4-14, P3 | Prefijo $ de Gastos centrado respecto del control, teniendo en cuenta su margen superior. Comprobación de geometría a 375/768/1280: diferencia de centros <=3 px. | `19da654` |
| R3-01, añadido por coordinación | Éxito de venta invalida también `['ventas','ranking']`. Prueba con caché fresca de 30 s y QueryClient compartido: tras fallo no se relee; tras éxito, desmontar/remontar ranking vuelve a consultar y muestra 3000 en lugar de 2000. | `19da654` |

## Decisión sobre ventas de $0: evidencia y pendiente de negocio

Se leyeron las migraciones sin modificarlas. `20261013000000_remote_baseline.sql:1325` declara `precio_unitario >= 0`; `:1352` declara `total >= 0`. La definición posterior de `registrar_venta` en `20261013184049_b3_data_integrity.sql:567` comprueba cantidad positiva y precio finito, y en `:657` rechaza únicamente **precio negativo**, no cero. El cálculo de total también admite cero. Por ello **no se cambió el schema a precio positivo** ni se inventó una restricción distinta en el cliente.

La UI ahora exige una decisión consciente antes de registrar sin cobro. **Pendiente para el usuario/producto:** confirmar si las ventas gratuitas deben seguir admitiéndose y si necesitan justificación o autorización adicional; si se decide prohibirlas o restringir descuentos, habrá que alinear BD y frontend en un lote autorizado. Esta conclusión describe el código versionado leído; no acredita el estado de una base de producción.

## Límite de nombres históricos de bodega

`20261013200000_b6_revision_fixes.sql:270-278` define `vendedores_sucursal`: devuelve id/nombres/apellidos y filtra `p.activo`. La política `perfiles_select_b6` en `:252-253` permite perfiles propios o administración en su ámbito; **no permite a bodega leer vendedores históricos de otros usuarios**. La RPC tampoco devuelve una bandera de actividad para inferirla con certeza. Cambiar esa función/política requeriría backend y está fuera de propiedad; se conserva el fallback autorizado y no se agrega una lectura de perfiles que falle o simule una lista completa.

No se ocultaron envases con cero despachadas: esa modificación cambiaría el universo de devolución y necesita confirmar si se aceptan envases acumulados de otros despachos. No se alteró esa regla a partir de una observación visual.

## Pruebas de regresión

Se escribieron y ejecutaron primero pruebas rojas para restauración del cliente, confirmación de $0, errores/foco de venta, resumen, bloqueo de clientes, rango de historial y foco/duplicación de validación de producción. También se reprodujeron en rojo el ranking sin invalidación, el feedback del despacho y la asociación de ayuda de devoluciones antes de corregirlos.

- `RegistrarVenta.test.tsx`: cliente tardío/restaurado y cliente retirado; cero por precio vacío y por descuento exige confirmación sin RPC previa; cantidad vacía/exceso con descripción y foco; resumen enfocado, portapapeles ausente con status, reinicio enfocado; admin deshabilitado.
- `RegistrarCliente.test.tsx`: botón bloqueado tras éxito y dos clics antes de resolver crean una sola petición; se conservan los ensayos de error/reintento y apertura/cierre.
- `useRegistrarVenta.test.tsx`: invalidación del prefijo ranking y recorrido de remontaje bajo caché fresca, con fallo y éxito diferenciados; continúan verdes las claves de idempotencia y las otras invalidaciones.
- `Despachos.test.tsx`: primer foco en Vendedor, error asociado/enfocado y Toast de éxito con diálogo cerrado.
- `Devoluciones.test.tsx`: ayuda neutra asociada, sin alerta inicial, y exceso real inválido.
- `HistorialProduccion.test.tsx`: rango invertido asociado, sin consulta nueva ni falso vacío.
- `Produccion.branch.test.tsx`: incidencia/merma enfocadas y sin Toast de validación; los ensayos anteriores de validación se ajustaron al nuevo contrato de no duplicación.

## Cuatro verificaciones finales después del rebase

Desde `frontend/`, Node **22.23.3**, `.env.local` ignorado con `VITE_SUPABASE_URL=http://127.0.0.1:54321` y la ANON_KEY local obtenida mediante `supabase status -o env`. No se incluyen claves en este informe.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Exit 0. |
| `npm run build` | Exit 0, TypeScript/Vite verdes; aviso existente `INEFFECTIVE_DYNAMIC_IMPORT` de dashboard. |
| `npm run size` | Exit 0, **5 métricas OK**, sin cambiar límites. |
| `npm run test` | Exit 0, **691/691 pruebas, 52/52 archivos**. |

| Bundle, bytes | Actual | Límite |
| --- | ---: | ---: |
| JS entrada gzip | 94.845 | 105.567 |
| CSS entrada gzip | 7.307 | 47.853 |
| Chunk JS mayor sin comprimir | 298.572 | 332.108 |
| JS inicial total gzip | 151.491 | 174.765 |
| CSS inicial total gzip | 7.307 | 48.053 |

## Verificación visual y capturas

Chrome headless/Playwright, Vite dev local, cuentas sintéticas vendedor y administrador de Sucursal A. **30 escenarios**: las diez filas de esta matriz en 375/768/1280. Cada escenario cumple `scrollWidth === innerWidth` (375/375, 768/768, 1280/1280), sin errores JavaScript de página. La matriz se repitió tras el rebase final.

| Vista/estado | Rol | Comprobación adicional |
| --- | --- | --- |
| Registrar venta | vendedor | Cliente restaurado visible después de recarga real del borrador. |
| Confirmación de venta de $0 | vendedor | Advertencia y Dialog explícito antes del envío. |
| Venta confirmada | vendedor | Foco en h1 y al cliente después de Registrar otra venta. |
| Gastos | vendedor | Prefijo $ centrado. |
| Nuevo cliente | vendedor | Modal y controles sin overflow. |
| Registrar venta | administrador | Fieldset y controles efectivamente deshabilitados. |
| Despachos con modal/error | administrador | Foco en Vendedor inválido y error dentro del diálogo. |
| Devoluciones con detalle | administrador | Selección lleva foco al título y hace scroll. |
| Historial con rango invertido | administrador | Mensaje asociado visible, sin falso vacío. |
| Incidencias con validación | administrador | Campo enfocado, error persistente, sin Toast duplicado. |

Las ventas de éxito del navegador usan Auth/lecturas locales reales y **respuestas interceptadas de `registrar_venta` y del resumen** para no consumir carga ni escribir ventas. No constituyen prueba de la RPC/stock. Despachos/producción se validaron sin escrituras; su éxito o carreras se cubren con pruebas de promesas controladas.

Se conservan sólo ocho capturas, todas <300 KB; los demás anchos/estados se revisaron con capturas temporales:

- Registrar venta vendedor: [375](capturas/fx2-registrar-venta-vendedor-375.png), [768](capturas/fx2-registrar-venta-vendedor-768.png), [1280](capturas/fx2-registrar-venta-vendedor-1280.png).
- [Venta de $0, vendedor 375](capturas/fx2-venta-cero-vendedor-375.png).
- [Registrar venta, administrador 375](capturas/fx2-registrar-venta-admin-375.png).
- [Despachos, administrador 375](capturas/fx2-despachos-admin-375.png).
- [Historial, administrador 375](capturas/fx2-produccion-historial-admin-375.png).
- [Incidencias, administrador 375](capturas/fx2-produccion-incidencias-admin-375.png).

Límites: sin `npm run test:integration`, sin producción, sin preview/CSP, sin lector de pantalla/dispositivo físico ni validación de safe-area. La aprobación de una regla de gratuidad y una lectura segura de nombres históricos requieren decisiones/contratos fuera de este lote.
