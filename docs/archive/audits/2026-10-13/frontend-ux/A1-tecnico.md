# A1 — Diagnóstico técnico del frontend de Ondina

Fecha de evidencia: **2026-10-13**, America/Santiago. Beads: **OND-c07.1**. Rama examinada: `Cristhian-S1/fux-a1-tecnico`; base y código auditado: `40c152bb435d06af9baea9d1e1fe0b051bc76621`.

## Resultado ejecutivo

Se identifican **19 hallazgos: 2 P1, 12 P2 y 5 P3; ninguno P0**. Los dos P1 son una carrera de respuestas que mezcla la sucursal elegida con vendedores/stock de otra sucursal, y la presentación de ceros como resultado de una consulta fallida de indicadores. Ambos se reprodujeron en navegador con respuestas de lectura controladas, sin escribir datos de negocio.

La base tiene mejoras efectivas: separación por dominios, páginas lazy, guardas por roles del router, cliente compartido, RHF/Zod con tipos de entrada/salida, errores públicos en español, diálogos nativos y pruebas. **Lint, build, presupuesto y 529 pruebas unitarias pasan**. Eso no elimina los defectos de interacción, accesibilidad y coherencia descritos aquí.

## Alcance, método y límites

- Revisión de `AGENTS.md`, `CLAUDE.md`, `README.md`, índice documental y guías de frontend/rendimiento; `bd prime` sólo para recuperar contexto. No se crearon ni cerraron issues.
- `.codegraph/` no existe en este worktree: se usaron inventario, búsquedas y lectura de código con líneas verificadas, sin crear un índice.
- App ejecutada con `npm run dev -- --port 5181 --strictPort` desde `frontend/`, usando exclusivamente `http://127.0.0.1:54321`. `frontend/.env.local` está ignorado y no se incluye en el commit. Las claves y los tokens se excluyen de la evidencia.
- Node `v26.3.1`, Chrome `155.0.8059.39`, Playwright disponible en la caché de npx. El proyecto declara Node `^22.12.0`: los resultados no sustituyen una ejecución de CI con Node 22.
- Primera entrada e inicio de sesión comprobados en el navegador embebido de Orca. Recorrido sistemático y pruebas dirigidas en Chrome headless con Playwright, zona horaria America/Santiago, a **375×812, 768×1024 y 1280×900**, escala 1.
- Cinco cuentas sintéticas locales: vendedor, bodega, producción, administrador de sucursal A y administrador global. Las filas existentes son fixtures locales compartidas; no se cargaron datos de producción ni se crearon registros de negocio durante la auditoría.
- Cada navegación de la matriz se realizó con carga de documento para comprobar acceso directo. Las vistas de producción de administradores también se comprobaron después de seleccionar la sucursal A y esperar a que terminaran las cargas. Las pruebas dirigidas sí incluyen interacciones dentro de la página.
- Se registraron errores/warnings de consola, excepciones de página, solicitudes fallidas, respuestas REST y desbordamiento del documento. Las cifras de solicitudes son de **desarrollo**, con StrictMode; no son una medición de transferencia ni de latencia de producción.
- Fallos 503 y latencias de los P1 se inyectaron sólo en el navegador, sobre lecturas locales. No se tocaron esquema, migraciones, backend, publicación Realtime, Supabase cloud ni Vercel. No se ejecutó `test:integration`.
- No se midieron INP, React Profiler, lectores de pantalla reales ni carga con miles de filas. Las observaciones sobre escala o renders se distinguen de los defectos reproducidos. No se reutilizaron los valores Lighthouse históricos como una medición actual.
- Propiedad de entrega: este informe y **11 PNG `capturas/a1-*`**, todos menores a 300 KB. Ningún cambio en `frontend/src`. Las propuestas son trabajo futuro, no aceptación de HU pendientes o funcionalidades del Sprint 2.

## Cobertura de ejecución por rutas y roles

Leyenda: **A** = la ruta abre con el rol indicado; **R** = redirige al inicio; **→** = alias a registrar producción. Cada celda se comprobó en los tres anchos. `Admin A` y `Admin global` son cuentas distintas.

| Ruta | Vendedor | Bodega | Producción | Admin A | Admin global |
| --- | --- | --- | --- | --- | --- |
| `/` | A | A | A | A | A |
| `/ventas` | A | R | R | A | A |
| `/ventas/registrar` | A | R | R | A | A |
| `/clientes` | A | R | R | A | A |
| `/carga` | A | R | R | A | A |
| `/gastos` | A | R | R | A | A |
| `/mi-comision` | A | R | R | R | R |
| `/ranking-vendedores` | A | R | R | A | A |
| `/despachos` | R | A | R | A | A |
| `/devoluciones` | R | A | R | A | A |
| `/stock` | R | A | R | A | A |
| `/produccion` | R | R | → | → | → |
| `/produccion/registrar` | R | R | A | A | A |
| `/produccion/envases` | R | R | A | A | A |
| `/produccion/historial` | R | R | A | A | A |
| `/produccion/indicadores` | R | R | A | A | A |
| `/produccion/incidencias` | R | R | A | A | A |
| `/reportes` | R | R | R | A | A |
| `/ubicaciones` | R | R | R | A | A |
| `/administracion` | R | R | R | A | A |
| `/auditoria` | R | R | R | A | A |

**315 combinaciones** = 21 rutas × 5 cuentas × 3 anchos: 177 accesos/alias permitidos y 138 redirecciones. No quedaron vistas cargando al cerrar la pasada. En estas navegaciones normales hubo **1.287 respuestas HTTP locales capturadas, todas 200**, cero excepciones de página y cero mensajes `console.error`/`console.warning`, incluidos warnings React de keys, controles o hooks. Esto no prueba que los fallos excepcionales no existan: los P1 requieren latencia o fallo inducidos.

`/login` se comprobó adicionalmente con campos vacíos, credenciales sintéticas válidas y contraseña incorrecta. Las cuatro pantallas de administración muestran **“En construcción”**; su placeholder es explícito (`frontend/src/components/ModulePage.tsx:11`, `frontend/src/domains/administracion/pages/Reportes.tsx:5`). Se registra el límite sin proponer completar HU fuera de alcance. La matriz confirma guardas de UI, no una auditoría de RLS.

## 1. Calidad de código React

Se revisaron tamaño, duplicación, efectos, keys, estado derivado y memoización. No se recomienda envolver componentes indiscriminadamente en `memo`/`useMemo`: los mapas de productos/carga y el resumen de indicadores tienen dependencias pertinentes. `useFieldArray` usa `field.id` y la venta mantiene un único árbol de controles responsive (`frontend/src/domains/ventas/pages/RegistrarVenta.tsx:154`, `:368`). Los efectos de sesión, diálogo y suscripción sincronizan recursos externos y tienen una razón válida.

| ID | Severidad | Rutas / roles / anchos | Evidencia | Problema | Propuesta concreta | Archivos a tocar | Esfuerzo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1-01 | **P1 alta** | `/despachos`, `/devoluciones`; administrador global; mecanismo independiente del ancho, reproducción 1280 | `frontend/src/domains/bodega/pages/Despachos.tsx:164`, `:177`, `:204`, `:230`; `frontend/src/domains/bodega/pages/Devoluciones.tsx:106`, `:119`, `:145`, `:170`; [captura de carrera](capturas/a1-despachos-race-admin-global-1280.png) | `load` e `init` carecen de cancelación/versionado y sus resultados escriben estado aunque haya cambiado la sucursal. Reproducido en Despachos: B inicia una lectura lenta, A responde con stock 222, luego B sobrescribe con stock 111 y vendedores de B; el selector sigue en A. Devoluciones repite el patrón por inspección, sin una segunda reproducción independiente. Además, durante el cambio siguen disponibles los datos anteriores y el alta de despacho. | Lecturas con clave por identidad/sucursal y resultado consumido sólo por esa clave; cancelar/descartar respuestas obsoletas. Vaciar o bloquear la vista/formulario durante el cambio y reiniciar el borrador de la sucursal anterior. Regresión con A→B→A y respuesta B tardía; no cambiar RLS ni lógica de stock. | `bodega/pages/Despachos.tsx`, `Devoluciones.tsx`, sus pruebas; nuevo hook de lectura de bodega | M |
| A1-02 | P2 media | Despachos/Devoluciones; bodega y administradores; 375/768/1280 | `frontend/src/domains/bodega/pages/Despachos.tsx:101`, `:177`, `:348`; `frontend/src/domains/bodega/pages/Devoluciones.tsx:68`, `:119`, `:177` | Componentes de **933 y 739 líneas** mezclan carga, normalización, filtros, formularios, límites e interacción. Repiten arranque de sucursales, dos etapas de lecturas, cálculo de totales, nombres y filtros diarios. La duplicación replica A1-01 y hace costoso corregir una única regla visual o de carga. | Extraer lectura y normalización a un hook/modelo de bodega; extraer filtros y formulario de despacho en componentes con interfaz pequeña. Conservar la política de devoluciones, las RPC atómicas y sus claves de reintento. Validar equivalencia con las pruebas existentes y casos de carrera. | Las dos páginas, sus pruebas y nuevos hooks/componentes/modelo bajo `bodega/` | L |
| A1-03 | P3 baja | `/ventas/registrar`; vendedor; todos los anchos | `frontend/src/domains/ventas/pages/RegistrarVenta.tsx:164`, `:166`, `:191`, `:353`, `:567` | La suscripción a todo el formulario y otra suscripción a detalles hacen renderizar el componente de 617 líneas con cada tecla, incluso Observaciones; se serializa el borrador en `sessionStorage` en cada cambio y el subtotal vuelve a calcularse en el JSX. No se midió una demora de interacción; hay pocos productos por venta. | Separar filas y resumen con suscripciones de campo, reutilizar el subtotal y agrupar persistencia del borrador, garantizando flush al salir. Medir commits/INP antes y después; no añadir memoización sin una reducción demostrable. | `ventas/pages/RegistrarVenta.tsx`, pruebas de venta/borrador; nuevos componentes locales | M |
| A1-04 | P3 baja | Modal de `/despachos`; bodega/administradores; todos los anchos | `frontend/src/domains/bodega/pages/Despachos.tsx:803`, `:805`, `:868` | Filas que se pueden insertar y quitar usan `key={index}`. Al borrar una fila anterior React reutiliza la identidad de los controles de otra fila; el valor es controlado, pero el foco/identidad de interacción deja de representar la misma línea. No hubo warning React: un índice sigue siendo una key válida sintácticamente. | Asignar un ID local estable al crear cada línea y usarlo como key; probar eliminación de una fila anterior mientras se edita otra con teclado. | `bodega/pages/Despachos.tsx`, `Despachos.test.tsx` | S |
| A1-18 | P3 baja | Despachos/Devoluciones abiertas al cambiar de día; todos los roles autorizados y anchos | `frontend/src/domains/bodega/pages/Despachos.tsx:348`, `:361`, `:363`; `frontend/src/domains/bodega/pages/Devoluciones.tsx:177`, `:190`, `:192` | `diaObjetivo` memoiza `new Date()` sólo por filtro/fecha. Si la pantalla permanece abierta a medianoche, “Hoy” conserva el día anterior incluso si llegan datos nuevos. Es un defecto deducido del código; no se esperó una medianoche real. | Incluir una jornada reactiva America/Santiago y refrescar al cruce de día/reanudación. Regresión con reloj controlado; mantener derivado el filtrado, sin copiarlo a estado mediante otro efecto. | Las dos páginas, pruebas y modelo de fechas de bodega | S |

## 2. Estado y datos: React Query, carga, error y vacío

El `QueryClient` es estable y declara `staleTime: 30_000`, un reintento y sin refetch por foco global (`frontend/src/main.tsx:16`). Las claves de clientes, producción, dashboard y stock incluyen la identidad o ámbito relevante; AuthProvider limpia la caché ante cambio de identidad/rol/sucursal (`frontend/src/context/AuthProvider.tsx:7`, `:74`). Mi Comisión sí sobrescribe el refetch por foco (`frontend/src/domains/ventas/pages/MiComision.tsx:18`). No se observó un N+1 por fila en las lecturas de bodega: sus detalles se piden en grupos; el problema es la amplitud del grupo y la carga manual duplicada.

| ID | Severidad | Rutas / roles / anchos | Evidencia | Problema | Propuesta concreta | Archivos a tocar | Esfuerzo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1-05 | **P1 alta** | Historial/Indicadores de producción; producción/administradores; reproducción 768 | `frontend/src/domains/produccion/components/IndicadoresProduccion.tsx:38`, `:50`, `:52`; `frontend/src/domains/produccion/components/HistorialProduccion.tsx:28`, `:66`, `:70`; [indicadores](capturas/a1-produccion-indicators-produccion-768.png), [historial](capturas/a1-produccion-history-produccion-768.png) | Al fallar la consulta se muestra un aviso, pero también **0 unidades, 0 registros y “No hay producción”**; Historial anuncia “No hay registros”. Con 503 de lectura se reproduce esa contradicción. Si había datos anteriores, siguen representándose sin indicar que son previos. El error no equivale a un resultado vacío. | Estados exclusivos de carga/error/vacío/éxito, botón de reintento específico y métricas “—” si no existe dato válido. Si se conserva caché, marcar explícitamente la fecha y condición de dato anterior. Probar primer fallo y fallo tras una lectura exitosa. | Ambos componentes y pruebas; hook de producción si se migra su lectura a Query | M |
| A1-06 | P2 media | Venta→Mi Comisión; vendedor; todos los anchos | `frontend/src/domains/ventas/hooks/useRegistrarVenta.ts:49`, `:50`; `frontend/src/domains/ventas/pages/MiComision.tsx:9`, `:18`; `frontend/src/domains/ventas/pages/RegistrarVenta.tsx:248` | El éxito invalida `['ventas','carga']` y `['ventas','historico']`, pero Mi Comisión usa `['mi-comision', id, sucursal]`. Volver a Comisión antes de 30 s puede conservar el total previo. El refetch por foco no se dispara necesariamente en navegación dentro de la SPA. La página además llama `carga.refetch()` después de que el hook ya invalidó esa consulta. | Centralizar las claves del dominio e invalidar explícitamente comisión tras éxito; mantener un único responsable del refresco de carga. Prueba de navegación dentro de la misma SPA, sin evento de foco ni esperar staleTime. La llamada a histórico no tiene consumidor encontrado en este árbol. | Hook de venta, página de venta, MiComision y sus pruebas; nuevo archivo de claves de ventas | S |
| A1-07 | P2 media | Cinco secciones de producción; producción/administradores; todos los anchos | `frontend/src/domains/produccion/hooks/useDatosProduccion.ts:8`, `:11`, `:14`; `frontend/src/domains/produccion/pages/Produccion.tsx:65`, `:353`, `:354`; `frontend/src/domains/produccion/components/HistorialProduccion.tsx:23` | Todas las secciones esperan productos, empaques, producción reciente, mermas e incidencias; sólo después se consulta stock de envases. Historial/Indicadores montan entonces otra lectura propia. Una pantalla de indicadores depende de que funcione la consulta de incidencias, y una invalidación general vuelve a ejecutar el paquete. La espera de stock necesita los empaques para normalizar, no para empezar la petición. | Separar catálogos compartidos y consultas por sección/ámbito. Solicitar stock en paralelo con empaques y unir resultados al resolver ambos. Montar consultas de historial/indicadores sin esperar lecturas irrelevantes. Invalidar sólo recursos afectados, conservando limpieza de la suscripción. Medir número/orden de requests y recuperación de fallo parcial. | `produccion/hooks/useDatosProduccion.ts`, `api.ts`, página y dos componentes, sus pruebas; nuevos hooks | M |
| A1-13 | P2 media | `/ranking-vendedores`, `/gastos`, errores de lectura de venta; vendedor/administradores; todos los anchos | `frontend/src/domains/ventas/pages/RankingVendedores.tsx:23`, `:41`, `:87`; `frontend/src/domains/ventas/pages/Gastos.tsx:23`, `:144`; `frontend/src/domains/ventas/pages/RegistrarVenta.tsx:277`; [ranking fallido](capturas/a1-ranking-error-vendedor-768.png) | Ranking usa un efecto manual, sin caché, `role=alert` ni reintento del mismo mes. El fallo reproducido obliga a recargar o cambiar de período. Gastos y venta también indican “Inténtalo de nuevo” sin una acción para reejecutar sus lecturas; con foco global desactivado el usuario no tiene una recuperación local clara. | Ranking con clave de mes/ámbito y estados Query; añadir reintento de lecturas, sin reenviar mutaciones. Error persistente anunciado; carga con `role=status`. Probar fallo y recuperación en el mismo período y con formulario parcialmente lleno. | Tres páginas y pruebas; nuevo hook de ranking | M |

**Comprobación aislada de A1-06:** con el paquete instalado `@tanstack/react-query`, se introdujo una entrada `['mi-comision','perfil','sucursal']` en un `QueryClient`, se ejecutaron exactamente las dos invalidaciones del hook y `getQueryState(...).isInvalidated` devolvió **false**. Es evidencia de coincidencia de claves, no una venta ejecutada ni una reproducción integral de esa navegación. TanStack documenta la [coincidencia por prefijo y la invalidación](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation).

## 3. Rendimiento: rutas, dependencias, listas y renders

El split por ruta está implementado: ventas declara siete imports lazy y producción/administración/bodega sus páginas (`frontend/src/domains/ventas/index.tsx:16`, `frontend/src/domains/produccion/index.tsx:9`, `frontend/src/domains/bodega/index.tsx:9`, `frontend/src/domains/administracion/index.tsx:9`). Dashboard permanece estático (`frontend/src/App.tsx:5`). El chunk grande de Ranking corresponde a una ruta que importa Mantine Dates y la localización dayjs (`frontend/src/domains/ventas/pages/RankingVendedores.tsx:2`); no se carga ese JS como parte de `/login`. Los estilos de Mantine Core/Dates sí se importan globalmente (`frontend/src/main.tsx:9`).

Medición fresca del build, bytes exactos; gzip calculado con `node:zlib.gzipSync`, igual que el verificador de presupuesto. Son tamaños de archivos, no transferencia HTTP negociada ni tiempos de red.

| Artefacto | Bytes sin comprimir | Bytes gzip |
| --- | ---: | ---: |
| Entry `index-*.js` | 312.573 | 99.176 |
| `supabase-*.js`, preload inicial | 224.500 | 58.282 |
| CSS global `index-*.css` | 290.723 | 43.619 |
| **Conjunto inicial anterior** | **827.796** | **201.077** |
| `RankingVendedores-*.js`, diferido | 179.139 | 53.526 |
| `toast-utils-*.js`, compartido diferido | 110.911 | 32.711 |

El nombre `toast-utils` es un nombre de chunk del bundler, no una medición aislada del componente Toast ni prueba de que exista una dependencia de notificaciones Mantine. El presupuesto vigente pasa: entry JS +3,3%, CSS +0,3%, mayor chunk +3,5%. No se infiere una regresión de carga inicial a partir del tamaño bruto de Ranking.

| ID | Severidad | Rutas / roles / anchos | Evidencia | Problema | Propuesta concreta | Archivos a tocar | Esfuerzo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1-08 | P2 media | Despachos/Devoluciones; bodega/administradores; todos los anchos, riesgo al crecer historial | `frontend/src/domains/bodega/api.ts:62`, `:69`, `:78`; `frontend/src/domains/bodega/pages/Despachos.tsx:190`, `:210`, `:363`, `:544`; `frontend/src/domains/bodega/pages/Devoluciones.tsx:131`, `:151`, `:192`, `:499` | Se trae el historial de la sucursal sin rango/paginación explícita y luego sus detalles/devoluciones por lista de IDs. “Hoy” se filtra en memoria; se recorren colecciones para cada despacho aun cerrado. Se vuelve a hacer al entrar a Devoluciones. Hay riesgo de respuesta grande o truncamiento por un límite del servidor, no medido con los pocos fixtures. | Rango/fecha y paginación en el servicio, detalles del grupo visible y normalización por ID. Compartir caché entre pantallas y diferir detalles cerrados. Elegir virtualización sólo después de medir listas grandes; no es la primera corrección. Añadir casos de límite/página y navegación sin descarga completa. | `bodega/api.ts`, dos páginas, pruebas y nuevo modelo/hook de bodega | L |
| A1-09 | P2 media | Despachos/Devoluciones; bodega y administradores; **375**; 768/1280 sin este desbordamiento en la pasada base | `frontend/src/domains/bodega/pages/Despachos.tsx:472`, `:572`; `frontend/src/domains/bodega/pages/Devoluciones.tsx:482`, `:559`, `:560`; [despachos](capturas/a1-despachos-bodega-375.png), [detalle devolución](capturas/a1-devoluciones-bodega-375.png) | Despachos mide **382 px** de documento en 375 al mostrar los badges de llegada. Devoluciones parece caber sin selección, pero al abrir un despacho el documento crece a **553 px** y las columnas de devolución quedan fuera. El contenedor de tabla usa `overflow-hidden` y falta limitar el mínimo de la columna del grid. | `min-w-0` en los hijos de grid, apilar/wrap de badges en móvil y un árbol de tabla/card responsive para el detalle de devolución. Si se conserva tabla, scroll sólo dentro de una región accesible, sin ampliar el documento. Probar con selección, etiquetas largas y teclado a los tres anchos. | Ambas páginas y pruebas de bodega | M |
| A1-10 | P2 media | `/produccion/incidencias`; producción y administradores; **375**, reproducción con mermas locales existentes | `frontend/src/domains/produccion/pages/Produccion.tsx:228`, `:229`, `:298`, `:308`; [incidencias móvil](capturas/a1-produccion-incidencias-produccion-375.png) | El segundo grid contiene formulario y lista de mermas. Su tamaño mínimo intrínseco ensancha el formulario: documento **397 px** en pantalla 375, controles hasta x=376 y borde de formulario hasta x=397. Un `overflow-x-auto` interior no basta si el hijo del grid no puede encogerse. | Declarar `min-w-0`/columnas de mínimo cero en el grid y sus hijos; verificar formulario y lista poblada, no sólo el estado vacío. Conservar controles y RHF/estado en un único árbol. | `produccion/pages/Produccion.tsx`, pruebas de página | S |
| A1-16 | P3 baja | Carga inicial `/login`; todos los roles/dispositivos | `frontend/scripts/check-bundle-size.mjs:39`, `:63`, `:67`; `frontend/src/App.tsx:5`; build `dist/index.html` declara preload de Supabase | La métrica “JS de entrada” sólo comprime el script entry: **99.176 B**. No incorpora el preload estático de Supabase: otros **58.282 B gzip** de JS inicial. El script mide honestamente su métrica, pero no impide que crezca el conjunto inicial moviendo código a una dependencia estática. | Añadir una métrica separada del cierre de imports/preloads iniciales y mantener la métrica actual para comparar su historia. Leer el manifest del build, presupuestar el total JS/CSS inicial y documentar qué bytes cuenta cada métrica. No retirar lazy ni cambiar de framework. | Verificador de tamaño, `bundle-budget.json`, pruebas del verificador y guía de rendimiento | M |

## 4. Accesibilidad técnica

Labels y nombres existen en los controles revisados; campos numéricos de filas tienen `aria-label`, y las filas RHF no se duplican para móvil/desktop. `Toast` ya usa `alert/assertive` para error y `status/polite` para éxito (`frontend/src/components/Toast.tsx:13`). El diálogo nativo se abre con `showModal`, mantiene el fondo inerte y restaura el foco (`frontend/src/components/Dialog.tsx:18`). Con Nuevo Cliente, enviar vacío enfoca Nombre; Escape cierra y devuelve el foco a Nuevo cliente. Son verificaciones DOM/teclado, no una certificación con lector de pantalla.

| ID | Severidad | Rutas / roles / anchos | Evidencia | Problema | Propuesta concreta | Archivos a tocar | Esfuerzo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1-11 | P2 media | Menú lateral; todos los roles; **375/768** | `frontend/src/components/DashboardLayout.tsx:42`, `:75`, `:82`, `:142`; [menú móvil](capturas/a1-menu-vendedor-375.png) | El drawer mueve foco al primer enlace y cierra con Escape, pero no delimita Tab ni vuelve inerte el contenido cubierto. Reproducido en vendedor a 375: Inicio→…→Cerrar sesión→Alternar menú→Notificaciones. Después puede llegar al contenido detrás del overlay. | Drawer modal con nombre accesible y ciclo de foco, fondo inerte mientras está abierto, Escape y restauración al botón. Mantener navegación lateral no modal en desktop; probar Tab/Shift+Tab, resize y cierre por enlace. | `components/DashboardLayout.tsx`, su prueba | M |
| A1-14 | P2 media | Tablas de clientes, venta, stock y producción; roles autorizados; principalmente 768/1280 | `frontend/src/lib/ui.ts:20`, `:21`; `frontend/src/domains/ventas/pages/RegistrarVenta.tsx:344`; [venta tablet](capturas/a1-registrar-venta-vendedor-768.png) | `thCls` usa slate-400 a 12 px sobre slate-50. Color medido en Chrome: RGB(144,161,185) sobre RGB(248,250,252), contraste **2,51:1**, inferior a 4,5:1 para texto normal. No se usa el umbral de 3:1 de texto grande para estos encabezados pequeños. | Token de texto de encabezado con contraste ≥4,5:1 en su fondo real; probar todas las tablas consumidoras. Los errores rojos tienen texto explícito, pero conviene fijar también su contraste con sus fondos, en vez de validar sólo el nombre de la clase. | `lib/ui.ts`, `lib/ui.test.ts`; no hace falta editar cada tabla para cambiar el token | S |
| A1-19 | P2 media | `/login`; anónimo; reproducción **375**, aplica a los tres anchos | `frontend/src/pages/Login.tsx:73`, `:74`; [login fallido](capturas/a1-login-error-anonimo-375.png) | Con contraseña local incorrecta aparece “Correo o contraseña incorrectos.”, pero el error no tiene `role=alert`, región live ni gestión de foco; el conteo DOM de alertas/regiones live es **0**. La carga y el texto son seguros, pero el cambio puede pasar inadvertido a tecnología asistiva. | Aviso persistente anunciado con `role=alert` o región live apropiada, sin exponer causa técnica; asociar el aviso a los campos si se marca invalidación. Probar credenciales inválidas, fallo de red y nuevo intento con teclado. | `pages/Login.tsx` y nueva prueba de login | S |

## 5. Formularios: RHF/Zod, mensajes y contexto de rol

Las firmas RHF separan `z.input` y resultado del resolver (`frontend/src/domains/ventas/pages/RegistrarCliente.tsx:47`, `frontend/src/domains/ventas/pages/RegistrarVenta.tsx:149`, `frontend/src/domains/ventas/pages/Gastos.tsx:33`). Se comprobaron mensajes españoles al enviar Cliente y Venta vacíos. Bodega y producción validan manualmente: migrarlas a RHF/Zod no es un requisito por sí mismo; la prioridad es comportamiento, accesibilidad y mantener las validaciones del backend.

| ID | Severidad | Rutas / roles / anchos | Evidencia | Problema | Propuesta concreta | Archivos a tocar | Esfuerzo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1-12 | P2 media | Cliente, Venta y Gastos; vendedor/administradores; todos los anchos | `frontend/src/domains/ventas/pages/RegistrarCliente.tsx:130`, `:139`, `:153`; `frontend/src/domains/ventas/pages/RegistrarVenta.tsx:291`, `:299`, `:414`; `frontend/src/domains/ventas/pages/Gastos.tsx:89`, `:107`; [cliente inválido](capturas/a1-cliente-error-vendedor-375.png) | Tras enviar vacío, Nombre/Dirección muestran errores pero `aria-invalid` y `aria-describedby` son **null**. Venta enfoca clienteId, con cero campos `aria-invalid=true`. Los mensajes dentro del label alteran su nombre accesible en lugar de establecer una descripción estable. El borde de campo normalmente conserva el estilo válido. | ID estable por control/error, `aria-invalid` cuando hay error y `aria-describedby` al mensaje; labels con nombre estable, resumen enlazado si hay varios errores y estilo compartido inválido. Mantener el foco automático de RHF que ya funciona. Pruebas DOM de vínculo y foco, además de texto español. | Las tres páginas y sus pruebas | M |
| A1-17 | P2 media | `/ventas/registrar`; administrador A y global; **375/768/1280** | `frontend/src/domains/ventas/index.tsx:12`, `:74`; `frontend/src/domains/ventas/pages/RegistrarVenta.tsx:129`, `:291`, `:598`; `frontend/src/domains/ventas/hooks/useClientesRuta.ts:8`, `:13`; `frontend/src/domains/ventas/api.ts:119` | La ruta admite administrador, pero llama `useClientesRuta()` sin sucursal/vendedor: el hook queda deshabilitado para ese rol. Reproducido en ambas cuentas: selector sólo con placeholder, sin consulta de clientes, sin instrucción de selección y Confirmar habilitado. La carga se consulta por el ID del administrador. Se ofrece un flujo que no puede completar con ese contexto. | Resolver la intención de acceso con coordinación/producto. Para Fase B acotada, restringir esta acción/ruta a vendedor y explicar el alcance del administrador; habilitar venta delegada requiere alcance aprobado aparte. No añadir una funcionalidad nueva por inferencia ni retirar el acceso de administración a Clientes. | `ventas/index.tsx`, página/pruebas de venta y pruebas de rutas | S para restringir; venta delegada fuera de este lote |

La técnica W3C [ARIA21](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21) respalda indicar campos inválidos y relacionar su explicación. No se sostiene que el error sea totalmente ilegible: el label actual puede incluir su texto; falta una semántica estable de nombre, estado y descripción.

## 6. Arquitectura, acceso a Supabase e importaciones de tipos

No se encontró acceso directo al cliente en páginas/hooks de dominio. Ventas, bodega y producción importan el cliente compartido en sus `api.ts`; catálogos/dashboard usan servicios compartidos y AuthProvider gestiona autenticación/perfil (`frontend/src/domains/ventas/api.ts:4`, `frontend/src/domains/bodega/api.ts:1`, `frontend/src/domains/produccion/api.ts:1`, `frontend/src/lib/catalog.ts:1`, `frontend/src/lib/dashboard.ts:1`, `frontend/src/context/AuthProvider.tsx:3`). Son excepciones de infraestructura existentes a la formulación “sólo api.ts”, no llamadas de presentación a Supabase. No se propone mover autenticación a un dominio de negocio sólo para uniformar nombres.

`import type` y los imports mixtos con especificador `type` están en uso; `verbatimModuleSyntax` está activo (`frontend/tsconfig.app.json:14`). La comprobación fresca no detectó una infracción de imports de tipos. Se preserva el stock y la compensación como responsabilidad de la base, sin replicarlos en el frontend.

| ID | Severidad | Rutas / roles / anchos | Evidencia | Problema | Propuesta concreta | Archivos a tocar | Esfuerzo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1-15 | P3 baja | Comprobación estática; todo el frontend | `frontend/tsconfig.app.json:2`, `:19`; `frontend/tsconfig.node.json:2`; `frontend/tsconfig.json:1` | La guía exige TypeScript estricto, pero ambos proyectos omiten `strict` y no tienen `extends` que lo active. `tsc --showConfig` confirma la ausencia. Se ejecutó además `tsc -p tsconfig.app.json --strict --noEmit --incremental false` y **pasa**, por lo que es una protección de configuración ausente, no una deuda de errores strict demostrada. | Activar `strict: true` explícitamente y ejecutar build/lint/tests con Node declarado. Comprobar también el proyecto de configuración Vite; evitar casts nuevos para silenciar los diagnósticos. | `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json` | S |

## Reproducciones y comprobaciones determinantes

### Carrera de sucursales A1-01

1. Iniciar sesión como administrador global y abrir Despachos; esperar ambas sucursales locales.
2. Interceptar sólo `GET /rest/v1/stock_bodega`, sin modificar la BD. Para B retener la respuesta con cantidad 111; para A responder con cantidad 222 del mismo producto sintético.
3. Seleccionar B; cuando su lectura esté pendiente, seleccionar A y abrir Nuevo despacho.
4. Confirmar el texto “Disponible en bodega: 222”. Liberar la respuesta de B y esperar su segunda etapa de lecturas.
5. Resultado: la selección permanece en A (`…0001`), la disponibilidad cambia a 111 y el modal lista al vendedor fixture de sucursal 2. [PNG](capturas/a1-despachos-race-admin-global-1280.png).

La captura muestra datos sintéticos de una respuesta interceptada; **111 y 222 no son saldos reales de la BD local**. No se envió el formulario. La propuesta debe corregir el estado de UI, sin deducir un bypass de RLS a partir de este experimento.

### Fallo de lectura A1-05 y recuperación A1-13

Se sirvió 503 desde el navegador para la consulta de historial con `limit=200`, conservando las lecturas base de producción. Tras terminar los reintentos del cliente se observaron aviso de error y mensaje vacío simultáneos. En Indicadores se interceptó `v_indicadores_produccion_diarios`: aviso, dos tarjetas 0 y “No hay producción”. En Ranking se interceptó `v_ranking_vendedores`: apareció el error español, **0 alertas DOM** y ningún botón de reintento, sólo el selector de mes. No se atribuyen esos 503 al backend normal.

### Teclado, dimensiones y contraste

- Cliente vacío: foco en `nombre`; Escape cierra el diálogo y devuelve foco a Nuevo cliente. No se añadieron registros.
- Venta vacía a 768: foco en `clienteId`, mensajes españoles y cero campos con `aria-invalid=true`.
- Drawer a 375: tras nueve elementos de navegación/salida, Tab alcanza el botón de menú y Notificaciones fuera del drawer; Escape sí cierra.
- Despachos móvil: `document.documentElement.scrollWidth = 382` con `innerWidth = 375`. Devoluciones pasa de una vista inicial ajustada a **553** al seleccionar una devolución. Incidencias de producción: **397**. Las capturas son viewport PNG, no una afirmación de que el contenido cortado haya desaparecido del DOM.
- Encabezado de venta: colores CSS convertidos a RGB en canvas del navegador y fórmula de luminancia relativa sRGB: **2,5138:1**. La nota slate-400 sobre blanco también mide **2,6301:1**; se prioriza el encabezado operativo compartido en A1-14. Los errores tienen texto además de color; no se afirma una infracción de contraste de error sin medir el par concreto.

## Validación fresca y entregable

Comandos desde `frontend/`, salvo donde se indica:

| Comprobación | Resultado |
| --- | --- |
| `npm run lint` | Exit 0, sin errores/warnings |
| `npm run build` | Exit 0; TypeScript y Vite; 1.157 módulos transformados |
| `npm run size` | Exit 0; tres métricas dentro del presupuesto |
| `npm run test` | Exit 0; **529 pruebas, 44 archivos** |
| `./node_modules/.bin/tsc -p tsconfig.app.json --showConfig` | Se confirma que `strict` no está configurado |
| `./node_modules/.bin/tsc -p tsconfig.app.json --strict --noEmit --incremental false` | Exit 0, cero diagnósticos |
| Matriz Chrome local | 315 combinaciones, 1.287 respuestas 200; cero errores/warnings de consola y cero excepciones de página en navegación normal |
| Pruebas dirigidas | Carrera, error/vacío contradictorio, overflow, foco y ARIA reproducidos; caché/invalidation comprobada aparte |

Los scripts temporales y los estados autenticados se mantuvieron fuera del árbol versionado y no forman parte del entregable. Las capturas no contienen tokens. Antes del commit se verifican referencias `archivo:línea`, enlaces a las 11 capturas, límites PNG, `git diff --check`, no solapamiento de los lotes y ausencia de cambios en código. El commit local de documentación omite los hooks Beads (`git -c core.hooksPath=/dev/null commit`) porque el hook configurado ejecuta `bd hooks run pre-commit` y el encargo reserva al coordinador las escrituras del tracker; lint/build/tests y verificación documental se ejecutan explícitamente. No hay push, merge ni PR.

## Lotes propuestos para Fase B

Los lotes siguientes son una **partición de propiedad de archivos**, no un permiso de implementación. Cada hallazgo aparece en un único lote; los nombres nuevos son propuestas de archivo. Todos los paths relativos de los lotes B-01 a B-05 parten de `frontend/src/`. Las pruebas de cada lote quedan con su propietario; no se propone que dos workers editen el mismo archivo compartido.

### B-01 — Bodega: coherencia de sucursal, lectura, escala y responsive

Hallazgos **A1-01, A1-02, A1-04, A1-08, A1-09, A1-18**. Prioridad: P1 primero. Esfuerzo conjunto L.

Archivos existentes:

- `domains/bodega/api.ts`, `domains/bodega/api.test.ts`.
- `domains/bodega/pages/Despachos.tsx`, `domains/bodega/pages/Despachos.test.tsx`.
- `domains/bodega/pages/Devoluciones.tsx`, `domains/bodega/pages/Devoluciones.test.tsx`.

Archivos nuevos propuestos:

- `domains/bodega/hooks/useDatosBodega.ts`, `domains/bodega/hooks/useDatosBodega.test.tsx`.
- `domains/bodega/modeloDespachos.ts`, `domains/bodega/modeloDespachos.test.ts`.
- `domains/bodega/components/FiltrosDespachos.tsx`, `domains/bodega/components/FormularioDespacho.tsx`.

Salida observable: A→B→A no mezcla datos ni borradores; las tres anchuras mantienen `scrollWidth ≤ innerWidth` con detalles abiertos; paginación/fecha limita las lecturas; teclas y reintentos mantienen identidad de línea y contrato RPC. No tocar Stock ni SQL en este lote.

### B-02 — Ventas: formularios, recuperación, caché y acceso a registrar venta

Hallazgos **A1-03, A1-06, A1-12, A1-13, A1-17**. Esfuerzo conjunto M/L. Resolver la intención de A1-17 antes de alterar roles; la propuesta acotada no incluye venta delegada.

Archivos existentes:

- `domains/ventas/index.tsx`, `App.test.tsx` (cobertura de roles de esta ruta).
- `domains/ventas/pages/RegistrarVenta.tsx`, `domains/ventas/pages/RegistrarVenta.test.tsx`, `domains/ventas/pages/RegistrarVenta.draft.test.tsx`.
- `domains/ventas/pages/RegistrarCliente.tsx`, `domains/ventas/pages/RegistrarCliente.test.tsx`.
- `domains/ventas/pages/Gastos.tsx`, `domains/ventas/pages/Gastos.test.tsx`.
- `domains/ventas/pages/RankingVendedores.tsx`, `domains/ventas/pages/RankingVendedores.test.tsx`.
- `domains/ventas/pages/MiComision.tsx`, `domains/ventas/pages/MiComision.test.tsx`.
- `domains/ventas/hooks/useRegistrarVenta.ts`, `domains/ventas/hooks/useRegistrarVenta.test.tsx`.

Archivos nuevos propuestos:

- `domains/ventas/queryKeys.ts`, `domains/ventas/hooks/useRankingVendedores.ts`.
- `domains/ventas/components/DetalleVenta.tsx`, `domains/ventas/components/ResumenVenta.tsx`.

Salida observable: error asociado a cada control sin duplicar registros RHF; recuperación conserva borrador; venta invalida Comisión y refresca carga una vez; cambios de Observaciones no renderizan todas las filas innecesariamente; administrador no recibe un flujo sin contexto utilizable. No tocar los tokens de `lib/ui.ts` ni el componente Toast desde este lote.

### B-03 — Producción: estado válido, consultas por sección y móvil

Hallazgos **A1-05, A1-07, A1-10**. Prioridad: corregir P1 antes de optimizar. Esfuerzo conjunto M.

Archivos existentes:

- `domains/produccion/api.ts`, `domains/produccion/api.test.ts`.
- `domains/produccion/hooks/useDatosProduccion.ts`, `domains/produccion/hooks/useDatosProduccion.test.tsx`.
- `domains/produccion/pages/Produccion.tsx`, `domains/produccion/pages/Produccion.test.tsx`, `domains/produccion/pages/Produccion.branch.test.tsx`.
- `domains/produccion/components/HistorialProduccion.tsx`, `domains/produccion/components/HistorialProduccion.test.tsx`.
- `domains/produccion/components/IndicadoresProduccion.tsx`, `domains/produccion/components/IndicadoresProduccion.test.tsx`.

Archivos nuevos propuestos:

- `domains/produccion/hooks/useHistorialProduccion.ts`, `domains/produccion/hooks/useIndicadoresProduccion.ts`.

Salida observable: 503 no presenta cero como dato válido ni vacío como éxito; reintento específico funciona; indicadores no espera incidencias/mermas; stock empieza en paralelo con empaques; formulario/lista poblada caben a 375. No modificar publicación Realtime ni backend en este lote.

### B-04 — Shell: menú móvil y aviso de login

Hallazgos **A1-11, A1-19**. Esfuerzo conjunto M.

Archivos existentes: `components/DashboardLayout.tsx`, `components/DashboardLayout.test.tsx`, `pages/Login.tsx`. Archivo nuevo: `pages/Login.test.tsx`.

Salida observable: Tab y Shift+Tab quedan dentro del drawer abierto, fondo inerte, Escape y retorno de foco correctos; login anuncia el error español sin revelar causa técnica. No tocar `App.test.tsx`, reservado a B-02, ni el diálogo compartido que ya cumple el comportamiento observado.

### B-05 — Token de contraste de tablas

Hallazgo **A1-14**. Esfuerzo S. Archivos: `lib/ui.ts`, `lib/ui.test.ts`.

Salida observable: encabezados ≥4,5:1 en slate-50 y revisión visual de consumidores. Ninguna modificación de páginas consumidoras; si fuese necesaria, coordinarla con su lote propietario.

### B-06 — Garantía de TypeScript estricto

Hallazgo **A1-15**. Esfuerzo S. Archivos: `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`.

Salida observable: `--showConfig` declara strict y build/lint/tests pasan con Node 22. Si aparecen errores de fuente tras otros lotes, devueltos a su propietario; no ampliar la propiedad de B-06 a esos archivos.

### B-07 — Presupuesto del conjunto inicial

Hallazgo **A1-16**. Esfuerzo M. Archivos existentes: `frontend/scripts/check-bundle-size.mjs`, `frontend/bundle-budget.json`, `docs/engineering/performance.md`. Archivo nuevo: `frontend/scripts/check-bundle-size.test.mjs`.

Salida observable: el presupuesto cuenta entry e imports/preloads iniciales y falla ante crecimiento de un preload aunque entry se reduzca; lazy sigue funcionando. No modificar `main.tsx`, `App.tsx` ni páginas de dominio para demostrar esta cobertura.

**Integración:** coordinar contratos de claves/servicios antes de empezar, integrar los lotes por sus archivos propietarios y ejecutar lint/build/size/tests; el coordinador conserva la ejecución de integración de BD. Ni aceptación de nuevas HU ni cambios de esquema forman parte de estos lotes.
