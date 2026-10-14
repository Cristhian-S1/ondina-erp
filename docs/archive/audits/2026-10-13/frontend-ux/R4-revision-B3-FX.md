# R4 — Revisión cruzada de B3 (ventas) y FX (bodega/producción)

Fecha: 2026-10-14. Base: `origin/feature/frontend-ux` @ `cd0b80e`. Revisor: Sonnet 5.5 sobre trabajo de Codex. Solo lectura de código.
Entorno: Vite dev `127.0.0.1:5190` contra Supabase local, Chrome headless (Playwright), 375/768/1280, cuentas sintéticas `ux-*`.
Datos creados solo por la app: ventas del vendedor UX (carga consumida) y un despacho de 6 Bidón POL desde bodega.

## Veredictos

| Lote | Veredicto |
| --- | --- |
| B3 ventas | **Aprobar con cambios**: R4-01 (P1) debe corregirse antes de integrar a `develop`. |
| FX bodega/producción | **Aprobar con cambios menores**: las correcciones R1/R2 funcionan (error dentro del diálogo, listas conservadas, filtros); quedan P2/P3 de foco y feedback. |

## Hallazgos

`R4-NN | severidad | evidencia | problema | corrección propuesta`

| ID | Sev. | Evidencia | Problema | Corrección propuesta |
| --- | --- | --- | --- | --- |
| R4-01 | P1 | `ventas/pages/RegistrarVenta.tsx:224` (`register('clienteId')` en `<select>` no controlado), `:113`/`:129` borrador | Al recargar con borrador, cantidades/observaciones se restauran pero el select de cliente queda en «Selecciona un cliente…» porque las opciones llegan después del montaje. El formulario conserva el `clienteId` oculto: reproducido, Confirmar registra la venta **sin error** a un cliente que la pantalla no muestra elegido. | Controlar el select (`Controller`/`value`) o re-aplicar `setValue('clienteId')` cuando carga `clientes.data`; si el id ya no existe, vaciar el campo y avisar. Prueba que recargue el borrador con clientes tardíos. |
| R4-02 | P1 | `ventas/schemas.ts:59` (`precioUnitario … min(0)`), `RegistrarVenta.tsx:186-197` | Con precio vacío/0 se confirma una venta de **$0** (reproducido: «Total confirmado: $ 0»). El resumen de éxito presenta como correcta una venta sin valor. | Exigir precio > 0 (o confirmar explícitamente ventas con total 0) y mensaje en el campo. Si $0 es regla de negocio, decirlo en copy y bloquear total 0 sin descuento justificado. |
| R4-03 | P2 | `RegistrarVenta.tsx:186-188`, `:360-362`; captura `r4-v375-excede` | Errores de carga/«agrega un producto» solo por Toast (`role=alert`), sin `aria-invalid` ni foco; el foco queda en Confirmar. «Excede tu carga» en campo + Toast duplican el mensaje. Producto sin carga en el desplegable solo falla al confirmar. | Marcar el campo con `setError` de RHF + `shouldFocus`; quitar Toast duplicado; deshabilitar/etiquetar productos sin carga («sin carga»). |
| R4-04 | P2 | `components/ResumenVentaConfirmada.tsx:15-17`, `RegistrarVenta.tsx:202`; captura `r4-v375-exito` | Tras confirmar, el foco cae en `body` y no hay región `status`/h1 enfocado: un lector de pantalla no se entera del éxito; «Registrar otra venta» también deja foco en `body`. «Copiar folio» no avisa (sin `aria-live`) ni muestra fallo si el portapapeles no está disponible (reproducido: sin cambio). | `tabIndex=-1` + foco al h1 del resumen, `role="status"` en «Folio copiado»/«No se pudo copiar», foco al primer campo al reiniciar. |
| R4-05 | P2 | `RegistrarVenta.tsx:150`, captura `r4-ux-admin-375` | Administrador ve el aviso de alcance pero el formulario completo editable (agregar productos, escribir) con Confirmar deshabilitado: invita a rellenar algo que no puede enviar. | Con `esAdmin` mostrar solo el aviso y un enlace a Ventas, o envolver en `<fieldset disabled>`. |
| R4-06 | P2 | `ventas/pages/RegistrarCliente.tsx:85-89,139` | Tras éxito el diálogo sigue 1,5 s abierto con «Guardar cliente» habilitado: un segundo clic crea un cliente duplicado. | Deshabilitar guardar tras éxito (`crear.isSuccess`) o cerrar de inmediato y notificar fuera del diálogo. |
| R4-07 | P2 | `bodega/pages/Despachos.tsx:206-208`, `:611-613`; captura `r4-despachos-error-375` | Éxito de despacho cierra el modal sin confirmación visible (sin toast/status, reproducido); el foco vuelve al botón. Error de validación es un mensaje genérico sin `aria-invalid` ni foco al campo; foco inicial del diálogo en «Cerrar ✕». | Mensaje `status` «Despacho registrado»; asociar errores a Vendedor/Producto/Cantidad y enfocar el primero; foco inicial en el primer campo. |
| R4-08 | P2 | `bodega/pages/Despachos.tsx:265`, captura `r4-devoluciones-detalle-375` | R1-14 sigue visible: 6 de 8 despachos muestran «Vendedor no disponible» y no son filtrables; el usuario no distingue destino. En móvil el detalle de devolución aparece **bajo** toda la lista sin scroll/foco al seleccionar; muestra 4 envases con 0 despachadas (8 inputs inútiles). | Mostrar identificador/ID corto del vendedor o «Vendedor inactivo»; `scrollIntoView`+foco al encabezado del detalle; ocultar envases con 0 despachadas. |
| R4-09 | P2 | `bodega/pages/Devoluciones.tsx:472` | La frase «No puedes devolver más de lo despachado por producto.» se muestra siempre con estilo de ayuda/error antes de cualquier entrada. | Convertirla en ayuda neutra (`aria-describedby` del input) y reservar el error para exceso real. |
| R4-10 | P2 | `produccion/components/HistorialProduccion.tsx:66` | Desde > Hasta devuelve «No hay registros para los filtros seleccionados» sin indicar que el rango está invertido (reproducido). | Validar rango y mostrar «Desde debe ser anterior o igual a Hasta» en el campo. |
| R4-11 | P2 | `produccion/pages/Produccion.tsx` (validación incidencias/merma), reproducido en `/produccion/incidencias` | Error de validación aparece en campo y en Toast («Selecciona un producto.» dos veces); foco queda en el botón, no en el campo inválido. | Enfocar el primer campo con error; no repetir el mensaje en Toast. |
| R4-12 | P3 | `components/FilaProductoVenta.tsx:52,65,70` | La etiqueta accesible cambia con el producto («Cantidad de Bidón POL»); en 375 envuelve en 2 líneas desalineando la fila. Tabla `display:block` sin roles explícitos (FX sí los añadió en bodega/producción): inconsistencia. | Etiqueta estable «Cantidad» + contexto en `aria-describedby`; aplicar el patrón de roles explícitos de R1-13. |
| R4-13 | P3 | `components/ResumenFormularioVenta.tsx:26-27` | En móvil el total aparece dos veces (tarjeta Resumen y barra fija). El «folio» mostrado es un UUID de 36 caracteres, poco amigable. | Ocultar el total de la tarjeta en <640 px; mostrar folio corto con copia del completo. |
| R4-14 | P3 | `ventas/pages/Gastos.tsx:87` | El símbolo `$` (`top-3`) queda ~4 px sobre el centro del texto del input por el `mt-1` del control. | `top-1/2` con offset del `mt-1` o prefijo dentro del input. |

## Verificado sin hallazgo

- Barra fija inferior (375×812): 69 px, no tapa Observaciones ni Resumen; `pb-28` suficiente; `pb-[max(0.75rem,env(safe-area-inset-bottom))]` presente (safe-area no verificable en headless). Sin overflow horizontal en 375/768/1280.
- Vendedor sin carga (768/1280): aviso ámbar + Confirmar deshabilitado con `aria-describedby`. Cliente vacío: error asociado y foco en el select.
- Despachos: error de stock «disponible 99, solicitado 999» dentro del diálogo (R1-01 OK); Esc cierra y devuelve foco. Etiquetas visibles Producto/Cantidad/Bandejas (R1-03 OK).
- Devoluciones: detalle con etiquetas por input, tarjetas bajo 640 px (R1-13 OK), sin overflow.
- Producción: Desde/Hasta con etiqueta, sin overflow, filtros operativos; sin errores JS en ninguna ruta.
- Componentes: `CampoFormulario` correcto (`useId`, `aria-describedby`, `aria-invalid`); `PersistenciaBorradorVenta` limpio (flush/cleanup) salvo R4-01 (restauración, no persistencia); `EstadoVista` y tokens (`ui.ts`) usados de forma consistente con B5; microcopy en español correcto.

## Capturas (`capturas/`)

`r4-v375-fondo.png`, `r4-v375-excede.png`, `r4-v375-exito.png`, `r4-ux-admin-375.png`, `r4-despachos-error-375.png`, `r4-devoluciones-detalle-375.png`.

## Límites

Chrome headless local; sin lector de pantalla ni dispositivo físico; safe-area inferior no emulada; no se ejecutó `test:integration`; sin escritura a producción. Creé datos sintéticos locales solo desde la app (3 ventas del vendedor UX, una de $0 por R4-02, y un despacho de 6 unidades).
