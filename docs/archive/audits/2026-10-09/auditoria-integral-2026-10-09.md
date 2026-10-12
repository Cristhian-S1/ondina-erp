# Auditoría integral de Ondina — 2026-10-09

> Archivado el 12-10-2026. Las verificaciones y decisiones de este documento corresponden a su sesión de origen; no son instrucciones operativas vigentes.

> La sección de limpieza refleja lo ocurrido el 09-10-2026. El handoff Kimi se recuperó posteriormente como antecedente histórico por petición del usuario.

## 1. Diagnóstico general

**Ondina puede retomarse: el frontend compila, sus 99 pruebas pasan y la aplicación publicada responde. Sin embargo, la operación completa todavía no está validada y el backend no se reconstruye desde cero con la cadena actual de migraciones.** Existe una exposición comprobada de información comercial a usuarios anónimos, diferencias importantes entre SQL local y base real, auditoría incompleta y módulos administrativos pendientes.

La prioridad inmediata es corregir la exposición de vistas, recuperar una historia de migraciones reproducible y asegurar los movimientos de stock. Añadir funcionalidades sobre el estado actual multiplicaría esas inconsistencias.

Esta revisión combina código y relaciones de CodeGraph, comandos locales, consultas de catálogo de Supabase, plugins de GitHub/Vercel, Computer Use con una sesión de administrador, npm audit y documentación actual consultada mediante Context7 y Tavily. Las comprobaciones históricas de agosto se distinguen de las realizadas ahora. No se registraron ventas, despachos, producciones ni cambios de esquema en producción.

### Evidencia principal

| Área | Resultado actual | Límite de la comprobación |
| --- | --- | --- |
| Sitio publicado | HTTP 200, login y navegación interna accesibles | Disponibilidad no garantiza todos los flujos de negocio |
| Frontend | Lint y build correctos; 99/99 pruebas, 15 archivos | Predominan servicios simulados; no prueban RLS ni triggers reales |
| Supabase | Proyecto activo, 23 tablas públicas con RLS | RLS habilitado no significa políticas correctas |
| Migraciones | 0001–0006 aplican en prueba aislada; 0007 falla | PostgreSQL 16 con Auth/Storage mínimos, frente a PostgreSQL 17.6 remoto |
| Seguridad | `anon` lee 15 filas de comisión y 2 de ranking | Consulta de conteos; no se publican datos comerciales individuales |
| Beads | Base embebida funcional; hooks y configuración reparados | Sincronización a GitHub autorizada y verificada |
| Recuperación Beads | 28 issues importados en una base aislada, sin huérfanos | La prueba adicional de clon remoto recuperó 29 issues y 4 memorias con exports idénticos |
| Navegador | Validación vacía, stock/despachos, carga permanente de producción y redirección al login comprobados | Se utilizó administrador; no se certificaron sesiones independientes de todos los roles |

## 2. Herramientas e integraciones

| Herramienta | Uso verificado | Observación operativa |
| --- | --- | --- |
| Supabase plugin | SQL de lectura, catálogo, migraciones y advisors | Ref `rhivlzwtobhiguzmkiat`, región `sa-east-1`; no se aplicaron DDL |
| Vercel plugin | Proyecto y despliegues consultados | `ondina-erp`, producción `READY`; algunas llamadas con teamId dieron 403, las del proyecto sin ese parámetro funcionaron |
| GitHub plugin | Repositorio, ramas, PR y commits consultados | `Cristhian-S1/ondina-erp`, público; permisos de lectura efectivos. La lectura de protección devolvió 403 |
| Git por SSH | Acceso remoto verificado | Esta máquina requiere `ssh -F /dev/null` por un problema con la configuración SSH del sistema |
| CodeGraph | Exploración de símbolos, archivos y dependencias | Índice existente; versión 1.6.0. La herramienta anuncia 1.6.2, sin actualizarla durante la auditoría |
| Beads | Crear, actualizar, reclamar, cerrar, exportar, importar y dependencias | bd 1.0.4, Dolt embebido, prefix OND |
| Mem0 | Búsqueda recuperó cinco memorias antiguas de Ondina | Filtro explícito `user_id: cristhian`; memorias de agosto, app_id `Cristhian-S1-ondina-erp` |
| Context7 | Supabase y TanStack Query | Fuentes actuales sobre pruebas SQL, callbacks de Auth y limpieza de caché |
| Tavily | Investigación de proveedores y Beads | Fuentes oficiales de Supabase, GitHub, Vercel y Beads |
| Computer Use | Navegador de Codex, DOM, consola y tamaños de pantalla | No hubo Playwright MCP disponible. Las operaciones se hicieron mediante Computer Use |

La búsqueda inicial vacía de Mem0 correspondía al ámbito consultado, **no a ausencia global de memorias**. No se escribieron recuerdos nuevos. Beads conserva el seguimiento del trabajo; Mem0 ayuda a recuperar contexto histórico y debe contrastarse con el estado real.

Las configuraciones de MCP en OpenCode son antecedentes de otro cliente. Tener una entrada en `opencode.json` no demuestra que ese servidor esté conectado en Codex; aquí se verificó cada integración por una operación real.

## 3. Repositorio y capacidad de reinicio

La base revisada fue `38b60b00c6dc5b41c37472c02d2f2f081ab7ac3e`, de agosto de 2026. `main` y `develop` estaban alineadas. No se encontraron PR abiertos en la consulta inicial. El trabajo de auditoría se aisló en `codex/auditoria-integral-beads`.

| Rama histórica | Por delante de develop | Por detrás | Interpretación |
| --- | ---: | ---: | --- |
| feature/ventas | 23 | 79 | Revisar commits y equivalencias antes de integrar; los conteos no prueban funcionalidad pendiente |
| feature/bodega | 0 | 54 | Rama atrasada respecto a integración |
| feature/produccion | 0 | 44 | Rama atrasada respecto a integración |
| feature/administracion | 3 | 89 | Contiene cambios que eliminan numerosos archivos de contexto; requiere revisión individual |

Se conservaron los tres stashes existentes. No corresponde descartarlos como limpieza de esta auditoría. Tampoco se fusionaron ramas antiguas ni se modificaron protecciones remotas.

### Reinicio del frontend

```bash
cd frontend
npm ci
cp .env.example .env
# Completar variables con un proyecto de desarrollo elegido conscientemente.
npm run dev
npm run lint
npm run build
npm run test
```

El frontend necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Son configuración pública del cliente; la autorización depende de RLS. Una clave `service_role` nunca debe entrar en variables VITE. El cliente actual no valida explícitamente variables ausentes con un diagnóstico propio: conviene añadirlo para facilitar la recuperación de entornos.

Node local es 26.3.1; CI usa 22 y Vercel 24.x. Elegir una versión común compatible, fijarla mediante `.nvmrc`/`engines` y usar el lockfile reduce diferencias. No se certificó aquí una instalación limpia bajo las tres versiones. El frontend existente sí pasó sus verificaciones locales.

### Reconstrucción del backend

No existe `supabase/config.toml` versionado en el árbol revisado. Hay migraciones, pero falta una configuración local completa y reproducible de Supabase. La CLI instalada es 2.111.0; Docker funciona. Un fallo inicial de `supabase --version` se debió a escritura de telemetría bloqueada por el sandbox; la ejecución autorizada en el host devolvió la versión.

En un contenedor PostgreSQL 16 sin red y sin datos reales se crearon estructuras mínimas de Auth/Storage para comprobar la cadena SQL. El resultado fue:

```text
0001_init.sql ... 0006_bodega_despachos_envases.sql: aplicadas
0007_fix_triggers_ventas.sql:124:
ERROR: trigger "trg_venta_detalle_insert" for relation "venta_detalles" already exists
```

`0001` ya crea ese trigger y `0007` vuelve a crearlo. Después se comprobaron 0008–0010 en la base temporal parcialmente preparada y aplicaron; **esto no convierte la cadena completa en válida**. La prueba no reemplaza Supabase local real, pgTAP ni validación de PostgreSQL 17.6. Tampoco debe repararse el historial remoto marcando archivos como aplicados sin contrastar objetos.

La recuperación correcta requiere una línea base revisada del esquema real, una estrategia explícita para instalaciones existentes y nuevas, datos de prueba separados y una reconstrucción automática en CI. La instalación de la CLI debe seguir los métodos soportados y fijar versión; se corrigió la recomendación obsoleta de instalación global por npm. [CLI oficial](https://supabase.com/docs/guides/local-development/cli/getting-started).

## 4. Seguridad y autorización

### S-01 — Exposición anónima de comisiones y ranking · P0 · OND-8ox

Las vistas `v_comision_vendedor` y `v_ranking_vendedores` no tienen `security_invoker=true`. Tienen permiso SELECT para `anon` y `authenticated`. La siguiente comprobación, sin JWT ni escritura de datos, devolvió 15 y 2 filas respectivamente:

```sql
begin;
set local role anon;
select count(*) from public.v_comision_vendedor;
select count(*) from public.v_ranking_vendedores;
rollback;
```

No es una alerta puramente teórica del advisor. Existe acceso efectivo sin iniciar sesión. Corregir las vistas en una migración revisada, revisar permisos de las tablas base y comprobar que cada rol solo ve lo autorizado. Quitar SELECT anónimo puede ser una contención inicial, pero no resuelve por sí solo la segregación entre usuarios autenticados. [RLS y vistas en Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

### S-02 — Políticas incompletas por sucursal e identidad · P1 · OND-8ox

El catálogo remoto muestra:

- `producciones` e `incidencias_produccion`: SELECT/INSERT comprueban rol producción o administrador, sin restringir sucursal ni exigir `creado_por=auth.uid()`.
- `stock_bodega`: INSERT/UPDATE comprueban rol bodega o administrador, sin una comprobación equivalente de sucursal en esas políticas. La lectura sí tiene filtro de sucursal para bodega.
- `mermas`: INSERT tiene una política más estricta con helpers privados; SELECT sigue permitiendo por rol sin filtro de sucursal.
- `clientes`: DELETE administrativo existe, aunque la convención exige conservar historia y usar desactivación/anulación.

Un filtro en React no impide solicitudes directas a la API. El stock debería modificarse mediante operaciones de negocio autorizadas y auditadas, no por un UPDATE directo accesible al rol operativo. No se ejecutaron escrituras abusivas en producción para demostrar estas diferencias: la evidencia es el predicado efectivo del catálogo. Deben verificarse con pruebas negativas en una base aislada.

### S-03 — RPC y funciones SECURITY DEFINER · P1 · OND-8ox

Los advisors notificaron 16 advertencias de funciones accesibles a `anon` y 19 a `authenticated`, además de las dos vistas. No todas son RPC explotables: varias retornan `trigger`, y otras sí incluyen comprobaciones de autorización.

`registrar_venta` autentica `auth.uid()`, verifica perfil/sucursal y cartera del cliente, pero no exige explícitamente un perfil activo y rol vendedor/administrador antes de escribir como definidor. La comprobación de existencia de perfil no sustituye esas condiciones. Revisar también que una venta del administrador global tenga una sucursal operativa elegida: los dos perfiles administradores reales tienen sucursal nula.

`corregir_devolucion` exige rol administrador. Su permiso EXECUTE anónimo no demuestra una corrección anónima exitosa; no debe reportarse como tal. Conviene restringir grants y derivar la identidad del actor en la base, en lugar de confiar en `p_creado_por` enviado desde el cliente. Usar `search_path` controlado y objetos calificados reduce resolución accidental de nombres.

### S-04 — Autenticación, navegador y protección operativa

El advisor indica protección contra contraseñas filtradas desactivada. Revisar esa configuración, política de altas, recuperación de acceso, caducidad de sesiones y cuentas inactivas. No se cambiaron opciones de Auth durante la auditoría.

La respuesta HTTP usa HTTPS y HSTS. No presenta CSP, `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy` en la comprobación realizada. Añadir políticas adaptadas a Supabase y a los recursos reales, empezando CSP en modo de reporte para evitar bloquear la aplicación. No se observó un ataque XSS ni se afirma que falten todas las protecciones de Vercel.

No se encontraron claves privadas evidentes en el escaneo puntual de documentación. Esto no equivale a un análisis de secretos de todo el historial Git. Es recomendable activar detección de secretos y revisar también logs, backups y exports antes de publicarlos.

## 5. Base de datos, integridad y rendimiento

### B-01 — Desfase de esquema e historial · P1 · OND-8wi

Hay diez archivos locales 0001–0010, frente a cinco entradas remotas:

| Versión remota | Nombre |
| --- | --- |
| 20260806024044 | modulo_ventas_rpc_vista_revokes |
| 20260806024400 | correcciones_seguridad_ventas |
| 20260806232318 | catalogo_productos_venta |
| 20260806232340 | catalogo_bidones_venta |
| 20260817034401 | fix_triggers_ventas_v2 |

Existen objetos de bodega y producción que ese historial no explica. No se puede deducir simplemente que faltan cinco migraciones. `perfiles.sucursal_id` es nullable en producción; la línea base local exige NOT NULL. Hay dos administradores reales sin sucursal, lo que conecta el desfase de esquema con el bloqueo del frontend de producción.

Las únicas vistas públicas actuales son `v_indicadores_produccion_diarios`, `v_bidones_vacios_vendedor`, `v_comision_vendedor` y `v_ranking_vendedores`. Las dos primeras tienen invoker activado. Faltan las vistas documentadas `v_stock_actual`, `v_cuadre_despacho`, `v_ventas_diarias`, `v_clientes_inactivos`, `v_historial_cliente` y `v_ventas_producto`. Algunas pantallas actuales consultan tablas directamente y pueden funcionar sin esas vistas; la ausencia sí bloquea afirmar que la base prevista está completa.

### B-02 — Auditoría y anulaciones incompletas · P1 · OND-3dk

El catálogo público tiene 16 triggers de usuario. **Solo `despacho_envases` tiene un trigger de auditoría**. Las afirmaciones documentales sobre auditoría de ventas, gastos, producción, mermas y detalles no describen el estado remoto.

`mermas` tiene trigger de inserción, pero no el de reversión al anular que figura en `bd/triggers_negocio.sql`. Una anulación puede cambiar el estado del registro sin restituir stock. Los detalles de venta tienen un trigger de total al actualizar, pero el movimiento de carga está vinculado a INSERT: permitir corregir cantidades por UPDATE requiere una reversión/compensación explícita o impedir esa edición.

La reactivación de registros anulados no repone movimientos, según el diseño documentado. Hacerla imposible en la BD o definir un flujo de compensación evita estados aparentemente activos con stock desalineado. Deben probarse anulación doble, edición de detalles, despacho con ventas posteriores, devolución parcial y rollback por falta de stock. No se probaron estos cambios contra datos de producción.

### B-03 — Comisiones históricas y calendario · P1 · OND-cop

La vista de comisión elige reglas cuya vigencia contiene **`now()`**, no la fecha de la venta. Cambiar una regla hoy puede cambiar una comisión calculada sobre ventas antiguas, en contradicción con HU-15. Resolver con referencia/snapshot de regla por operación o una selección temporal precisa de reglas inmutables, considerando el cálculo por tipo y jornada.

El ranking agrupa el mes con `date_trunc` sin conversión explícita a `America/Santiago`. La comisión sí convierte la fecha de venta. Unificar jornada, mes y filtros, con límites semiabiertos y pruebas de medianoche, cierre de mes y cambio de horario. También debe decidirse si la base de comisión es antes o después del descuento: la vista suma detalle por precio y cantidad; no se debe inventar esa regla comercial.

### B-04 — Transacciones, concurrencia e idempotencia

`registrar_venta` y `crear_despacho` agrupan escrituras dentro de la llamada SQL; existen bloqueos `FOR UPDATE` en movimientos de stock. Son bases útiles que conviene conservar. Aun así, los detalles de múltiples productos deben bloquearse en un orden determinista para reducir deadlocks y deben existir respuestas recuperables ante conflicto.

El frontend envía devoluciones de productos y envases mediante escrituras separadas. Si la segunda falla, la primera puede haber quedado confirmada. Usar una única RPC para devolver ambos conjuntos, actualizar llegada y auditar toda la operación. Añadir una clave de idempotencia permite reintentar una solicitud tras una conexión interrumpida sin duplicar ventas o devoluciones.

### B-05 — Realtime, Storage, backups y rendimiento

La publicación `supabase_realtime` no contiene tablas en la base consultada. Producción sí suscribe `producciones`, `mermas` y `stock_envases` en el código; además, la migración 0008 publica incidencias pero no mermas. Hay que alinear publicación, eventos y autorización, o usar refresco/polling explícito cuando no se necesite tiempo real. [Configuración oficial de Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

No existen buckets de Storage en la consulta actual. Los comprobantes de gastos están fuera del alcance implementado; si se recupera esa funcionalidad, crear bucket privado con rutas por usuario, validación de tamaño/MIME y políticas de propietario. Las políticas históricas de `storage.objects` no filtran suficientemente al propietario y no deben activarse sin revisión.

Los advisors de rendimiento reportaron 48 claves foráneas sin índices de cobertura, 21 evaluaciones repetidas de Auth en RLS y 2 índices sin uso observado. Priorizar consultas reales y `EXPLAIN (ANALYZE, BUFFERS)` sobre cargas representativas; no crear ni borrar todos los índices automáticamente. No se midieron latencias ni se hicieron pruebas de carga en producción. [Database linter](https://supabase.com/docs/guides/database/database-linter) y [optimización de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

El plan menciona backups/PITR, pero no se verificaron contratación, retención ni restauración efectiva. Una copia útil debe probarse recuperando datos en un entorno aislado y midiendo pérdida y tiempo de recuperación; la disponibilidad actual de la base no demuestra que exista recuperación ante desastre.

## 6. Frontend, experiencia y arquitectura

### F-01 — Restauración y aislamiento de sesión · P1 · OND-82e

`AuthProvider` inicia la carga del perfil y termina `loading` antes de que esa consulta resuelva. Computer Use reprodujo la vuelta a `/login` al abrir una ruta directamente después de iniciar sesión. La navegación interna tras un nuevo login permitió continuar. No se confundió ese comportamiento con una prueba de que la contraseña estuviera mal ni con una anulación real de la sesión remota.

Esperar sesión y perfil antes de decidir acceso, cancelar respuestas de una identidad anterior y distinguir usuario sin perfil, perfil inactivo y error de red. `signOut` debe comprobar el error de Supabase; actualmente descarta el resultado y limpia el perfil local. Limpiar QueryClient y datos de formularios al cambiar de identidad evita mostrar datos anteriores. Context7 confirmó la función `queryClient.clear()` para vaciar ambas cachés. [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient).

El borrador de venta utiliza la clave global `ondina:draft-registrar-venta` en sessionStorage. En una tablet compartida puede sobrevivir a un cambio de usuario y conservar cliente/productos del anterior. Separarlo por usuario/sucursal, validarlo al recuperar y retirarlo al cerrar sesión.

La documentación de Supabase advierte sobre llamadas asíncronas dentro de callbacks de Auth. Aquí se usa `void loadPerfil`, sin esperar directamente el callback: es un aspecto a comprobar al corregir la carrera, **no un deadlock demostrado en esta sesión**. [Aviso oficial](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0).

### F-02 — Producción para administrador global · P1 · OND-y64

El administrador auditado muestra todas las sucursales. `Produccion.tsx` deriva `sucursalId` del perfil; cuando está vacío, `cargarDatos` retorna antes de terminar el estado de carga. `/produccion/registrar` permaneció en “Cargando información...” durante las pruebas. Stock y despachos tienen selector de sucursal y sí cargan para ese administrador.

Ofrecer una sucursal operativa explícita, distinguir falta de configuración y comprobar el mismo flujo con producción asignada. No resolverlo escogiendo una sucursal silenciosamente en escrituras.

> Evidencia histórica: la pantalla de producción quedó bloqueada para un administrador sin sucursal en la prueba móvil de 375 px. La captura se retiró del árbol activo al reorganizar la documentación el 12-10-2026; el commit original se conserva en la etiqueta archivo/auditoria-integral-2026-10-09.

### F-03 — Errores y autorización de interfaz

Varias lecturas de bodega extraen solo `data` y devuelven un array vacío, descartando `error`. Un fallo de permisos o conexión puede presentarse como “sin registros”. Centralizar el contrato de servicios para diferenciar carga, vacío, error y prohibición; permitir reintentar y conservar el formulario tras un fallo.

`ProtectedRoute` admite roles, pero App no los pasa a cada dominio. **DashboardLayout sí valida el rol de la ruta encontrada en ALL_NAV** y filtra el menú. Por tanto, no se ha demostrado un bypass general de roles por escribir una URL. Conviene desacoplar autorización de navegación, declarar permisos en rutas y probar rutas no representadas en el menú, alias y perfiles inactivos. La protección decisiva sigue siendo RLS/RPC.

Producción consulta Supabase Realtime directamente desde el componente, mientras la regla del proyecto pide servicios de dominio. Extraer la suscripción y su limpieza al servicio/hook del dominio facilita comprobar desconexión, cambio de sucursal y errores, sin introducir un backend separado.

### F-04 — Rendimiento y mantenibilidad

El build genera JS de 911,39 kB (258,90 kB gzip) y CSS de 289,61 kB (43,26 kB gzip). Vite advierte por el tamaño del chunk. Usar importaciones diferidas por dominio/ruta, evitar cargar datepickers en pantallas que no los usan y medir antes/después. Hay una mezcla de Mantine y Tailwind que es viable si se mantiene un sistema común de componentes y mensajes.

Existen tipos generados y un `Database` mantenido manualmente en `types/database.ts`; el cliente usa los generados. Evitar modelos paralelos que se contradigan y casts como `as never[]` en escrituras. Generar los tipos desde el entorno reconciliado y comprobar su diff en CI.

La carga de producción obtiene varios conjuntos para secciones que pueden no necesitarlos. Limitar columnas, paginar historial/ventas y cargar según la sección reduce transferencia y estados de carrera. La configuración global de Query no refresca al enfocar; definir una estrategia de frescura para carga y stock de vendedores en tablets compartidas.

### F-05 — UX, accesibilidad y consistencia

El formato vivo de miles, selección duplicada deshabilitada y tarjetas móviles de ventas funcionan en la comprobación realizada. La validación de venta vacía muestra “Selecciona un cliente”; despacho vacío muestra un mensaje específico. La disponibilidad de estos mensajes no certifica el resto de criterios por rol.

Algunos campos repetidos de cantidades/precios no tienen un nombre accesible en la captura AX; el texto visual de la tarjeta no sustituye `label` asociado o `aria-label`. Revisar foco de modales, cierre con teclado y navegación del sidebar móvil: el aside desplazado continúa apareciendo en AX. Añadir `aria-expanded`/controles de foco y ocultación accesible cuando corresponda.

El botón de notificaciones tiene un indicador rojo fijo y no tiene acción; Exportar Excel en stock está deshabilitado. Identificar explícitamente funciones pendientes o retirar indicadores que sugieren información nueva inexistente. No inventar un sistema de notificaciones para corregir solo la presentación.

## 7. Funcionalidades y alcance real

El resumen histórico de “16 completas, 3 parciales…” mezcla alcance, código y disponibilidad de BD; cuenta HU-13 en más de un dominio y denomina eliminada a HU-06 aunque está pospuesta. Además, su descripción de tests no coincide con los archivos actuales: ahora hay tests de API de bodega y producción que ese detalle no enumera. Sustituir el conteo por criterios de aceptación verificados por capa.

| HU o capacidad | Situación comprobada | Siguiente implementación con valor |
| --- | --- | --- |
| HU-01–04 | Formularios y consultas implementados; venta RPC existente | Aislamiento de borrador/sesión, RLS y stock probados con usuarios reales de prueba |
| HU-05 | Retirada del frontend; vista de envases conservada | Mantener la decisión de alcance y su uso en bodega |
| HU-06 | Documento comercial pospuesto; columnas existentes | Confirmar alcance y validación fiscal antes de definir emisión |
| HU-07 | Gastos implementados; comprobantes no implementados | Storage privado y flujo de carga solo si negocio reactiva ese alcance |
| HU-08/09 | Ranking y comisión implementados | Vistas seguras, historia de reglas y calendario consistentes |
| HU-10 | Administración placeholder | Alta/desactivación de usuarios mediante función de servidor autorizada; nunca exponer credenciales administrativas al cliente |
| HU-11/12 | Sin pantallas; vistas documentadas ausentes | Historial de cliente y alertas con índices, sucursal y permisos |
| HU-13 | Corrección de devoluciones parcial | Auditoría efectiva, anulación coherente y reversión de stock |
| HU-14 | Reportes placeholder | Consultas paginadas y exportación autorizada sobre vistas reconciliadas |
| HU-15 | Sin administración de reglas | Reglas versionadas y cálculo histórico estable |
| HU-16 | Geolocalización placeholder | Definir consentimiento, frecuencia, precisión, retención y acceso antes de capturar ubicaciones |
| HU-17 | Sin UI de catálogo | Administración con soft-delete y conservación del precio histórico |
| HU-19–23 | Código de producción y pruebas presentes | Selector administrativo, RLS por sucursal, auditoría y Realtime realmente configurados |
| HU-24/25 | Stock y despachos cargan con administrador | Mensajes de error reales y verificaciones transaccionales |
| HU-26 | Ventana en trigger; sin UI específica | Ajuste aditivo dentro de ventana con mensajes y pruebas de expiración |
| HU-27/28 | Devoluciones implementadas mediante INSERT | Operación conjunta atómica y criterios claros de envases/mermas |
| HU-29 | Sin página específica de mermas de bodega | Formulario con compensación por anulación y trazabilidad |
| HU-31 | Login funcional con fallo de restauración | Sesión estable al recargar y pruebas de roles/perfil inactivo |
| HU-18/30 | Retiradas del alcance | Eliminar contradicciones documentales; no reintroducir offline/cierre de jornada sin decisión explícita |

Las funcionalidades pendientes se agruparon en `OND-w76` para dividirlas en cortes verificables al priorizarlas con negocio. Esa agrupación no supone que sea correcto implementarlas todas en un único cambio.

## 8. Navegador y verificación ejecutada

Se utilizó la sesión que el usuario abrió en el navegador de Codex; no se solicitó ni guardó contraseña. No se publican capturas con RUT, teléfonos o detalles comerciales de las personas.

| Escenario | Observación |
| --- | --- |
| Login y home | Sesión de administrador inició correctamente |
| URL directa tras login | Redirigió a login; se recuperó entrando de nuevo y usando el menú |
| Registrar venta sin datos | Validación de cliente visible; no hubo venta registrada |
| Venta móvil, cantidad 1000 | Se mostró `1.000` y subtotal formateado; luego se restauró el campo vacío |
| Productos duplicados | Opciones ya seleccionadas aparecen deshabilitadas |
| Stock administrador | Selector de sucursales, productos y cantidades visibles; exportación deshabilitada |
| Despachos | Filtro Hoy vacío; Todo cargó 16 registros históricos |
| Despacho vacío | Mensaje de vendedor/producto obligatorio; se cerró sin guardar |
| Producción administrador global | Carga permanente, reproducible; evidencia guardada |
| Reportes/administración/auditoría | “En construcción” confirmado |
| Pantalla 375 y 768 px | Producción no desborda horizontalmente; venta móvil cabe en el ancho disponible |
| Escritorio 1280 px | Navegación y apertura de pantallas comprobadas |
| Consola | Lecturas de errores/warnings vacías en los puntos consultados |

No se certificaron todas las rutas ni todos los roles, ni carga de archivos, recuperación de contraseña, GPS, pagos/documentos, edición/anulación de datos reales o comportamiento bajo concurrencia. La ausencia de errores de consola no demuestra integridad del backend. Una nueva prueba por rol debería ejecutarse en un entorno con datos sintéticos, después de resolver los bloqueos de seguridad y esquema.

## 9. CI/CD, GitHub y Vercel

`ci.yml` ejecuta npm ci, lint, build y pruebas. Su job `migrations-check` solo busca un punto y coma en cada SQL: no comprueba sintaxis PostgreSQL, relaciones ni reconstrucción. La falla real de 0007 muestra que ese control produce confianza excesiva.

`deploy-develop.yml` se dispara en push a develop y despliega sin depender del resultado de CI. Producción sí tiene un job verify previo y un environment production en YAML. Eso **no acredita que el environment tenga reviewers ni que las reglas de rama actuales sean las descritas en agosto**: la lectura de protección estuvo limitada por permisos.

Hay evidencia de despliegues Git y CLI para el mismo commit. Si Git integration publica automáticamente, la aprobación del workflow CLI no necesariamente protege toda publicación. Elegir una única vía de publicación o configurar checks/gates que se apliquen a las dos y verificarlo con un cambio de prueba inocuo. No se hicieron despliegues nuevos durante esta auditoría. [GitHub Actions con Vercel](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel), [integración GitHub](https://vercel.com/docs/git/vercel-for-github) y [deployment checks](https://vercel.com/docs/deployment-checks).

Mejoras de `OND-get`: fijar Vercel CLI en lugar de `latest`, usar SHA revisados de actions, limitar el permiso global `pull-requests: write` si ningún paso lo necesita, alinear Node y hacer que desarrollo dependa de verificaciones. Ejecutar migraciones y pruebas pgTAP en Supabase aislado, dejando el despliegue de BD separado y trazable. Construir una vez y promover el artefacto verificado facilita rollback coherente. [Seguridad oficial de Actions](https://docs.github.com/en/actions/reference/security/secure-use).

También faltan evidencias de alertas operativas, monitor de disponibilidad, correlación de errores frontend/API y restauración probada. Son recomendaciones; no se instaló un servicio de monitorización ni se creó una automatización recurrente sin solicitud específica.

### Dependencias · OND-gu3

`npm audit` respondió con 9 alertas: 2 críticas, 4 altas y 3 moderadas. Al excluir desarrollo permanecen 2 altas: nanoid y source-map-js. Los paquetes afectados por la cadena de Vitest incluyen tinypool, vite-node, esbuild y una Vite transitoria antigua; **no significa que la Vite directa 8.2.0 sea esa versión vulnerable**.

La recomendación automática para Vitest implica un cambio mayor a 5.0.3. No se aplicó `npm audit fix --force`: revisar compatibilidad de mocks/Testing Library, actualizar lockfile y repetir pruebas. Las alertas de servidor de desarrollo/UI requieren evaluar condiciones de exposición; no prueban ejecución remota contra el frontend estático publicado. [Advisory de Vitest](https://github.com/advisories/GHSA-5xrq-8626-4rwp), [tinypool](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [nanoid](https://github.com/advisories/GHSA-2v37-7h3g-55p8) y [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

## 10. Documentación y archivos innecesarios

| Archivo/grupo | Evaluación | Acción de esta auditoría |
| --- | --- | --- |
| README.md | Contradice su propio contenido: decía que no había app y exigía un archivo inexistente | Corregido estado, referencia a AGENTS, comandos, alcance efectivo e instalación CLI |
| AGENTS.md | Útil, con cifras y permisos históricos; comando bd statistics inválido | Contexto de auditoría añadido, comando corregido, backups/stashes preservados y Beads aclarado |
| docs/estado-historias-usuario.md | Inventario histórico valioso; RPC inexistentes y afirmaciones de BD completa | Marcado histórico; corregidos INSERT reales y alcance del chequeo SQL |
| docs/Plan De Desarrollo.md | Objetivo arquitectónico, no evidencia de lo desplegado | Aviso de estado histórico añadido; conservar cronograma como plan |
| docs/Problematica.md / requisitos / HU | Fuentes de negocio que deben conservarse | Identificadas contradicciones de offline/cierre de jornada y requisitos duplicados; requieren ratificación comercial |
| docs/setup-vercel-supabase-github.md | Guía útil; ejecución manual peligrosa con drift actual | Advertencia de reconciliación, CLI y límites de CI corregidos |
| docs/merge-pr-guide.md | Recetas de integración que pueden saltarse PR o favorecer indiscriminadamente una rama | Revisar flujo con historial actual; no usar resolución global “theirs” para conservar módulos |
| docs/contexto-sesion-auditoria.md | Relato histórico de restauración, no guía actual | Conservado y rotulado como histórico |
| docs/plan-mejoras-ventas.md | Decisiones y trabajo de agosto parcialmente implementado | Conservar como antecedente; no duplicar tareas fuera de Beads |
| docs/superpowers/plans y specs | Decisiones de corrección/devoluciones que explican código | Conservar; marcar ejecutado/histórico al revisar cada decisión |
| docs/handoffs/kimi-k3-frontend-ventas.md | Handoff de 495 líneas sustituido por código, docs e issues; contiene alcance antiguo | Eliminado del árbol; recuperable por Git y respaldo |
| docs/verificacion-preview.md | Una línea de prueba de push antigua, sin especificación ni procedimiento | Eliminado del árbol; recuperable por Git |
| referencia_archivos/ | Copia Git antigua ignorada; 300 archivos iguales y cero commits adicionales | Eliminada después de respaldar 491 entradas; informe inicial recuperado en docs/archivo |
| docs/datos_planilla_manual_fisico.md / reunión | Evidencia de levantamiento distinta del código | Conservar; revisar cualquier dato personal antes de compartir nuevos extractos |
| bd/*.sql | Referencias de diseño con divergencias frente a migraciones/producción | Conservar identificando su papel; evitar tres fuentes operativas de despliegue |

El respaldo de `referencia_archivos` está en `/tmp/ondina-referencia-archivos-2026-10-09.tar.gz`. Contiene la copia completa, incluido su Git. `/tmp` es temporal y no sustituye un respaldo duradero. La carpeta no era necesaria para ejecutar ni entender la aplicación actual; su eliminación no destruye commits adicionales.

No se eliminaron requisitos de negocio, specs o ramas solo por antigüedad. La contradicción entre HU-30 retirada y un RNF que sigue exigiendo offline debe resolverse como decisión de alcance. Lo mismo ocurre con cierre de jornada y reglas históricas de comisión. Un glosario pequeño de jornada, carga, stock, envase, devolución, incidencia y merma ayudaría a evitar nombres intercambiables.

## 11. Beads: reparación, límites y recuperación

Se guardó un respaldo previo de `.beads`. La configuración tenía un remoto HTTPS declarado, pero la base Dolt no tenía remoto operativo; `bd dolt push` devolvía “No remote configured — skipping”. Se añadió `origin` mediante el CLI con URL SSH del mismo repositorio y se normalizó config.yaml para evitar claves anidadas y planas contradictorias.

El `core.hooksPath` apuntaba a una ruta antigua en Downloads. Se reemplazó por `.beads/hooks` relativo y se reinstalaron los cinco hooks: pre-commit, post-merge, pre-push, post-checkout y prepare-commit-msg. El script `scripts/bootstrap-beads.sh` fue ejecutado satisfactoriamente sobre la base existente.

Los exports `issues.jsonl`, `interactions.jsonl` y los metadatos locales se retiraron del tracking y quedaron ignorados. `export.auto=true` conserva la vista local; `export.git-add=false` evita staging accidental; `import.auto=false` evita importar el estado obsoleto de otra rama. La base real nunca se borró ni reinicializó.

Se verificaron creación/actualización de issues, dependencias, ready y ausencia de huérfanos. Una exportación de 28 issues se importó en otra base nueva aislada y conservó los estados y dependencias. Después se añadió OND-y64. La guía de recuperación distingue esa exportación de una copia completa del historial Dolt y de sus memorias.

Limitaciones del CLI actual: `bd statistics` no existe; `bd doctor` y `bd dolt test` no soportan este modo embebido; `config validate` pide federation.remote y `config drift` intenta llamar a una CLI Dolt externa ausente. No se añadieron claves inventadas ni se cambió a servidor solo para silenciar esos diagnósticos. `bd stats`, `bd ready`, `bd orphans`, `bd hooks list` y `bd dolt remote list` sí funcionan.

**Sincronización remota verificada:** la revisión automática inicialmente rechazó `bd dolt push` por la publicación de metadatos e historial en el repositorio público. El usuario autorizó explícitamente ese contenido y destino. El push posterior terminó correctamente y `refs/dolt/data` existe. Un Git clone nuevo, sin base local ni exports, ejecutó el script y recuperó 29 issues y cuatro memorias; los 33 registros de su export completo eran idénticos a los del origen. No se enviaron los datos por una vía alternativa al flujo autorizado.

El bootstrap también restringe permisos locales de `.beads` a 0700 y define rol contributor solo cuando el clon no tiene un rol propio, evitando los dos avisos observados al recuperar un clon nuevo.

No se debe confundir el push de esta rama de documentación/configuración con la sincronización de Beads. [Guía oficial de sincronización](https://github.com/gastownhall/beads/blob/main/docs/getting-started/sync-setup.md).

## 12. Skills del proyecto

Las 15 skills tienen referencias locales presentes y ahora pasan el validador de skill-creator de Codex. Ese resultado comprueba estructura/frontmatter, no eficacia de sus consejos. Se conservaron las políticas `allow_implicit_invocation` existentes.

| Skill | Valor para Ondina | Decisión |
| --- | --- | --- |
| beads | Tracker real del proyecto | Conservar como flujo principal de tareas |
| supabase | Orientación y guardas del proveedor | Conservar; evitar cargar además una copia equivalente del plugin sin necesidad |
| supabase-postgres-best-practices | RLS, consultas, índices y concurrencia | Conservar y consultar según la operación |
| vercel-react-best-practices | Rendimiento React | Conservar; contrastar consejos con Vite, sin asumir Next.js |
| domain-modeling | Reglas de stock y vocabulario compartido | Conservar; no crear documentación especulativa |
| codebase-design | Interfaces de dominio, testabilidad | Conservar; aplicar donde exista complejidad real |
| ask-matt | Router anterior invocaba numerosos comandos ausentes | Reescrito con skills realmente instaladas y Beads |
| grill-with-docs | Solo invocaba /grilling, inexistente | Convertido en flujo autónomo de aclaración de requisitos |
| improve-codebase-architecture | Buen enfoque, dependía de Agent Explore y /grilling | Adaptado a CodeGraph y al flujo local; delegación sujeta al alcance autorizado |
| to-tickets | Cortes verticales útiles, proponía tracker/Markdown paralelo | Añadida adaptación obligatoria a bd y dependencias nativas |
| to-spec | Especificaciones para cambios grandes | Conservar para trabajo que lo justifique |
| handoff | Útil para relevo, evita duplicar artefactos | Conservar; preferir referencias a issues/docs existentes |
| prototype | Resolver incertidumbre ejecutable | Conservar; prototipo aislado y sin producción |
| setup-matt-pocock-skills | Configuración genérica ya realizada | Opcional/manual; no volver a configurar otro tracker en Ondina |
| find-skills | Descubrimiento cuando exista una carencia real | Opcional; verificar procedencia/contenido antes de instalar |

Se retiraron `disable-model-invocation` y `argument-hint` del frontmatter incompatible con el validador de Codex. Los archivos agents/openai.yaml ya expresaban la política manual correspondiente y se conservaron. No se borró el catálogo ni se instalaron paquetes nuevos.

No recomiendo agregar una colección amplia de skills. Las actuales cubren dominio, base y React; los plugins ya aportan depuración, revisión y despliegue. Una futura skill específica de pruebas RLS/stock sería útil después de disponer de comandos SQL reproducibles; una skill que solo repita recomendaciones genéricas no resolvería los fallos actuales. Codex Security puede evaluarse como complemento para análisis de seguridad, no como sustituto de las pruebas por rol.

## 13. Verificación y continuación

Verificaciones realizadas: lint/build/tests, npm audit con y sin desarrollo, lecturas remotas de proveedores, prueba anónima de vistas, aplicación SQL aislada, Computer Use, shell syntax del script de Beads, script sobre base existente, importación en base nueva, hooks, ready y orphans, y validación estructural de las 15 skills.

La investigación con Context7 recomienda pruebas pgTAP por rol en transacciones y rollback. Es el control que falta para detectar permisos, auditoría y anulación; los mocks del frontend no lo sustituyen. [Pruebas SQL de Supabase](https://supabase.com/docs/guides/local-development/testing/pgtap-extended).

Los hallazgos se registraron en Beads; este documento es evidencia y análisis, no un tracker alternativo:

| Issue | Resultado que debe verificarse |
| --- | --- |
| OND-8ox | Vistas inaccesibles para anon y autorización correcta de RPC/tablas |
| OND-8wi | Reconstrucción limpia y esquema/historial remoto reconciliados |
| OND-3dk | Auditoría y compensación de stock reales; depende de OND-8wi |
| OND-cop | Comisiones históricas y límites de calendario estables; depende de OND-8wi |
| OND-82e | Sesión y borradores aislados al recargar/cambiar usuario |
| OND-y64 | Producción utilizable por administrador global con sucursal explícita |
| OND-gu3 | Dependencias revisadas y actualización con pruebas |
| OND-get | Publicación controlada y SQL comprobado realmente en CI |
| OND-w76 | Cortes de funcionalidades pendientes; depende de OND-8wi |
| OND-6p6 | Auditoría y reparación Beads, incluida recuperación remota verificada |
| OND-jf6 | Alineación de documentación/herramientas de recuperación |

Para retomar el desarrollo, comenzar por OND-8ox y OND-8wi. Después estabilizar sesiones, sucursales y stock; implementar administración sobre esa base. Confirmar las decisiones comerciales pendientes antes de reactivar offline, documentos, GPS o cambios de comisión. Un criterio de aceptación útil es poder reconstruir un entorno aislado, operar cada rol y restaurar una copia sin recurrir a scripts manuales contradictorios.
