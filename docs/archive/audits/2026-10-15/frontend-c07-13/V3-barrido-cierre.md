# V3 · Barrido visual de cierre (2026-10-15)

Código: `origin/feature/frontend-ux` @ `8d2a3e8` (K1+K2+K3+F1+F2), servido con `vite --port 5192`. Chrome real (`/usr/bin/google-chrome`), cuentas `ux-bodega@`, `ux-produccion@`, `ux-admin-global@` y, para Ventas/Gastos, `ux-vendedor@example.invalid`. Escrituras de negocio: 0 (las no-GET se abortaron salvo lecturas RPC; 0 errores de página).

## Veredicto: **APROBADO — cierra R1-12, R2-13, V1-01..03 y V2-01 sin regresiones; 0 hallazgos V3**

## Matriz vista × viewport
| Vista (cuenta) | 412×915 | 768×1024 | 1024×1366 | 1280×800 |
|---|---|---|---|---|
| Despachos: lista, filtros, detalle (bodega, admin global) | OK | OK | OK | OK |
| Modal: error de vendedor (foco inicial en Vendedor) | OK | OK | OK | OK |
| Modal: error de producto, cantidad (vivo y envío), bandejas (vivo y envío) | OK | OK | OK | OK |
| Modal: Escape devuelve el foco a «Nuevo despacho» | OK | OK | OK | OK |
| Devoluciones: error de cantidad + ayuda, advertencia de envases (bodega) | OK | OK | OK | OK |
| Producción · registrar (envío vacío, cantidad en vivo, Enter) | OK | OK | OK | OK |
| Producción · incidencia (envío) | OK | OK | OK | OK |
| Producción · merma (vivo, envío, sin cantidad) | OK | OK | OK | OK |
| Ventas · Registrar venta (envío vacío) | OK | OK | OK | OK |
| Gastos (envío vacío) | OK | OK | OK | OK |

"OK" = `scrollWidth ≤ innerWidth`, ningún control visible < 44 px de alto/ancho (medidos inputs, selects, textareas, botones y enlaces), un único mensaje por error y sin ids de `aria-describedby` rotos.

## Criterios de cierre
- **Foco al primer error:** vendedor, producto, cantidad, bandejas, devolución, producción, incidencia y merma enfocan el campo inválido (medido).
- **`role="alert"` en errores de envío:** presente en vendedor, producto, cantidad, bandejas del modal; en producción (producto, cantidad también con Enter, descripción, merma, motivo). Los errores en vivo (stock, bandejas, envases) no lo llevan.
- **Orden error→ayuda:** en Devoluciones `aria-describedby = «<id>-error ayuda-devolucion-cantidad»`; el error va primero. La merma de Producción es `«<id>-error disponible-merma»`.
- **Advertencia de envases:** `role="status"`, descrita por «Devuelves 9.999 envases… revisa las cantidades antes de registrar»; el campo conserva `aria-invalid=false` (advertencia permitida, no bloqueo).
- **Ventas/Gastos sin cambios:** `git diff 69070fc..HEAD -- frontend/src/domains/ventas` vacío; sus errores salen sin `role`, con error primero y sin ayuda extra, como antes de la extensión.

## Verificación de gates (rama sin cambios de código)
`lint`, `build`, `size` (Presupuesto OK) y `test` (70 archivos / 824) en verde; suite sin `.env.local` 824/824.

## Observaciones (no son hallazgos)
- En Producción, tras enviar la incidencia vacía, su error persiste mientras se edita la merma en la misma página (comportamiento esperado: se limpia al editar su campo).
- Con admin global no había despachos «Pendiente» en la sucursal elegida, por lo que Devoluciones con error+advertencia se midió con bodega.
- El menú lateral móvil aparece abierto tras recargas completas y se cerró en el barrido; ya señalado en V1, fuera de este alcance.

## Evidencia
8 capturas «después» en `capturas/V3/` (412×915 y 1280×800).
