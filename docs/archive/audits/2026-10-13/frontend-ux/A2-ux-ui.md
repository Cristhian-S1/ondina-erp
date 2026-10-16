# A2 — Diagnóstico UX/UI y responsividad del frontend

- **Fecha:** 2026-10-13 · **Beads:** OND-c07.2 · **Base:** `develop` @ `40c152b` (rama `feature/frontend-ux`)
- **Alcance:** todas las rutas de `frontend/src/domains/*/index.tsx` por rol (vendedor, bodega, producción, administrador de sucursal, administrador global) a 375, 768, 1024 y 1280 px. Solo lectura de código; no se modificó `frontend/src`.
- **Método:** app local (`npm run dev -- --port 5182`) contra Supabase local; Chrome 155 headless vía Playwright con las cuentas sintéticas `ux-*@example.invalid`. Por ruta×rol×ancho se midió `scrollWidth` vs `clientWidth` y se contaron controles interactivos < 44 px, además de capturas de página completa (≈ 330 en total; se conservan 23 en `capturas/`). Después se contrastó con el código.
- **Capturas:** `capturas/a2-<ruta>-<rol>-<ancho>.png`.

## Límites de la evidencia

- La BD local casi no tiene datos (sin clientes ni carga para el vendedor; algunos despachos, producción y mermas sintéticos de otras fixtures). Por eso **los flujos con datos (venta confirmada, devolución registrada, ranking con filas) no se ejercitaron de extremo a extremo**: esos hallazgos provienen de lectura de código y se marcan como *(código)*.
- No se probó teclado físico ni teclado móvil real; las observaciones de teclado se basan en atributos `inputMode`/`type`.
- Los roles `administrador` entran a rutas pensadas para vendedor (`/ventas`, `/carga`, `/gastos`, `/ventas/registrar`); se evaluó lo que ven.
- El detector de objetivos táctiles < 44 px sólo marcó 1 elemento (enlace de texto) en todas las rutas; la base de #52 está bien aplicada en botones/inputs principales.

## Resumen ejecutivo

1. **Bloqueantes de layout a 375 px:** el listado de Despachos desborda el viewport (382 px) y las tablas de Producción (mermas 397 px; historial con columnas cortadas) no se convierten en tarjetas bajo 640 px, contra lo definido en `docs/engineering/frontend.md`.
2. **Cuatro rutas de administración son pantallas "En construcción"** (`/reportes`, `/ubicaciones`, `/administracion`, `/auditoria`) y aparecen en el menú como si fueran funcionales.
3. **Registrar venta** funciona en una sola operación pero en 375 px mide ~2.860 px, no ofrece guía cuando falta cliente/carga y su confirmación se pierde a los 2 s por la redirección.
4. Hay **inconsistencias sistemáticas** de componentes: estados de carga/error/vacío, formato de fechas (3 formatos), estilos de tarjeta y tipografía en Ranking/Mi comisión, feedback por banner vs. Toast.
5. Microcopy: "13 De Octubre De 2026", "Desconocido", jerga técnica ("confirmación atómica", "la base de datos calcula…").

## Matriz ruta × rol × ancho

`OK` = sin hallazgo detectado. IDs = hallazgos que afectan esa celda (ver sección siguiente). Los hallazgos globales de shell (UX-14 campana, UX-18 login) se anotan en la fila `/` y aplican a todas las rutas. Los overflows medidos (UX-01, UX-02) están confirmados por medición; el resto de IDs son evidencia de código/captura.

| Ruta | Rol | 375 | 768 | 1024 | 1280 |
|---|---|---|---|---|---|
| `/` | vendedor | UX-14 | UX-14 | UX-14 | UX-14 |
| `/ventas` | vendedor | UX-16 | UX-16 | UX-16 | UX-16 |
| `/ventas/registrar` | vendedor | UX-04, UX-05, UX-06, UX-20 | UX-05, UX-06, UX-20 | UX-05, UX-06, UX-20 | UX-05, UX-06, UX-20 |
| `/clientes` | vendedor | UX-11, UX-21 | UX-11 | UX-11 | UX-11 |
| `/carga` | vendedor | UX-11 | UX-11 | UX-11 | UX-11 |
| `/gastos` | vendedor | UX-17 | UX-17 | UX-17 | UX-17 |
| `/mi-comision` | vendedor | UX-07, UX-11 | UX-07, UX-11 | UX-07, UX-11 | UX-07, UX-11 |
| `/ranking-vendedores` | vendedor | UX-08, UX-11 | UX-08, UX-11 | UX-08, UX-11 | UX-08, UX-11 |
| `/` | bodega | UX-14 | UX-14 | UX-14 | UX-14 |
| `/despachos` | bodega | UX-01, UX-10, UX-11 | UX-10, UX-11 | UX-10, UX-11 | UX-10, UX-11 |
| `/devoluciones` | bodega | UX-09, UX-10, UX-11 | UX-09, UX-10, UX-11 | UX-09, UX-10, UX-11 | UX-09, UX-10, UX-11 |
| `/stock` | bodega | UX-11, UX-19 | UX-11, UX-19 | UX-11, UX-19 | UX-11, UX-19 |
| `/` | producción | UX-14 | UX-14 | UX-14 | UX-14 |
| `/produccion/registrar` | producción | UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 |
| `/produccion/envases` | producción | UX-13 | UX-13 | UX-13 | UX-13 |
| `/produccion/historial` | producción | UX-02, UX-09, UX-13 | UX-09, UX-13 | UX-09, UX-13 | UX-09, UX-13 |
| `/produccion/indicadores` | producción | UX-13 | UX-13 | UX-13 | UX-13 |
| `/produccion/incidencias` | producción | UX-02, UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 |
| `/` | admin sucursal | UX-14 | UX-14 | UX-14 | UX-14 |
| `/ventas` | admin sucursal | UX-15, UX-16 | UX-15, UX-16 | UX-15, UX-16 | UX-15, UX-16 |
| `/ventas/registrar` | admin sucursal | UX-04, UX-05, UX-06, UX-20 | UX-05, UX-06, UX-20 | UX-05, UX-06, UX-20 | UX-05, UX-06, UX-20 |
| `/clientes` | admin sucursal | UX-11, UX-15 | UX-11, UX-15 | UX-11, UX-15 | UX-11, UX-15 |
| `/carga` | admin sucursal | UX-11, UX-15 | UX-11, UX-15 | UX-11, UX-15 | UX-11, UX-15 |
| `/gastos` | admin sucursal | UX-15, UX-17 | UX-15, UX-17 | UX-15, UX-17 | UX-15, UX-17 |
| `/ranking-vendedores` | admin sucursal | UX-08, UX-11 | UX-08, UX-11 | UX-08, UX-11 | UX-08, UX-11 |
| `/despachos` | admin sucursal | UX-01, UX-10, UX-11 | UX-10, UX-11 | UX-10, UX-11 | UX-10, UX-11 |
| `/devoluciones` | admin sucursal | UX-09, UX-10, UX-11 | UX-09, UX-10, UX-11 | UX-09, UX-10, UX-11 | UX-09, UX-10, UX-11 |
| `/stock` | admin sucursal | UX-11, UX-19 | UX-11, UX-19 | UX-11, UX-19 | UX-11, UX-19 |
| `/produccion/registrar` | admin sucursal | UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 |
| `/produccion/envases` | admin sucursal | UX-13 | UX-13 | UX-13 | UX-13 |
| `/produccion/historial` | admin sucursal | UX-02, UX-09, UX-13 | UX-09, UX-13 | UX-09, UX-13 | UX-09, UX-13 |
| `/produccion/indicadores` | admin sucursal | UX-13 | UX-13 | UX-13 | UX-13 |
| `/produccion/incidencias` | admin sucursal | UX-02, UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 |
| `/reportes` | admin sucursal | UX-03 | UX-03 | UX-03 | UX-03 |
| `/ubicaciones` | admin sucursal | UX-03 | UX-03 | UX-03 | UX-03 |
| `/administracion` | admin sucursal | UX-03 | UX-03 | UX-03 | UX-03 |
| `/auditoria` | admin sucursal | UX-03 | UX-03 | UX-03 | UX-03 |
| `/` | admin global | UX-14 | UX-14 | UX-14 | UX-14 |
| `/ventas` | admin global | UX-15, UX-16 | UX-15, UX-16 | UX-15, UX-16 | UX-15, UX-16 |
| `/ventas/registrar` | admin global | UX-04, UX-05, UX-06, UX-20 | UX-05, UX-06, UX-20 | UX-05, UX-06, UX-20 | UX-05, UX-06, UX-20 |
| `/clientes` | admin global | UX-11, UX-15 | UX-11, UX-15 | UX-11, UX-15 | UX-11, UX-15 |
| `/carga` | admin global | UX-11, UX-15 | UX-11, UX-15 | UX-11, UX-15 | UX-11, UX-15 |
| `/gastos` | admin global | UX-15, UX-17 | UX-15, UX-17 | UX-15, UX-17 | UX-15, UX-17 |
| `/ranking-vendedores` | admin global | UX-08, UX-11 | UX-08, UX-11 | UX-08, UX-11 | UX-08, UX-11 |
| `/despachos` | admin global | UX-01, UX-10, UX-11 | UX-10, UX-11 | UX-10, UX-11 | UX-10, UX-11 |
| `/devoluciones` | admin global | UX-09, UX-10, UX-11 | UX-09, UX-10, UX-11 | UX-09, UX-10, UX-11 | UX-09, UX-10, UX-11 |
| `/stock` | admin global | UX-11, UX-19 | UX-11, UX-19 | UX-11, UX-19 | UX-11, UX-19 |
| `/produccion/registrar` | admin global | UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 |
| `/produccion/envases` | admin global | UX-13 | UX-13 | UX-13 | UX-13 |
| `/produccion/historial` | admin global | UX-02, UX-09, UX-13 | UX-09, UX-13 | UX-09, UX-13 | UX-09, UX-13 |
| `/produccion/indicadores` | admin global | UX-13 | UX-13 | UX-13 | UX-13 |
| `/produccion/incidencias` | admin global | UX-02, UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 | UX-12, UX-13 |
| `/reportes` | admin global | UX-03 | UX-03 | UX-03 | UX-03 |
| `/ubicaciones` | admin global | UX-03 | UX-03 | UX-03 | UX-03 |
| `/administracion` | admin global | UX-03 | UX-03 | UX-03 | UX-03 |
| `/auditoria` | admin global | UX-03 | UX-03 | UX-03 | UX-03 |

> Nota: a 375/768 px las rutas de producción del administrador muestran primero el selector de sucursal sin título (UX-13); el overflow UX-02 se verificó con el rol producción (administrador ve el mismo código tras elegir sucursal).

## Hallazgos

Formato: `ID | severidad | rutas/roles/anchos | evidencia | problema | propuesta | archivos | esfuerzo`.

### P1 — alta

**UX-01 | P1 | `/despachos` · bodega, admin, admin global · 375 px**
- Evidencia: `frontend/src/domains/bodega/pages/Despachos.tsx:561-587` (fila del despacho con badges `shrink-0`); captura `capturas/a2-despachos-bodega-375.png` (scrollWidth 382 > 375; nombre truncado a "D." y fecha partida en 4 líneas).
- Problema: la fila mete avatar + nombre/fecha + badge de unidades + badge "Llegada hh:mm" + chevron en una sola línea; en 375 px empuja el nombre a cero y desborda la página horizontalmente.
- Propuesta: bajo `sm` apilar (`flex-col`/`flex-wrap`), badges en segunda línea; `min-w-0` en el bloque de nombre; fecha sin salto. Sin cambiar datos.
- Archivos: `domains/bodega/pages/Despachos.tsx` · Esfuerzo: S

**UX-02 | P1 | `/produccion/incidencias` e `/historial` · producción (y admin tras elegir sucursal) · 375 px**
- Evidencia: `frontend/src/domains/produccion/pages/Produccion.tsx:308-325` (tabla mermas), `frontend/src/domains/produccion/components/HistorialProduccion.tsx:71` (tabla historial) ; capturas `a2-produccion_incidencias-produccion-375.png` (card de "Mermas recientes" 397 px, scrollWidth 397) y `a2-produccion_historial-produccion-375.png` (columna Observación cortada, scroll interno).
- Problema: son `<table>` con `overflow-x-auto`; no se transforman en tarjetas bajo 640 px como exige `docs/engineering/frontend.md` ("Layout and numeric input"). El texto de fecha se parte en 3 líneas y el motivo queda fuera de pantalla.
- Propuesta: aplicar el patrón single-DOM de `RegistrarVenta.tsx:340-370` (`block sm:table-row`, etiquetas `sm:hidden`) o lista de tarjetas `sm:hidden` como en `Clientes.tsx:134-166`. Además `min-w-0` en la card de mermas para eliminar el 397 px.
- Archivos: `domains/produccion/pages/Produccion.tsx`, `domains/produccion/components/HistorialProduccion.tsx`, `domains/produccion/components/IndicadoresProduccion.tsx` (verificar) · Esfuerzo: M

**UX-03 | P1 | `/reportes`, `/ubicaciones`, `/administracion`, `/auditoria` · admin y admin global · todos los anchos**
- Evidencia: `frontend/src/domains/administracion/pages/*.tsx` (10 líneas cada una), `frontend/src/components/ModulePage.tsx:7-14`, `frontend/src/domains/administracion/index.tsx:15-20`; captura `a2-reportes-admin-375.png`, `a2-auditoria-admin-1280.png`.
- Problema: cuatro entradas del menú llevan a una tarjeta con "En construcción". Para el administrador, el menú promete funciones que no existen (Reportes, Auditoría), y no puede administrar nada desde la app.
- Propuesta (sin nuevas funcionalidades): ocultar del menú las rutas sin contenido o marcarlas como "Próximamente" (`aria-disabled`, sin navegación) y mantener las rutas directas con un mensaje claro y enlace de regreso. Indicar HU relacionada en copy interno, no al usuario.
- Archivos: `domains/administracion/index.tsx`, `components/ModulePage.tsx` · Esfuerzo: S

### P2 — media

**UX-04 | P2 | `/ventas/registrar` · vendedor, admin · 375 px**
- Evidencia: `RegistrarVenta.tsx:340-369` (card dentro de card: `p-4` + `p-4`), `:596-607` (CTA al final); captura `a2-ventas_registrar-vendedor-375.png` (página de 2.863 px).
- Problema: cada producto ocupa ~370 px con campos de una columna y "Quitar" izquierdo; con 3 productos precargados el CTA "Confirmar venta" y el total quedan a ~4 pantallas. Sin total visible al editar cantidades.
- Propuesta: compactar la tarjeta (cantidad + precio en 2 columnas en 375, quitar el `p-4` externo), y mostrar una barra fija inferior con "Total a cobrar" + "Confirmar venta" en `<sm`. No cambia el flujo ni el esquema.
- Archivos: `domains/ventas/pages/RegistrarVenta.tsx` · Esfuerzo: M

**UX-05 | P2 | `/ventas/registrar` · todos los anchos *(código)***
- Evidencia: `RegistrarVenta.tsx:242-249` (`setTimeout(() => navigate('/ventas'), 2000)`), `components/toast-utils.ts:19-23` (toast 4 s).
- Problema: tras confirmar, la pantalla navega a los 2 s y el Toast con el folio desaparece con la página; `/ventas` no muestra la última venta, y el folio sólo tiene 8 caracteres. El usuario no puede verificar lo registrado ni copiar el folio.
- Propuesta: mostrar el resumen de éxito (folio, total, cliente) con botones "Registrar otra venta" / "Ir a Ventas", sin redirección automática; o navegar con el estado del folio y mostrarlo en `/ventas`.
- Archivos: `domains/ventas/pages/RegistrarVenta.tsx` (+ `Ventas.tsx` si se muestra el folio; ver lote) · Esfuerzo: M

**UX-06 | P2 | `/ventas/registrar` · vendedor, admin, admin global · todos los anchos**
- Evidencia: `RegistrarVenta.tsx:305-313` (aviso pequeño `text-xs` sólo para clientes), `:199-218` (carga validada sólo al enviar), `:277-281`; captura `a2-ventas_registrar-vendedor-1280.png` ("Disponible: —" en todas las filas).
- Problema: sin carga asignada o sin clientes el formulario se ve completo y utilizable, y el error aparece recién al pulsar "Confirmar". Prevención de errores débil. El administrador sin cartera propia tampoco recibe explicación.
- Propuesta: banner arriba ("Aún no tienes carga asignada hoy; pídela a bodega" / "Crea un cliente para continuar") y deshabilitar "Confirmar venta" con `aria-describedby` al motivo.
- Archivos: `domains/ventas/pages/RegistrarVenta.tsx` · Esfuerzo: S

**UX-07 | P2 | `/mi-comision` · vendedor · todos los anchos**
- Evidencia: `MiComision.tsx:81` (`capitalize` sobre la fecha), `:119` (`capitalize` sobre `item.tipo`), `:26-35` (carga/error sin `<h1>`); captura `a2-mi-comision-vendedor-375.png` ("Jornada: 13 De Octubre De 2026").
- Problema: "De" mal capitalizado; `tipo` crudo de BD; en carga y error la pantalla cambia de estructura sin título; botón "Reintentar" sin `btnSecondary`.
- Propuesta: quitar `capitalize` y capitalizar sólo la primera letra; mapear `tipo` a etiquetas en español; mantener `<h1>` en todos los estados; usar `btnSecondary`.
- Archivos: `domains/ventas/pages/MiComision.tsx` · Esfuerzo: S

**UX-08 | P2 | `/ranking-vendedores` · vendedor, admin · todos los anchos**
- Evidencia: `RankingVendedores.tsx:16` (`new Date().toISOString().slice(0,7)`: mes en UTC), `:52-128` (clases `text-gray-*`, `font-semibold`, `shadow-sm` sin borde, no `cardCls`/slate), `:86-87` (error sin `role="alert"` ni reintento), `:2` (Mantine sólo para el selector de mes); captura `a2-ranking-vendedores-vendedor-375.png`.
- Problema: (a) tras las 20:00–21:00 hora Chile el último día del mes el "mes actual" ya es el siguiente; (b) tipografía y tarjetas distintas del resto del módulo (la misma divergencia está en Mi comisión); (c) el nombre largo no trunca (`flex` sin `min-w-0`); (d) sin énfasis a los primeros lugares ni resalte de "tú".
- Propuesta: calcular el mes con `Intl` en `America/Santiago` (como `MiComision.tsx:37`), usar `cardCls`/`text-slate-*`/`font-bold`, `role="alert"` + botón de reintento, `truncate`. Evaluar sustituir Mantine por `<input type="month">` (peso del bundle).
- Archivos: `domains/ventas/pages/RankingVendedores.tsx` · Esfuerzo: M

**UX-09 | P2 | `/produccion/historial`, `/devoluciones`, `/despachos` · producción, bodega, admin · todos los anchos**
- Evidencia: `lib/ui.ts` `fmtFecha` ("13/10, 10:03 p. m."), `Produccion.tsx:223` (`toLocaleString('es-CL', {timeZone})`), `Produccion.tsx:325` (`toLocaleString('es-CL')` sin zona → "13-10-2026, 10:03:17 p. m."), `HistorialProduccion.tsx:62-63` y `Devoluciones.tsx:450` (`type="date"`, muestra `mm/dd/yyyy` en el navegador en inglés); captura `a2-produccion_historial-produccion-375.png`.
- Problema: tres formatos de fecha distintos en el mismo módulo; el año sólo aparece en algunos; segundos innecesarios; sin zona horaria explícita en algunos; selector de fecha en inglés.
- Propuesta: un único helper `fmtFechaHora` (es-CL, `America/Santiago`, `dd-mm-aaaa hh:mm`) en `lib/ui.ts`/`lib/format.ts` y usarlo en todas partes; etiquetar "Desde/Hasta" con formato esperado.
- Archivos: `lib/ui.ts` (+ consumo en archivos de los lotes B1/B2) · Esfuerzo: S

**UX-10 | P2 | `/despachos`, `/devoluciones` · bodega, admin · todos los anchos**
- Evidencia: `Despachos.tsx:201,382`, `Devoluciones.tsx:142` (`'Desconocido'`), `Despachos.tsx:80-85` (avatar con iniciales); capturas `a2-devoluciones-bodega-375.png`, `a2-despachos-bodega-1280.png`.
- Problema: cuando el vendedor del despacho no está en el listado (inactivo/otra sucursal) se muestra "Desconocido" con avatar "D"; en Devoluciones no se distingue un despacho de otro (misma etiqueta, misma hora). Causa de datos a confirmar; la UI debe degradar mejor.
- Propuesta: fallback "Vendedor no disponible" + identificador corto del despacho (`#abc123`) y hora; en Devoluciones mostrar total de unidades y vendedor en la tarjeta.
- Archivos: `domains/bodega/pages/Despachos.tsx`, `domains/bodega/pages/Devoluciones.tsx` · Esfuerzo: S

**UX-11 | P2 | casi todas las rutas con datos · todos los anchos**
- Evidencia: `Despachos.tsx:422`, `Devoluciones.tsx:376`, `Stock.tsx:109` (la página entera es sólo "Cargando..."), `MiComision.tsx:26`, `Carga.tsx:31-35` / `Ventas.tsx:99-102` / `Gastos.tsx:141-144` / `RankingVendedores.tsx:86-87` (errores sin reintento), `Clientes.tsx:67-71` y `SucursalSelector.tsx:22-24` (botón `btnPrimary` dentro de un párrafo de error), `domains/*/index.tsx` (fallback `Cargando página...` sin estilo).
- Problema: no hay un patrón común para cargando/vacío/error: unas pantallas pierden el título mientras cargan, otras no ofrecen reintentar, y los botones de reintento tienen jerarquías distintas.
- Propuesta: componente compartido `EstadoVista` (cargando con `role="status"`, vacío con icono/CTA, error con `role="alert"` + reintentar `btnSecondary`) y reemplazar los fallbacks. Es mejora de lo existente, no feature nueva.
- Archivos: nuevo `components/EstadoVista.tsx` + consumo en cada lote por dominio (ver Fase B) · Esfuerzo: M

**UX-12 | P2 | `/produccion/registrar`, `/produccion/incidencias` · producción, admin · todos los anchos**
- Evidencia: `Produccion.tsx:164-181` (banners `setExito`/`setError` inline) vs Toast usado en ventas (`Gastos.tsx:25,46`); docs: `docs/engineering/frontend.md` "Feedback".
- Problema: producción usa banners persistentes en la parte superior, lejos del botón pulsado (en 375 px el usuario no los ve); el banner de éxito no se cierra solo, y las convenciones piden `useToast` para escrituras.
- Propuesta: usar `useToast`/`Toast` para éxito y error de mutaciones; mantener `errorBlockCls` sólo para errores de lectura.
- Archivos: `domains/produccion/pages/Produccion.tsx` · Esfuerzo: S

**UX-13 | P2 | `/produccion/*` · producción, admin, admin global · todos los anchos**
- Evidencia: `Produccion.tsx:166-173` (mismo `<h1>Producción` y subtítulo para las 5 rutas), `domains/produccion/index.tsx:10-26` (cinco rutas que montan la misma página); capturas `a2-produccion_indicadores-produccion-375.png`, `a2-produccion_historial-admin-1280.png`.
- Problema: la sección activa sólo se distingue en el menú lateral (oculto en móvil/tablet); el título no cambia ("Producción") y para admin sin sucursal la página empieza con un selector sin título. No hay breadcrumb ni sub-navegación visible en la página.
- Propuesta: título dinámico por sección ("Producción · Historial") y descripción acorde; selector de sucursal bajo el título; pestañas/enlaces de sección visibles en <lg.
- Archivos: `domains/produccion/pages/Produccion.tsx` (+ `index.tsx` sólo si se agregan metadatos de ruta) · Esfuerzo: M

**UX-14 | P2 | shell (todas las rutas) · todos los roles/anchos**
- Evidencia: `components/DashboardLayout.tsx:162-169` (botón "Notificaciones" sin `onClick` y punto rojo fijo), `:179-183` (nombre y rol ocultos <md); captura `a2-inicio-vendedor-375.png`.
- Problema: la campana parece funcional y siempre indica algo pendiente, pero no hace nada: pérdida de confianza y ruido visual. Sin nombre/rol visible en móvil ni migas de pan ni título de pestaña por ruta.
- Propuesta: ocultar campana (o `disabled` con tooltip "Próximamente") hasta que exista; mostrar rol/sucursal en el menú lateral móvil; `document.title` por ruta.
- Archivos: `components/DashboardLayout.tsx` · Esfuerzo: S

**UX-15 | P2 | `/ventas`, `/carga`, `/clientes`, `/gastos`, `/ventas/registrar` · admin, admin global · todos los anchos**
- Evidencia: `Ventas.tsx:21` ("Resumen de tu ruta"), `Carga.tsx:17` ("asignados a tu ruta"), `Clientes.tsx:42` ("de tu ruta"), `Gastos.tsx:62`; captura `a2-clientes-admin-375.png`.
- Problema: el administrador entra a pantallas redactadas para el vendedor ("Mi carga", "tu cartera") donde no tiene datos propios; en Clientes sí hay selector, en Ventas/Carga/Gastos no.
- Propuesta: copy dependiente del rol (`perfil.rol`) y, donde no aplique, estado vacío explicativo ("Selecciona un vendedor en Clientes para ver su cartera").
- Archivos: `domains/ventas/pages/Ventas.tsx`, `Carga.tsx`, `Clientes.tsx`, `Gastos.tsx` · Esfuerzo: S

### P3 — baja

**UX-16 | P3 | `/ventas` · vendedor/admin.** `Ventas.tsx:38` ("Una sola confirmación atómica"), `:126-135` (CTAs duplicados que repiten las tarjetas de arriba), `RegistrarVenta.tsx:603` ("El total y el descuento de carga los calcula la base de datos"). Jerga técnica; la página "Ventas" no lista ventas. Propuesta: copy en lenguaje del vendedor ("Cliente, productos y pago en un solo paso") y retirar los CTAs duplicados. Archivos: `Ventas.tsx`, `RegistrarVenta.tsx` · S.

**UX-17 | P3 | `/gastos` · vendedor/admin.** `Gastos.tsx:35` (tipo por defecto `otra`), `:18-20,138` (monto sin símbolo `$`, formato distinto a `Intl` currency de `MiComision.tsx:67-72`), sin confirmación ni forma de anular; "Total: 0". Propuesta: sin tipo preseleccionado (obligar elección) o `combustible` como más frecuente, mostrar `$`, unificar `formatearMoneda` en `lib/format.ts`. Archivos: `Gastos.tsx`, `lib/format.ts` · S.

**UX-18 | P3 | `/login` · todos.** `pages/Login.tsx:57,69` (inputs sin `min-h-11`, a diferencia de `inputCls`), sin mostrar/ocultar contraseña. Propuesta: usar `inputCls`, botón "Mostrar" con área ≥44 px. Archivos: `pages/Login.tsx` · S.

**UX-19 | P3 | `/stock` · bodega/admin.** `Stock.tsx:171-173` (botón "Exportar Excel" deshabilitado sin explicación), `:165` (`btnPrimary` para "Actualizar", mientras `Carga.tsx:22` y `Produccion.tsx:174` usan `btnSecondary`). Propuesta: ocultar el botón o añadir `title`/texto "Disponible próximamente"; unificar jerarquía de "Actualizar" como secundario. Archivos: `Stock.tsx` · S.

**UX-20 | P3 | varias · todos los roles.** `RegistrarVenta.tsx:308` (enlace "Crea uno primero" de 14 px de alto), `components/Toast.tsx:21-27` (botón "✕" sin `min-h-11 min-w-11`), `RegistrarVenta.tsx:475-482` ("Quitar" sin icono/contraste de acción destructiva). Propuesta: `inline-flex min-h-11 items-center`, área táctil del cierre del toast, `btnDanger`/texto rojo para Quitar. Archivos: `Toast.tsx`, `RegistrarVenta.tsx` · S.

**UX-21 | P3 | `/clientes` (modal "Nuevo cliente") · vendedor, 375 px.** `RegistrarCliente.tsx:161-168` (`type="text"` sin `inputMode="tel"` ni `autoComplete`), `:136,150`. El teclado móvil no es el telefónico. Propuesta: `type="tel" inputMode="tel"`; `autoCapitalize="words"` para el nombre. Archivos: `domains/ventas/pages/RegistrarCliente.tsx` · S.

## Fortalezas observadas

- Cero overflow del documento en vendedor y bodega salvo UX-01; controles principales ≥ 44 px (#52).
- Clientes y Stock ya usan tabla→tarjetas / tablas simples con `overflow-x-auto` sin romper el layout.
- Menú móvil con foco, `Escape`, `aria-expanded` y estado activo correcto (`DashboardLayout.tsx:34-50,95-106`).
- Inputs numéricos con `inputMode="numeric"` y miles en vivo; mensajes de error en español junto al campo.
- Consola del navegador sin errores/avisos en todos los recorridos.

## Lotes propuestos para Fase B

Lotes **sin solapamiento de archivos**. Orden recomendado: B5 primero (crea `EstadoVista` y helpers) y luego B1–B4 en paralelo.

| Lote | Hallazgos | Archivos (exclusivos del lote) | Esfuerzo |
|---|---|---|---|
| **B1 — Bodega** | UX-01, UX-10, UX-19, UX-11 (parte bodega), UX-09 (consumo en bodega) | `frontend/src/domains/bodega/pages/Despachos.tsx`, `Devoluciones.tsx`, `Stock.tsx` y sus tests colocados; `bodega/index.tsx` (fallback) | M |
| **B2 — Producción** | UX-02, UX-12, UX-13, UX-09 (consumo en producción), UX-11 (parte producción) | `frontend/src/domains/produccion/pages/Produccion.tsx`, `produccion/components/HistorialProduccion.tsx`, `IndicadoresProduccion.tsx` y tests; `produccion/index.tsx` | M |
| **B3 — Registrar venta** | UX-04, UX-05, UX-06, UX-16 (copy de registrar), UX-20 (parte venta) | `frontend/src/domains/ventas/pages/RegistrarVenta.tsx`, `RegistrarVenta*.test.tsx` | M |
| **B4 — Ventas lectura/gestión** | UX-07, UX-08, UX-15, UX-16 (copy de Ventas), UX-17, UX-21, UX-11 (parte ventas) | `frontend/src/domains/ventas/pages/MiComision.tsx`, `RankingVendedores.tsx`, `Ventas.tsx`, `Carga.tsx`, `Clientes.tsx`, `Gastos.tsx`, `RegistrarCliente.tsx`, tests; `ventas/index.tsx` | M |
| **B5 — Shell y componentes compartidos** | UX-03, UX-14, UX-18, UX-20 (Toast), UX-09 (helper), UX-11 (componente) | `frontend/src/components/DashboardLayout.tsx`, `ModulePage.tsx`, `Toast.tsx`, `SucursalSelector.tsx`, nuevo `components/EstadoVista.tsx`, `frontend/src/lib/ui.ts`, `lib/format.ts`, `pages/Login.tsx`, `domains/administracion/index.tsx` y `administracion/pages/*` | M |

Dependencias, no solapamientos: B1–B4 consumen `EstadoVista` y el helper de fecha de B5, por lo que deben integrarse después de B5. Ningún archivo aparece en más de un lote.

Verificación sugerida para cada lote: `npm run lint && npm run build && npx vitest run <dominio>` y revisión visual a 375/768/1024/1280.
