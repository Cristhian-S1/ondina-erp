# B3 — Registrar venta y formularios

Fecha de validación: **2026-10-14**, entorno local sintético. Beads: **OND-c07.6**.
Despacho: `task_c361a65b4dd6` / `ctx_4a5fdbd7619f`.
Rama: `Cristhian-S1/fux-b2-produccion`.

## Base y commits

Se ejecutó `git fetch origin && git rebase origin/feature/frontend-ux` al reanudar.
La base validada es `ca44d3c6279119a31635b39154f72f7a55955f90`, con B6 integrado.
El WIP `1762dcb` quedó reorganizado en estos commits locales:

| Commit | Contenido |
| --- | --- |
| `5a8e70e` | Errores accesibles de cliente/gastos, teclado móvil, selección explícita del tipo y moneda. |
| `421bb7c` | Invalidación de comisión y helper de lectura del total confirmado. |
| `a4234d1` | Formulario de venta separado, borrador agrupado, prevención, resumen y recuperación. |

La referencia remota avanzó a `3b6d7a2` durante la validación. Esta entrega contiene sólo los cambios propios sobre la base anterior; el coordinador debe integrar los commits y volver a ejecutar los controles sobre la base conjunta. No se hizo push, merge, PR ni despliegue. No se crearon ni cerraron issues.

## Hallazgos resueltos

| ID | Resultado y evidencia | Commit |
| --- | --- | --- |
| A1-12 | `CampoFormulario` mantiene ID por control, label estable, `aria-invalid`, descripción enlazada y `inputErrorCls`. RHF conserva refs/foco. Aplicado a cliente, venta y gastos; pruebas DOM de vínculo y foco. | `5a8e70e`, `a4234d1` |
| A1-06 | Éxito invalida el prefijo `['mi-comision']`; sólo el hook invalida carga. Pruebas de QueryClient y de una única recarga; los errores no invalidan. | `421bb7c`, `a4234d1` |
| A1-03 | Suscripciones acotadas para productos/resumen y persistencia sin suscribir la página a Observaciones. Un cálculo de subtotal en el resumen; filas calculan sólo su importe. Debounce de 250 ms y flush al salir. Medición reproducida abajo. | `a4234d1` |
| A1-17 | Administrador de sucursal/global conserva la ruta, ve explicación de alcance y Confirmar deshabilitado con descripción al motivo. Sin cambios de permisos. | `a4234d1` |
| UX-06 | Banners superiores para falta de clientes o carga, acción de crear cliente/pedir carga, Confirmar bloqueado y enlazado al motivo. | `a4234d1` |
| UX-04 | Un único árbol RHF/table; filas en dos columnas bajo 640 px, sin tarjeta interior. Barra inferior fija con total/Confirmar y safe-area; espacio inferior para los últimos campos. | `a4234d1` |
| UX-05 | Resumen persistente sin redirección: folio completo, copiar, cliente y total leído desde BD. Reintentar sólo recupera ese total; Registrar otra venta reinicia el formulario e Ir a Ventas es explícito. | `421bb7c`, `a4234d1` |
| UX-16 | Copy de registrar en lenguaje de negocio; retirada la explicación técnica de cálculo/transacción. | `a4234d1` |
| UX-20 | Crea uno primero con área mínima de 44 px; Quitar usa `btnDanger` y altura mínima de 44 px. | `a4234d1` |
| UX-21 | Teléfono `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`; nombre `autoCapitalize="words"`. | `5a8e70e` |
| UX-17 | Tipo de gasto inicialmente vacío y validación explícita; monto editable con símbolo $, formato miles es-CL y totales/historial con $. | `5a8e70e` |
| Recuperación de lecturas | `EstadoVista`/Reintentar para venta, historial de gastos y vendedores del modal. Conserva lo ingresado; la llegada tardía del catálogo completa sólo campos intactos y ya no reinicia cliente/cantidad/observaciones. | `5a8e70e`, `a4234d1` |

La transacción, el total definitivo, el descuento y los movimientos de stock siguen siendo responsabilidad de la BD. El total del formulario es orientativo; el resumen confirmado usa `obtenerResumenVenta(id)`.

## Pruebas y medición

Las regresiones añadidas cubren ARIA/foco en los tres formularios; bloqueo por rol/carga/clientes; invalidación de comisión y carga; éxito sin navegación; recuperación del total sin segunda mutación; moneda y tipo de gasto; reintentos que preservan campos; separación del borrador por identidad y flush al desmontar.

TDD de esta reanudación: la prueba del símbolo $ falló antes de añadirlo y pasó después; la prueba de recuperar el catálogo falló porque cliente quedaba vacío y pasó tras sustituir el reset completo por inicialización de campos intactos. El fallo pendiente de Toast se reprodujo sólo en conjunto: el flush de cleanup dejaba el borrador de seis filas del caso previo, por lo que ahora cada caso limpia almacenamiento al comenzar. Ejecutado solo, ese caso ya pasaba.

Medición con React Profiler y spy de `Storage.setItem`, seis cambios consecutivos `P → Pe → Ped → Pedi → Pedid → Pedido` en Observaciones, sin otras interacciones:

| Versión | Renders durante las seis teclas | Escrituras inmediatas | Escrituras agrupadas |
| --- | ---: | ---: | ---: |
| `RegistrarVenta.tsx` de `ca44d3c` | 6 | 6 | No agrupaba |
| B3 final | 0 | 0 | 1 al avanzar 300 ms |

Se cargó temporalmente la página de la base para ejecutar exactamente el mismo caso y se restauró en `finally`. `RegistrarVenta.draft.test.tsx` verifica además que desmontar antes del debounce guarda la última tecla. Esta medición cuenta commits de React/escrituras de almacenamiento; no mide INP ni acredita rendimiento en un teléfono físico.

## Cuatro verificaciones obligatorias

Ejecutadas desde `frontend/` con `.env.local` ignorado, URL `http://127.0.0.1:54321` y anon key obtenida del stack local, sin claves privilegiadas en `VITE_*`:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Exit 0. |
| `npm run build` | Exit 0; TypeScript estricto y Vite. Advertencia preexistente: import dinámico de `lib/dashboard.ts` también importado estáticamente. |
| `npm run size` | Exit 0, **5 métricas OK**, sin modificar presupuestos. |
| `npm run test` | Exit 0, **649 pruebas / 51 archivos**. |

| Métrica de tamaño | Actual | Presupuesto | Estado |
| --- | ---: | ---: | --- |
| JS entrada gzip | 102.179 | 105.567 | OK |
| CSS entrada gzip | 43.947 | 47.853 | OK |
| Mayor chunk JS sin comprimir | 323.487 | 332.108 | OK |
| JS inicial total gzip | 158.834 | 174.765 | OK |
| CSS inicial total gzip | 43.947 | 48.053 | OK |

Cifras en las unidades impresas por `npm run size`. No se ejecutó `npm run test:integration`.

## Navegador y lectura real local

Chrome headless, Playwright Core y Vite `127.0.0.1:5183`, altura 850 px. **21 combinaciones** verificadas: registrar venta, nuevo cliente y gastos como vendedor/admin en 375/768/1280; registrar venta como admin global en los tres anchos. En todas: `document.documentElement.scrollWidth === innerWidth` (375, 768 o 1280). El modal tampoco tiene overflow interno horizontal. Cero errores JavaScript de página en esos recorridos. Se inspeccionaron visualmente las ocho capturas, todas de menos de 300 KB:

- [Registrar vendedor 375](capturas/b3-registrar-vendedor-375.png), [768](capturas/b3-registrar-vendedor-768.png), [1280](capturas/b3-registrar-vendedor-1280.png).
- [Registrar administrador 375](capturas/b3-registrar-admin-375.png), [1280](capturas/b3-registrar-admin-1280.png).
- [Nuevo cliente vendedor 375](capturas/b3-cliente-vendedor-375.png), [administrador 768](capturas/b3-cliente-admin-768.png).
- [Gastos vendedor 375 con validaciones](capturas/b3-gastos-vendedor-375.png).

Se verificó el posicionamiento fijo de la barra móvil, que Observaciones puede desplazarse por encima de ella, Quitar ≥44 px y ARIA/foco real del modal. Antes de preparar datos se recorrió también vendedor sin cliente/carga; después se repitió con datos sintéticos.

Se preparó un cliente local `Cliente sintético B3 UX` para `ux-vendedor@example.invalid`, y cinco unidades de Bidón POL mediante `crear_despacho` autenticado como `ux-bodega@example.invalid`. El navegador registró una venta de dos unidades de $1.000, folio **`3855acd1-43c4-468f-a273-a392f31353af`**, total BD **$2.000**. La primera lectura del resumen se respondió con error HTTP 400 simulado: el folio/cliente siguieron visibles, el texto técnico no llegó a la UI, Reintentar recuperó el total real, el portapapeles recibió el UUID completo y Registrar otra venta vació cliente/cantidad. Conteo: **1 POST de registrar_venta y 2 lecturas de resumen**. Estos datos quedan sólo en la BD local; no se borró historia ni se compensó stock manualmente.

El helper real se ejecutó con sesiones locales contra esa venta:

| Sesión | Resultado esperado y obtenido |
| --- | --- |
| Vendedor propietario | Folio y total $2.000 visibles. |
| Administrador sucursal A | Folio y total $2.000 visibles. |
| Administrador global | Folio y total $2.000 visibles. |
| Bodega / Producción / anónimo | No obtiene resumen; mensaje público genérico en español. |

## Límites y exclusiones

- No hay hallazgos B3 descartados dentro de la propiedad asignada. La verificación de permisos del helper cubre una venta de sucursal A y seis roles; no es una nueva matriz exhaustiva entre sucursales ni un cambio de RLS.
- Pruebas visuales en Chrome headless local; no se probó un dispositivo físico, su teclado virtual, VoiceOver/NVDA o una caída real de red. Se simuló el fallo de la lectura y se cubrieron rechazos de servicios con pruebas DOM.
- Cambios de MiComision, RankingVendedores, Ventas, Carga, Clientes, rutas, componentes/lib compartidos, SQL/migraciones y despliegue permanecen fuera de este lote. La invalidación usa prefijos existentes y no cambia contratos de esas vistas.
- No se verificó producción ni se utilizaron sus datos. La integración sobre el avance remoto posterior requiere los controles del coordinador.
