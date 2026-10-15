# C3 — Barrido final móvil/tablet de `feature/frontend-ux`

- **Fecha:** 2026-10-15 (America/Santiago) · **Base:** `d5c95ec` (incluye M1, M2, P1, P2, L1 y D2) · **Modo:** solo lectura de `frontend/src`; sin push, merge, PR ni Beads.
- **Método:** Vite dev en `:5190` contra Supabase local; Chrome 155 headless por CDP (`--lang=es-CL`), cuentas `ux-*@example.invalid` (vendedor, bodega, producción, admin sucursal A, admin global) con sesión iniciada por `/login`. Viewports: **412×915, 375×812, 768×1024, 1024×1366 y 1280×800**.
- **Medición:** `scrollWidth <= innerWidth`, controles visibles (a, button, input, select, textarea, summary, role=button/tab; fuera de `inert`/`dialog` cerrado) con ancho o alto < 44 px, y `console.error/warning` + `pageerror`/`Log.entryAdded`.
- **Scripts reproducibles:** `scripts/c3-lib.mjs` (arnés), `c3-matriz.mjs` (matriz), `c3-estados.mjs` (estados), `c3-probes.mjs` (sondas de validación). Datos crudos: `capturas/C3/matriz.json` (280 filas).
- **Datos creados:** ninguno. Las sondas intentaron registrar un despacho con cantidad inválida (rechazado por el servidor: "Stock insuficiente…") y nada más. La BD local tiene registros sintéticos de otros workers (p. ej. producción pasó de 83 a 85 registros durante el barrido).

## Resultado en una línea

**280/280 combinaciones sin overflow horizontal, sin controles < 44 px y sin errores/warnings de consola**; 16 estados × 5 viewports (80 mediciones) tampoco muestran ninguno. Los 3 hitos de feedback móvil están **cumplidos**; el feedback de escritorio queda **Cumple** salvo 2 parciales (envases sin tope duro, validación en vivo ausente en Registrar merma). Se encontraron **12 defectos nuevos: 0 P0/P1, 1 P2, 11 P3**; el único P2 es de tablet 1024 px en Registrar venta.

## 1. Matriz ruta × rol × viewport

Cada celda = 5 viewports (412, 375, 768, 1024, 1280) medidos con carga de documento y 1,5 s de espera. **OK** = sin overflow, sin controles < 44 px, sin consola. Alto máximo de documento a 412 px entre paréntesis (referencia de longitud en móvil).

| Ruta | vendedor | bodega | producción | admin A | admin global | Hallazgos |
|---|---|---|---|---|---|---|
| `/` | OK | OK | OK | OK | OK | — |
| `/ventas` (923 px) | OK | — | — | OK | OK | — |
| `/ventas/registrar` (2.734 px) | OK | — | — | OK | OK | C3-01 (1024), C3-02 |
| `/clientes` (1.088 px) | OK | — | — | OK | OK | C3-11 |
| `/carga` (915 px) | OK | — | — | OK | OK | — |
| `/gastos` (915 px) | OK | — | — | OK | OK | C3-11 |
| `/mi-comision` (915 px) | OK | — | — | — | — | — |
| `/ranking-vendedores` (915 px) | OK | — | — | OK | OK | — |
| `/despachos` (1.733 px) | — | OK | — | OK | OK | C3-03, C3-05 |
| `/devoluciones` (1.160 px) | — | OK | — | OK | OK | C3-04, C3-05 |
| `/stock` (1.023 px) | — | OK | — | OK | OK | — |
| `/produccion/registrar` (2.359 px) | — | — | OK | OK | OK | C3-06, C3-07 |
| `/produccion/envases` (1.069 px) | — | — | OK | OK | OK | — |
| `/produccion/historial` (2.402 px) | — | — | OK | OK | OK | C3-06, C3-07 |
| `/produccion/indicadores` (1.081 px) | — | — | OK | OK | OK | C3-08 |
| `/produccion/incidencias` (4.278 px) | — | — | OK | OK | OK | C3-06, C3-09, C3-12 |
| `/reportes`, `/ubicaciones`, `/administracion`, `/auditoria` (915 px) | — | — | — | OK | OK | placeholders "Próximamente" |
| `/login` (sin sesión) | OK | | | | | — |
| Menú móvil (drawer) | OK (375) | | | | | C3-10 |

Las celdas "—" no se miden porque el rol no tiene la ruta (redirección ya establecida en C2; no cambió). **Ninguna ruta redirigió de forma inesperada** (`final == ruta` en 280/280).

### Estados que importan (5 viewports c/u, sin overflow ni controles < 44 px ni consola)

| Estado | Rol | 412 | 375 | 768 | 1024 | 1280 | Nota |
|---|---|---|---|---|---|---|---|
| Login | — | OK | OK | OK | OK | OK | |
| Menú móvil abierto | vendedor | OK | OK | OK | OK | OK | C3-10 |
| Nuevo despacho, 3 líneas + error de stock | bodega | OK | OK | OK | OK | OK | C3-03 |
| Nuevo despacho con tope de líneas (7/7) | bodega | OK | — | — | — | — | aviso "Máximo 7…" |
| Lista de despachos | bodega | OK | OK | OK | OK | OK | C3-05 |
| Detalle de devolución (productos + envases con advertencia) | bodega | OK | OK | OK | OK | OK | C3-04 |
| Registrar venta, 3 líneas + "Excede tu carga" | vendedor | OK | OK | OK | OK¹ | OK | ¹C3-01 |
| Registrar venta, Confirmar sin datos | vendedor | OK | — | — | — | — | |
| Producción registrar (+ página 2) | producción | OK | OK | OK | OK | OK | C3-07 |
| Historial / Indicadores / Incidencias | producción | OK | OK | OK | OK | OK | C3-06/08/09 |
| Clientes, Gastos, Ranking, Mi comisión | vendedor | OK | OK | OK | OK | OK | |
| Stock | bodega | OK | OK | OK | OK | OK | |

## 2. Verificación del feedback del responsable

### 2.1 `frontend_feedback_mobile.txt` (móvil)

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| M1 | **Ventas:** cada producto en su propia tarjeta | **Cumple** | `capturas/C3/venta-2-lineas-error-412.webp`; `FilaProductoVenta.tsx:23` (`rounded-xl border … shadow-sm` bajo `lg`) y encabezado "Línea N + producto" (`:25-28`). Ver C3-01/C3-02 para tablet/longitud. |
| M2 | **Bodega:** Nuevo despacho con una tarjeta por producto | **Cumple** | `despacho-modal-error-412.webp`, `-768.webp`; `LineaDespacho.tsx:43-86`. Ver C3-03. |
| M3 | **Devoluciones:** resaltar "Productos por despacho" y "Envases" | **Cumple** | `devolucion-detalle-412.webp`: secciones con borde de 2 px, color propio (ámbar/verde), icono, conteo (`SeccionDevolucion.tsx:33-45`). |
| M4 | **Devoluciones 412×915:** usar el ancho (input a la derecha / 2 columnas) | **Cumple** (evidencia mixta) | Envases: "Buenos/Malos" en 2 columnas (`devolucion-detalle-412.webp`). Productos: nombre+datos a la izquierda e input `w-36` a la derecha (`Devoluciones.tsx:455-466`); en la BD local ambos despachos ya tenían productos devueltos, por lo que hoy se ve el valor "−1" y no el input; para el input ver capturas M2 y la prueba `Devoluciones.test.tsx`. |
| M5 | **Producción registrar:** lista reciente en tarjetas | **Cumple** | `produccion-registrar-412.webp`: tarjeta compacta producto + cantidad en una fila (D2). |
| M6 | **Historial** en tarjetas | **Cumple** (mejorable) | `produccion-historial-412.webp`; ver C3-06. |
| M7 | **Indicadores:** total por producto en tarjetas | **Cumple** (mejorable) | `produccion-indicadores-412.webp`; ver C3-08. |
| M8 | **Incidencias y mermas recientes** en tarjetas | **Cumple** (mejorable) | `produccion-incidencias-412.webp`; ver C3-06, C3-09. |
| M9 | **Paginación** si se llenan | **Cumple** | 10 por página en las 4 vistas: "Página 1 de 9 · 83 registros" (`produccion-registrar-412.webp`), sonda: tras "Siguiente" → "Página 2 de 9 · 85 registros" (`produccion-pagina2-412.webp`); Incidencias "1 de 3 · 26", Mermas "1 de 4 · 37". Clientes y Gastos usan 20 (`Paginacion.tsx`). |

### 2.2 `frontend_feedback.md` (escritorio, ya resuelto; reverificado en tablet/móvil)

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| E1 | "Disponible en bodega" no desalinea Producto/Cantidad | **Cumple** | `despacho-modal-error-768.webp`: disponibilidad a la izquierda y Cantidad a la derecha en la misma fila (`LineaDespacho.tsx:65-82`). |
| E2 | Máximo de productos = nº de productos activos (6, 7 o 10) con validación | **Cumple** | Sonda: el modal permite 7 líneas y desactiva "+ Agregar producto" con "Máximo 7 productos por despacho: ya alcanzaste el número de productos activos del catálogo." (`despacho-max-lineas-412.webp`; `Despachos.tsx:163,179`); Registrar venta igual (`RegistrarVenta.tsx:128-133,212`). |
| E3 | No se puede escribir texto en inputs numéricos (todo el frontend) | **Cumple** | Sonda: teclear `abc12x` en Cantidad deja `""` (`InputNumerico.tsx` bloquea `beforeinput`, teclas y pegado). Los únicos `<input>` no numéricos de bodega son `type="date"` (`Despachos.tsx:392`, `Devoluciones.tsx:344`) y el folio `readOnly`. |
| E4 | Devolución de productos valida no superar lo disponible | **Cumple** | `Devoluciones.tsx:445-447` (mensaje "No puedes devolver más de N…"); verificado por código y pruebas, no ejercitado hoy por falta de despacho pendiente. |
| E5 | Envases: ¿aceptable devolver 1.000+ con 994 en bodega y 0 despachados? | **Parcial (decisión tomada)** | Se muestra advertencia ámbar, no bloqueo: "Devuelves 3.000 envases de Bidón 10L y se despacharon 0. Pueden venir de clientes; revisa las cantidades antes de registrar." (`devolucion-detalle-412.webp`; `Devoluciones.tsx:209-214`). No existe tope duro; confirmar con el responsable que la advertencia es la respuesta definitiva. |
| E6 | Registrar venta: máximo = productos activos | **Cumple** | `RegistrarVenta.tsx:128-133`; mismo mensaje dinámico. |
| E7 | Cantidad con solo números, placeholder 0 y flechas ±1 | **Cumple** | `venta-2-lineas-error-412.webp`: placeholder "0", flechas ▴▾ en una fila de 44×44 px; en Producción, Despacho y Devoluciones igual. |
| E8 | Formato de miles `1.000.000` en todos los inputs numéricos | **Cumple** | Sonda: `1234567` → `1.234.567`; Precio, Descuento, Monto de Gastos y Cantidades de Producción usan `InputNumerico`/`formatMiles`. |
| E9 | Validación en tiempo real contra disponibilidad en todo el frontend | **Parcial** | En vivo: Venta ("Excede tu carga", `venta-2-lineas-error-412.webp`), Despacho ("Excede el stock en bodega: disponibles 100"), Devoluciones, Producción (límite de envases). **Falta** en Registrar merma (C3-12). |
| E10 | Producción registrar con filtro para la lista | **Cumple** | `produccion-registrar-412.webp` / `-1280.webp`: Producto + Desde/Hasta + Limpiar (`FiltrosProduccion.tsx`). Ver C3-07 por espacio. |
| E11 | "Nueva producción" no crece con la lista | **Cumple** | Formulario fijo (`Produccion.tsx` `self-start`, 4 campos); la lista se pagina en 10 (`produccion-registrar-1280.webp`: formulario 400 px junto a lista de 10). |

## 3. Estado de #86 (OND-c07.13)

| ID | Estado | Verificación C3 |
|---|---|---|
| **N-01** (Stock "Desconocido") | **Resuelto** | `Stock.tsx:215,242` ya usa "Producto/Envase no disponible" y `obtenerTiposEmpaque(true)`; `stock-412.webp` (pestaña Productos) sin "Desconocido"; la pestaña Envases no se re-capturó hoy (evidencia M2 + `Stock.test.tsx`). |
| **N-02** (Historial 200 tarjetas) | **Resuelto** | P2: 10 por página; documento de Historial 2.402 px a 412 (antes 6.074). Ver C3-06 para compactarlo aún más. |
| **R1-12** (Despachos 816 líneas) | **Parcial** | `Despachos.tsx` 774 líneas (816 → 774); líneas del modal extraídas a `LineaDespacho.tsx` (86); filtros/lista/detalle siguen en la página. |
| **R1-14** (vendedores históricos "no disponible") | **No resuelto** (backend) | Los 2 despachos locales muestran "Vendedor no disponible" (`despachos-lista-412.webp`; `Despachos.tsx:298`) aunque el modal lista a los vendedores activos. Requiere RPC/RLS (fuera del alcance frontend). Ver C3-05. |
| **R2-08** (`versionDatos` prop muerta) | **No resuelto** | `HistorialProduccion.tsx:19,23,29,32` e `IndicadoresProduccion.tsx:17,25,28` siguen con `versionDatos = 0` sin pasarlo desde `Produccion.tsx`. |
| **R2-09** (Indicadores sin jornada en la clave) | **No resuelto** | Clave `['produccion', perfilId, sucursalId, 'indicadores', periodo, versionDatos]` (`IndicadoresProduccion.tsx:28`); "hoy" se calcula dentro de `queryFn` (`:31`) y no entra en la clave. |
| **R2-11** (`void supabase.removeChannel`) | **No resuelto** | `produccion/api.ts:176` sin cambios; no se observaron errores en consola. |
| **R2-13** (refactor común de formularios) | **No resuelto** | `CampoFormulario` sólo en Ventas (Registrar venta, Gastos, Registrar cliente); Producción y Bodega usan etiquetas/errores propios (`Produccion.tsx` `errorCampo`). |

## 4. Defectos nuevos

Severidad: P0 bloquea, P1 grave, P2 moderado, P3 menor. Capturas en `capturas/C3/`.

| ID | Sev. | Vista / rol / viewport | Evidencia | Problema | Corrección propuesta | Archivos |
|---|---|---|---|---|---|---|
| C3-01 | **P2** | Registrar venta · vendedor · **1024×1366** (tablet vertical, con menú lateral) | `venta-2-lineas-error-1024.webp`; `RegistrarVenta.tsx:269-271`, `FilaProductoVenta.tsx:23` (`lg:table-row`) | M1 cambió el umbral tabla/tarjeta a `lg` (1024 px de *viewport*), pero con el menú lateral de 256 px la tabla sólo dispone de ~740 px: el selector de producto queda en ~96 px ("Bidón 1⌄"), la cantidad se recorta (`999.99'`), el "Precio unitario de Bidón 10L" envuelve en 4 líneas y el subtotal parte "$ / 999.999.000". A 1280 px sí cabe. | Decidir por ancho del contenedor, no del viewport: `@container` en el wrapper y `@3xl:` en vez de `lg:`; o subir el umbral a `xl` (1280). Mantener tarjetas en 1024. | `ventas/pages/RegistrarVenta.tsx`, `ventas/components/FilaProductoVenta.tsx` (y su test) |
| C3-02 | P3 | Registrar venta · vendedor · 412/375 | `venta-2-lineas-error-412.webp` (2.656 px con 3 líneas; 2.734 en la matriz) | Cada tarjeta ocupa ~360 px porque Disponible, Cantidad y Precio van en 1 columna (decisión M1); con 6 productos son >2.100 px sólo de tarjetas y la barra fija de total tapa parte de la línea al desplazar. | Disponible en la fila del encabezado (derecha del nombre); Cantidad + Precio en 2 columnas desde 360 px (el input con flechas cabe en ~170 px); Subtotal y Quitar en una fila. | `ventas/components/FilaProductoVenta.tsx` (mismo lote que C3-01) |
| C3-03 | P3 | Nuevo despacho · bodega · 412/768 | `despacho-modal-error-412.webp`, `-768.webp`; `LineaDespacho.tsx:65` (`minmax(0,10rem)`) | El input de Cantidad mide ~64 px junto a las flechas de 44 px: un valor de 6–7 dígitos queda recortado por la izquierda (`ɨ9.999` por `999.999`), incluso a 768 px donde sobra espacio. | Columna de cantidad `minmax(11rem,13rem)` o flechas bajo el input en <400 px; la disponibilidad pasa a una línea sobre el input si no cabe. | `bodega/components/LineaDespacho.tsx` |
| C3-04 | P3 | Devoluciones · bodega · 1024 y 412 | `devolucion-detalle-1024.webp`, `devolucion-detalle-412.webp`; `SeccionDevolucion.tsx:36-42`, `Devoluciones.tsx:470` | (a) A 1024 px la columna de detalle es angosta y "Productos del despacho" envuelve a 3 líneas junto a "1 línea" y "Ya devueltos". (b) En despachos ya devueltos el valor se muestra como "−1" sin etiqueta mientras la fila dice "Disponible 1": ambiguo (¿devuelto? ¿saldo?). | (a) Dejar conteo y "Ya devueltos" en una segunda línea del encabezado (`basis-full`) bajo `@lg`; (b) etiquetar "Devuelto 1" y ocultar "Disponible" cuando `yaDevueltos`. | `bodega/components/SeccionDevolucion.tsx`, `bodega/pages/Devoluciones.tsx` (y tests) |
| C3-05 | P2 | Despachos y Devoluciones · bodega/admin · todos | `despachos-lista-412.webp`; `Despachos.tsx:298` | Todos los despachos locales muestran "Vendedor no disponible" (avatar "VN") aunque el vendedor existe; el responsable no puede distinguir a quién se despachó (R1-14). | Frontend: mostrar el nombre desde `vendedores_sucursal` incluyendo inactivos cuando la RPC lo permita y, mientras tanto, el rol/ID corto en vez de iniciales "VN". Raíz: RPC/RLS (fuera de este alcance). | `bodega/pages/Despachos.tsx` (copy); backend fuera de lote |
| C3-06 | P3 | Historial, Registrar (reciente), Mermas · producción · 412/375 | `produccion-historial-412.webp`, `produccion-incidencias-412.webp`; `TablaProduccionResponsive.tsx:41`, `HistorialProduccion.tsx:48`, `Produccion.tsx:222` | La tarjeta compacta de Producción reciente (producto + cantidad, 66 px) no se aplica a Historial/Mermas: aparece la etiqueta "Observaciones"/"Motivo" y el texto en dos líneas (105–130 px por tarjeta; 10 tarjetas = 2.400 px). | En modo compacto ocultar la etiqueta de la columna de texto libre y mostrarlo como metadato `text-xs slate-600` debajo de la fecha (con `line-clamp-2`). | `produccion/components/TablaProduccionResponsive.tsx` |
| C3-07 | P3 | Registrar/Historial · producción · 412 y 1280 | `produccion-registrar-412.webp`, `produccion-registrar-1280.webp`; `FiltrosProduccion.tsx:17` | A 412 px los 3 filtros + Limpiar apilados ocupan ~300 px antes de la lista; a 1280 px (`xl:grid-cols-4` en una columna de 560 px) el `input type=date` recorta el valor ("mm/dd/yy⌖"). | `grid-cols-2` para Desde/Hasta desde 360 px (producto y Limpiar a todo el ancho) y `xl:grid-cols-4` → `2xl:`; opcional: colapsar en `<details>` en móvil. | `produccion/components/FiltrosProduccion.tsx` |
| C3-08 | P3 | Indicadores · producción · 412 | `produccion-indicadores-412.webp`; `IndicadoresProduccion.tsx:53-66` | Los 2 KPI van apilados (≈ 220 px) y cada tarjeta "Total por producto" muestra Unidades y Registros en dos líneas con etiqueta propia; con muchos productos la lista se alarga. | KPI en 2 columnas desde 360 px; tarjeta por producto con "Unidades · Registros" en una fila (patrón compacto de C3-06). | `produccion/components/IndicadoresProduccion.tsx` |
| C3-09 | P3 | Incidencias · producción · 412/375 | `produccion-incidencias-412.webp` (4.278–4.498 px); `Produccion.tsx` sección `incidencias` | La vista junta 2 formularios y 2 listas de 10 tarjetas: ~4.300 px en teléfono; la lista de mermas queda a 3 pantallas del título. | En <640 px poner pestañas "Incidencias / Mermas" (reutilizando el `nav` de secciones) o formularios en `<details>` y listas de 5. | `produccion/pages/Produccion.tsx` (y test) |
| C3-10 | P3 | Menú móvil/escritorio · vendedor | `menu-movil-375.webp`; `ventas/index.tsx:40,58,64,70` | "Registrar venta" y "Ranking vendedores" usan el mismo carrito y "Gastos" y "Mi comisión" el mismo `$`; en el drawer de teléfono cuesta distinguirlos por icono. | Iconos propios (p. ej. `TrophyIcon`/`MedalIcon` para ranking, `PercentIcon` para comisión). | `ventas/index.tsx`, `components/icons.tsx` |
| C3-11 | P3 | Gastos, Clientes · vendedor · 412 | `gastos-412.webp`, `clientes-412.webp`; `Paginacion.tsx:16-21` | Con 0 o 1 página se muestra "Página 1 de 1 · 0 registros" con "Anterior/Siguiente" deshabilitados: 90 px de controles sin función bajo un estado vacío. | Ocultar los botones cuando `paginas <= 1` (mantener el texto de total/anuncio `aria-live`). | `components/Paginacion.tsx` (y test) |
| C3-12 | P3 | Registrar merma · producción · 412 | `produccion-incidencias-412.webp`; `Produccion.tsx:212-215`, `validacion.ts:11-25` | La cantidad de la merma no muestra disponible ni valida en vivo contra el stock de bodega (el servidor descuenta); incumple E9 y el patrón de Registrar venta. | Mostrar "Disponible: N" del producto elegido (si RLS lo permite para producción) y error en vivo "Excede el stock"; si no, mensaje de servidor mapeado junto al campo. | `produccion/pages/Produccion.tsx`, `produccion/validacion.ts`, `produccion/api.ts` |

### 4.1 Lotes de corrección sin solapamiento de archivos

| Lote | Defectos | Archivos (exclusivos del lote) | Prioridad |
|---|---|---|---|
| **A · Ventas** | C3-01, C3-02 | `ventas/pages/RegistrarVenta.tsx`, `ventas/components/FilaProductoVenta.tsx` y pruebas | 1 (P2) |
| **B · Bodega** | C3-03, C3-04, C3-05 (copy) | `bodega/components/LineaDespacho.tsx`, `bodega/components/SeccionDevolucion.tsx`, `bodega/pages/Devoluciones.tsx`, `bodega/pages/Despachos.tsx` y pruebas | 2 |
| **C · Producción** | C3-06, C3-07, C3-08, C3-09, C3-12 | `produccion/components/{TablaProduccionResponsive,FiltrosProduccion,IndicadoresProduccion}.tsx`, `produccion/pages/Produccion.tsx`, `produccion/{validacion,api}.ts` y pruebas | 3 |
| **D · Compartidos** | C3-10, C3-11 | `ventas/index.tsx`, `components/icons.tsx`, `components/Paginacion.tsx` y pruebas | 4 |

Nada de lo anterior toca `supabase/`, SQL ni `.opencode/`. Pendientes fuera de lote: R1-14 (RPC/RLS), R2-08/R2-09/R2-11 (limpieza en `produccion/`; pueden entrar al lote C si el coordinador lo decide) y R2-13.

## 5. Límites

- Chrome headless con `--lang=es-CL` muestra `mm/dd/yyyy` en `input type=date`; el formato real depende del idioma del navegador (UX-09).
- No hay despacho con productos pendientes en la BD local (los 2 despachos ya tenían devolución de productos), por lo que la fila con input de producto de Devoluciones se verificó por código/pruebas y capturas M2, no hoy. No se crearon despachos para no alterar datos.
- Las capturas de página completa muestran la barra superior o la barra fija de total superpuesta (artefacto de `captureBeyondViewport`); el contenido bajo ella sí fue medido.
- Sin dispositivo físico, teclado virtual ni lector de pantalla; `scrollWidth` y tamaño táctil se miden con emulación de viewport.
- `npm run lint/build/test` no se ejecutaron: no se modificó código de la aplicación.

## Capturas (24, WebP < 110 KB, en `capturas/C3/`)

`login-412`, `menu-movil-375`, `despacho-modal-error-412`, `despacho-modal-error-768`, `despacho-max-lineas-412`, `despachos-lista-412`, `devolucion-detalle-412`, `devolucion-detalle-1024`, `venta-2-lineas-error-412`, `venta-2-lineas-error-768`, `venta-2-lineas-error-1024`, `venta-2-lineas-error-1280`, `venta-confirmar-vacio-412`, `produccion-registrar-412`, `produccion-registrar-1280`, `produccion-pagina2-412`, `produccion-historial-412`, `produccion-indicadores-412`, `produccion-incidencias-412`, `clientes-412`, `gastos-412`, `stock-412`, `ranking-412`, `mi-comision-412` (todas `.webp`).
