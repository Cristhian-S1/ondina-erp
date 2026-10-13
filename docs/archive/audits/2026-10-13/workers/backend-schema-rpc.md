# Auditoría del backend: esquema, RLS, RPC y stock — 2026-10-13

## Resumen

- Base revisada: `develop`, HEAD `a0a8f65fd69c173c26fd9fc008cb68ce4e36d4f5`; auditoría de lectura, sin conexión a producción.
- La reconstrucción estricta 0001–0010 falla en 0007 por un trigger de venta duplicado; 0001–0006 aplicaron en PostgreSQL 16.14 aislado.
- Se distingue el estado **alcanzable hasta 0006** del estado **pretendido por las últimas definiciones de 0001–0010**; este último se ensayó retirando solo cinco triggers duplicados dentro del contenedor.
- El estado pretendido contiene 24 funciones de aplicación, 31 triggers de usuario, 70 políticas y 10 vistas; esto no describe el catálogo remoto.
- Las migraciones sí incluyen auditoría general, reversión de mermas y RLS reforzada de producción: las carencias remotas antiguas no deben repetirse como carencias del código actual.
- Persisten autorización incompleta de ventas, escritura directa de saldos, RLS amplia de mermas y falta de idempotencia; se reprodujeron varios efectos con datos sintéticos.
- Hallazgos adicionales: doble conteo de envases reintroducido por 0007, despacho ajeno y fuera de plazo, devoluciones duplicadas que exceden lo despachado, compensaciones que crean stock, importes `NaN` y vista de comisión incompatible con el cliente.
- No se corrigió código, no se editaron trackers y no se ejecutaron lint/build/tests del frontend; el único archivo del checkout escrito por este worker es este informe.

## Evaluación de afirmaciones de la auditoría 2026-10-09

Los veredictos se refieren a la evidencia que puede obtenerse hoy. **No verificable** en filas remotas significa **no verificable (requiere catálogo remoto)**; una migración local no demuestra que esté desplegada. Las referencias `archivo:línea` señalan la última definición pertinente, salvo que se indique la anterior para explicar una sustitución.

| ID / afirmación | Veredicto | Evidencia (archivo:línea, comando) | Redacción propuesta |
| --- | --- | --- | --- |
| §3: falta `supabase/config.toml` | confirmada | `test -e supabase/config.toml` / `Path.exists()` → false; `rg --files supabase` enumera solo las diez migraciones | Falta configuración local versionada; no se infiere de ello el estado de una instalación externa. |
| §3: 0007 recrea el trigger creado por 0001 | confirmada | `supabase/migrations/0001_init.sql:1426`; `supabase/migrations/0007_fix_triggers_ventas.sql:123`; replay estricto → exit 3, trigger already exists | La cadena se detiene en el primer duplicado; también duplica los tres triggers de total y el de anulación (`0007:126`, `:129`, `:132`, `:135`). |
| §3: CLI 2.111.0 / Docker / replay histórico | parcial | Se verificó Docker y PostgreSQL 16.14 en esta sesión; no se invocó Supabase CLI. Apéndice de reproducción | Conservar la versión de CLI como observación del 09-10, no como versión actual. |
| B-01: diez archivos frente a cinco entradas remotas y objetos no explicados | no verificable | Diez archivos locales por `rg --files supabase/migrations`; historial remoto no consultado | El desfase remoto documentado el 09-10 queda pendiente de refresco; el fallo local de reconstrucción sí se confirma. |
| B-01: `perfiles.sucursal_id` NOT NULL local / nullable remoto | parcial | `supabase/migrations/0001_init.sql:70`; no hay ALTER que quite NOT NULL; `frontend/src/types/database-generated.types.ts:886` también exige string | Localmente no existe administrador sin sucursal; la nulabilidad y los dos administradores remotos requieren catálogo/datos remotos. |
| B-01: faltan seis vistas documentadas | no verificable | Las seis se crean en `supabase/migrations/0001_init.sql:1637`, `:1647`, `:1685`, `:1738`, `:1760`, `:1775`; ninguna se elimina; replay diagnóstico tiene 10 vistas | La ausencia era remota; **no faltan en las migraciones**. Incluirlas y asegurar permisos al reconciliar. |
| B-02: solo `despacho_envases` tiene auditoría / 16 triggers remotos | no verificable | Auditoría general en `supabase/migrations/0001_init.sql:1551`, `:1557`, `:1563`, `:1567`, `:1573`, `:1595`, `:1600`, `:1608`, `:1613`; envases en `supabase/migrations/0006_bodega_despachos_envases.sql:421`; incidencias en `supabase/migrations/0008_produccion_hu_19_23.sql:189` | El código crea 11 triggers de auditoría y 31 triggers de usuario en el catálogo diagnóstico; el número y la cobertura remotos no se verificaron. |
| B-02: `mermas` carece de reversión por anulación | no verificable | Función efectiva `supabase/migrations/0001_init.sql:1390`; trigger `:1462`; 0010 reemplaza solo INSERT (`supabase/migrations/0010_fix_mermas_produccion.sql:130`) | La reversión está versionada desde 0001; verificar instalación remota y corregir su semántica ante edición/reactivación (BACK-N5/N6). |
| B-02: UPDATE de venta_detalles no compensa carga | confirmada | `supabase/migrations/0001_init.sql:729`; trigger de UPDATE efectivo `supabase/migrations/0007_fix_triggers_ventas.sql:129`; movimiento solo INSERT `:27` | También ocurre con detalles de despacho y cantidades de devoluciones/producción/mermas: editar no compensa y la posterior anulación usa valores nuevos. |
| B-02: reactivar no repone movimientos | confirmada | Condiciones false→true en `supabase/migrations/0001_init.sql:1448`, `:1451`, `:1455`, `:1462`; `supabase/migrations/0007_fix_triggers_ventas.sql:135`; `supabase/migrations/0009_fix_produccion_triggers.sql:188`; T12 → stock 102 desde 100 | Además, reactivar y anular otra vez duplica la compensación; un UPDATE consecutivo true→true solo no la duplica. |
| B-03: reglas seleccionadas con now(), no fecha de venta | confirmada | `supabase/migrations/0001_init.sql:1729`; diseño `bd/vistas.sql:129`; no reemplazo posterior | Mantener; también faltan inmutabilidad histórica y restricción de solapamientos. |
| B-03: ranking sin America/Santiago y comisión sí la usa | parcial | Ranking efectivo `supabase/migrations/0001_init.sql:1696`; comisión efectiva también mensual y sin conversión `:1712`; solo diseño `bd/vistas.sql:112` usa jornada chilena; producción sí la usa en `supabase/migrations/0009_fix_produccion_triggers.sql:223` | En la cadena local, **ranking y comisión** dependen de TimeZone de sesión; `bd/vistas.sql` y el cliente esperan comisión diaria. El SQL remoto requiere inspección. |
| B-03: base de comisión anterior al descuento | confirmada | `supabase/migrations/0001_init.sql:1714`, `:1719`; ranking local suma ventas.total (`:1697`), diseño ranking suma detalle (`bd/vistas.sql:83`) | Ratificar base comercial; hoy la base de comisión es bruta y el ranking diverge entre diseño y migración. |
| B-04: registrar_venta y crear_despacho son transaccionales | confirmada | `supabase/migrations/0002_modulo_ventas.sql:118`, `:134`; `supabase/migrations/0006_bodega_despachos_envases.sql:290`, `:294`, `:304` | Una llamada SQL agrupa cabecera y líneas; `crear_despacho` es **SECURITY INVOKER**, no DEFINER (`0006:269`). |
| B-04: hay FOR UPDATE pero falta orden estable | confirmada | Despacho padre y bodega `supabase/migrations/0001_init.sql:1065`, `:1084`; envases `supabase/migrations/0006_bodega_despachos_envases.sql:105`; devolución carga `:175`; producción `supabase/migrations/0009_fix_produccion_triggers.sql:86`; merma `supabase/migrations/0010_fix_mermas_produccion.sql:49`; iteraciones JSON sin ORDER BY `0002:134`, `0006:294` | UPDATE de carga de ventas también bloquea la fila, aunque no use SELECT FOR UPDATE. Deadlock es un riesgo pendiente de prueba concurrente, no un incidente demostrado. |
| B-04: devoluciones producto/envase son escrituras separadas | confirmada | `frontend/src/domains/bodega/api.ts:152`, `:182`; no RPC inicial conjunta en migraciones; sí existe RPC conjunta **de corrección**, `supabase/migrations/0006_bodega_despachos_envases.sql:327` | Conservar la distinción entre registro inicial separado y corrección conjunta ya existente. |
| B-04: faltan claves de idempotencia | confirmada | Tablas `supabase/migrations/0001_init.sql:189`, `:245`, `:272`, `:283`; argumentos RPC `supabase/migrations/0002_modulo_ventas.sql:57`, `supabase/migrations/0006_bodega_despachos_envases.sql:261`, `:327` | No hay clave de solicitud ni unicidad de operación/actor; transacción y botón deshabilitado no deduplican un reintento. |
| B-05: publicación remota vacía | no verificable | `supabase/migrations/0008_produccion_hu_19_23.sql:211` agrega producciones, incidencias_produccion y stock_envases; catálogo diagnóstico confirma esas tres | La cadena pretende tres tablas; el estado remoto necesita refresco. |
| B-05: 0008 no publica mermas | confirmada | `supabase/migrations/0008_produccion_hu_19_23.sql:211`; ninguna otra ALTER PUBLICATION en 0001–0010 | Confirmado en backend; la suscripción de UI queda en el área frontend, no se certificó por fuera del alcance autorizado. |
| B-05: no hay buckets y políticas Storage históricas son amplias | parcial | Bucket privado creado en `supabase/migrations/0001_init.sql:1850`; INSERT por rol `:1005`; SELECT por rol sin propietario `:1020`; diseño `bd/seed.sql:51`, `bd/rls_policies.sql:625` | No hay buckets remotos es evidencia histórica no refrescada; el seed **sí crea** comprobantes y aplica políticas amplias, no son solo comentarios inactivos. No hay UPDATE/DELETE de objetos ni validación de MIME/tamaño en estos SQL. |
| B-05: advisors 48 FK / 21 Auth / 2 índices sin uso | no verificable | Catálogo aislado: 36 FK sin cobertura completa según consulta documentada; índices `supabase/migrations/0001_init.sql:374` y `supabase/migrations/0006_bodega_despachos_envases.sql:41`; no métricas remotas | Conservar conteos del advisor fechados; no compararlos como mismo catálogo ni convertir falta de cobertura en lentitud demostrada. |
| B-05: backups/PITR sin restauración verificada | no verificable | No hay acceso al plan/configuración ni restauración de datos reales; guía `docs/engineering/database.md:6` mantiene gate | No se verifican contratación, retención, RPO/RTO ni recuperación remota en esta tarea. |
| S-02: producción/incidencias solo validan rol | parcial | Era baseline `supabase/migrations/0001_init.sql:951`; estado pretendido lo reemplaza con sucursal/actor en `supabase/migrations/0008_produccion_hu_19_23.sql:52`, `:60`, `:72`, `:85` | 0008 corrige parte del predicado local; no afirmar que está desplegado porque 0007 bloquea una instalación limpia. |
| S-02: stock_bodega INSERT/UPDATE sin sucursal equivalente | confirmada | Políticas efectivas `supabase/migrations/0001_init.sql:627`, `:632`; SELECT sí restringe `:616`; T9b permite saldo propio arbitrario e INSERT otra sucursal | Precisar que SELECT limita qué filas puede actualizar; T9 rechazó mover sucursal por UPDATE. No se demostró UPDATE directo de una fila invisible. |
| S-02: mermas SELECT amplio / INSERT privado reforzado | confirmada | SELECT efectivo `supabase/migrations/0001_init.sql:922`; INSERT efectivo `supabase/migrations/0010_fix_mermas_produccion.sql:145` | Correcto para el estado pretendido: INSERT exige autor y ámbito; SELECT permite bodega/producción de cualquier sucursal. |
| S-02: clientes DELETE administrativo | confirmada | `supabase/migrations/0001_init.sql:567`; FK ventas→cliente `:208` sin CASCADE | La política permite borrado de un cliente sin referencias; con ventas referenciadas la FK lo impide. No afirmar pérdida en cascada de ventas. Mapear a #29 / OND-58e. |
| S-03: conteos remotos de funciones anon/authenticated | no verificable | ACL locales de 24 funciones listadas abajo; no advisor ni catálogo remoto | Diferenciar funciones trigger de RPC; los conteos antiguos no son una prueba actual. |
| S-03: registrar_venta no exige rol ni perfil activo | confirmada | `supabase/migrations/0002_modulo_ventas.sql:94`, `:102`, `:105`; T1 perfil inactivo → ventas_inactivo=1 | Mantener; vendedor_id se toma de auth.uid(), incluso si llama administrador: no existe argumento de vendedor operativo. |
| S-03: registrar_venta ejecutable por anon | refutada | Última ACL `supabase/migrations/0003_correcciones_seguridad_ventas.sql:21`, `:24`, `:34`; `has_function_privilege('anon',...)` → false en catálogo aislado | No atribuir al estado local final un grant anónimo de registrar_venta. Los counts globales del advisor remoto no lo prueban. |
| S-03: corregir_devolucion valida admin pero confía p_creado_por | confirmada | `supabase/migrations/0006_bodega_despachos_envases.sql:343`, `:394`, `:407`; T5 guarda autor bodega bajo JWT admin | La auditoría usa auth.uid() (`supabase/migrations/0001_init.sql:1517`), pero la fila corregida usa autor suministrado; registrar la inconsistencia, no una suplantación del log. |
| S-03: grants amplios y search_path controlable | parcial | crear_despacho/corregir retienen EXECUTE PUBLIC por defecto (`supabase/migrations/0006_bodega_despachos_envases.sql:320`, `:413`); helpers revocados en 0003; producción/merma con path vacío en 0009/0010 | No todas carecen de SET search_path. Muchas fijan public y usan nombres sin calificar; 0009/0010 emplean vacío y nombres calificados. No se demostró explotación remota por resolución de nombres. Mapear a #30 / OND-ptq. |

### Estado efectivo por precedencia y diferencias con el diseño

**Orden utilizado:** 0001 baseline → 0002 RPC/ACL/vista → 0003 ACL/vista → 0004 catálogo → 0005 desactivación → 0006 bodega y cambio del modelo de envases → 0007 reemplazo de venta y reparación de saldos → 0008 RLS/producción/Realtime → 0009 helpers/triggers/indicadores → 0010 INSERT de merma y política. En replay estricto 0007 se ejecutó con `psql -1` y revirtió completo al fallar: el estado alcanzable conservó las funciones de 0006. El inventario siguiente es el estado **pretendido**, corroborado en una continuación diagnóstica que eliminó los cinco triggers duplicados antes de aplicar 0007 sin editar archivos.

- `bd/ondina_schema_supabase.sql:50` y `supabase/migrations/0001_init.sql:70` conservan sucursal obligatoria. `despacho_envases` está en el diseño (`bd/ondina_schema_supabase.sql:255`) y llega al baseline mediante 0006; el Mermaid `bd/diagramas_esquemas_mermaid.md:97` pasa de despacho_detalles a devoluciones sin dibujar despacho_envases: es una omisión del diagrama, no de la migración final.
- Diseño actual de ventas sin movimiento de envases: `bd/triggers_negocio.sql:122`, `:298`; 0006 lo reflejaba (`supabase/migrations/0006_bodega_despachos_envases.sql:125`, `:199`), pero 0007 lo revierte (`supabase/migrations/0007_fix_triggers_ventas.sql:53`, `:104`).
- `bd/triggers_bodega_despacho.sql:169` exige carga incluso a administrador; `supabase/migrations/0006_bodega_despachos_envases.sql:176` la exceptúa de la validación explícita. Si existe carga insuficiente, CHECK cantidad>=0 todavía aborta; si no existe fila y es admin, UPDATE afecta cero y sí se suma a bodega. `bd/triggers_negocio.sql:194` también incluye la excepción administrativa: los propios scripts de diseño no son una única definición coherente.
- Producción y merma del diseño (`bd/triggers_negocio.sql:238`, `:254`, `:400`) no incorporan el consumo/reintegro de retornables ni rechazo estricto de mermas de 0009/0010. RLS de diseño (`bd/rls_policies.sql:556`, `:562`, `:572`, `:577`) sigue con rol sin ámbito, a diferencia de 0008. Auditoría de diseño (`bd/auditoria.sql:83`, `:150`) sí coincide con cobertura general y envases; incidencias se añaden en 0008.
- `bd/vistas.sql:109` expone `jornada` chilena; `supabase/migrations/0001_init.sql:1709` expone `mes`. Ranking de diseño (`bd/vistas.sql:81`, `:83`) cuenta ventas distintas y suma bruto de detalles; migración (`supabase/migrations/0001_init.sql:1697`) cuenta ventas de cabecera y suma total neto. Contar cabeceras en esa vista local no duplica por detalle porque no hay JOIN de detalle.
- `bd/drop_todo.sql:5` es un script destructivo de diseño, **no se ejecutó** ni forma parte de la cadena. No sustituye un procedimiento de reconciliación; omite despacho_envases y RPC añadidas, aunque varios objetos pueden caer por CASCADE. `bd/seed.sql:51` coincide con bucket privado y `supabase/migrations/0001_init.sql:1850` lo versiona.

### Inventario final de funciones

Todas las funciones de negocio que retornan trigger se listan por su función, separadamente de su instalación. La ACL de creación conserva EXECUTE PUBLIC salvo revocación expresa; CREATE OR REPLACE conserva ACL, por lo que endurecer search_path en 0009/0010 no revoca EXECUTE. [Reglas oficiales de CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html).

| Función | Última definición | Seguridad | search_path |
| --- | --- | --- | --- |
| `private.es_rol` | `supabase/migrations/0009_fix_produccion_triggers.sql:15` | DEFINER | `''` |
| `private.mi_sucursal` | `supabase/migrations/0009_fix_produccion_triggers.sql:31` | DEFINER | `''` |
| `public.corregir_devolucion` | `supabase/migrations/0006_bodega_despachos_envases.sql:327` | DEFINER | `public` |
| `public.crear_despacho` | `supabase/migrations/0006_bodega_despachos_envases.sql:261` | INVOKER | `public` |
| `public.es_rol` | `supabase/migrations/0001_init.sql:439` | DEFINER | `public` |
| `public.fn_auditoria` | `supabase/migrations/0001_init.sql:1504` | DEFINER | `public` |
| `public.fn_auditoria_simple` | `supabase/migrations/0001_init.sql:1529` | DEFINER | `public` |
| `public.fn_sello_modificacion` | `supabase/migrations/0001_init.sql:1489` | INVOKER | `public` |
| `public.mi_sucursal` | `supabase/migrations/0001_init.sql:455` | DEFINER | `public` |
| `public.registrar_venta` | `supabase/migrations/0002_modulo_ventas.sql:57` | DEFINER | `public` |
| `public.trg_despacho_anular` | `supabase/migrations/0006_bodega_despachos_envases.sql:224` | DEFINER | `public` |
| `public.trg_despacho_detalle_insert` | `supabase/migrations/0001_init.sql:1056` | DEFINER | `public` |
| `public.trg_despacho_envase_insert` | `supabase/migrations/0006_bodega_despachos_envases.sql:77` | DEFINER | `public` |
| `public.trg_devolucion_envase_anular` | `supabase/migrations/0001_init.sql:1360` | DEFINER | `public` |
| `public.trg_devolucion_envase_insert` | `supabase/migrations/0001_init.sql:1194` | DEFINER | `public` |
| `public.trg_devolucion_producto_anular` | `supabase/migrations/0001_init.sql:1334` | DEFINER | `public` |
| `public.trg_devolucion_producto_insert` | `supabase/migrations/0006_bodega_despachos_envases.sql:162` | DEFINER | `public` |
| `public.trg_merma_anular` | `supabase/migrations/0001_init.sql:1390` | DEFINER | `public` |
| `public.trg_merma_insert` | `supabase/migrations/0010_fix_mermas_produccion.sql:14` | DEFINER | `''` |
| `public.trg_produccion_anular` | `supabase/migrations/0009_fix_produccion_triggers.sql:128` | DEFINER | `''` |
| `public.trg_produccion_insert` | `supabase/migrations/0009_fix_produccion_triggers.sql:56` | DEFINER | `''` |
| `public.trg_venta_anular` | `supabase/migrations/0007_fix_triggers_ventas.sql:90` | DEFINER | `public` |
| `public.trg_venta_detalle_insert` | `supabase/migrations/0007_fix_triggers_ventas.sql:27` | DEFINER | `public` |
| `public.trg_venta_recalcular_total` | `supabase/migrations/0007_fix_triggers_ventas.sql:72` | DEFINER | `public` |

### Inventario final de triggers

| Tabla / trigger | Última instalación | Evento / función |
| --- | --- | --- |
| `clientes.trg_sello_clientes` | `supabase/migrations/0001_init.sql:1579` | before update → `public.fn_sello_modificacion` |
| `despacho_detalles.trg_audit_despacho_detalles` | `supabase/migrations/0001_init.sql:1613` | after insert or update → `public.fn_auditoria_simple` |
| `despacho_detalles.trg_despacho_detalle_insert` | `supabase/migrations/0001_init.sql:1424` | after insert → `public.trg_despacho_detalle_insert` |
| `despacho_envases.trg_audit_despacho_envases` | `supabase/migrations/0006_bodega_despachos_envases.sql:421` | after insert or update → `public.fn_auditoria_simple` |
| `despacho_envases.trg_despacho_envase_insert` | `supabase/migrations/0006_bodega_despachos_envases.sql:119` | after insert → `public.trg_despacho_envase_insert` |
| `despachos.trg_audit_despachos` | `supabase/migrations/0001_init.sql:1557` | after insert or update → `public.fn_auditoria` |
| `despachos.trg_despacho_anular` | `supabase/migrations/0001_init.sql:1448` | after update of anulado → `public.trg_despacho_anular` |
| `despachos.trg_sello_despachos` | `supabase/migrations/0001_init.sql:1559` | before update → `public.fn_sello_modificacion` |
| `devoluciones_envases.trg_audit_devoluciones_envases` | `supabase/migrations/0001_init.sql:1600` | after insert or update → `public.fn_auditoria` |
| `devoluciones_envases.trg_devolucion_envase` | `supabase/migrations/0001_init.sql:1436` | after insert → `public.trg_devolucion_envase_insert` |
| `devoluciones_envases.trg_devolucion_envase_anular` | `supabase/migrations/0001_init.sql:1455` | after update of anulado → `public.trg_devolucion_envase_anular` |
| `devoluciones_productos.trg_audit_devoluciones_productos` | `supabase/migrations/0001_init.sql:1595` | after insert or update → `public.fn_auditoria` |
| `devoluciones_productos.trg_devolucion_producto` | `supabase/migrations/0001_init.sql:1434` | after insert → `public.trg_devolucion_producto_insert` |
| `devoluciones_productos.trg_devolucion_producto_anular` | `supabase/migrations/0001_init.sql:1451` | after update of anulado → `public.trg_devolucion_producto_anular` |
| `gastos_extras.trg_audit_gastos` | `supabase/migrations/0001_init.sql:1567` | after insert or update → `public.fn_auditoria` |
| `gastos_extras.trg_sello_gastos` | `supabase/migrations/0001_init.sql:1569` | before update → `public.fn_sello_modificacion` |
| `incidencias_produccion.trg_audit_incidencias_produccion` | `supabase/migrations/0008_produccion_hu_19_23.sql:189` | after insert or update → `public.fn_auditoria_simple` |
| `mermas.trg_audit_mermas` | `supabase/migrations/0001_init.sql:1573` | after insert or update → `public.fn_auditoria` |
| `mermas.trg_merma_anular` | `supabase/migrations/0001_init.sql:1462` | after update of anulado → `public.trg_merma_anular` |
| `mermas.trg_merma_insert` | `supabase/migrations/0010_fix_mermas_produccion.sql:130` | after insert → `public.trg_merma_insert` |
| `producciones.trg_audit_producciones` | `supabase/migrations/0001_init.sql:1563` | after insert or update → `public.fn_auditoria` |
| `producciones.trg_produccion_anular` | `supabase/migrations/0009_fix_produccion_triggers.sql:188` | after update of anulado → `public.trg_produccion_anular` |
| `producciones.trg_produccion_insert` | `supabase/migrations/0009_fix_produccion_triggers.sql:180` | after insert → `public.trg_produccion_insert` |
| `venta_detalles.trg_audit_venta_detalles` | `supabase/migrations/0001_init.sql:1608` | after insert or update → `public.fn_auditoria_simple` |
| `venta_detalles.trg_venta_detalle_insert` | `supabase/migrations/0007_fix_triggers_ventas.sql:123` | after insert → `public.trg_venta_detalle_insert` |
| `venta_detalles.trg_venta_total_del` | `supabase/migrations/0007_fix_triggers_ventas.sql:132` | after delete → `public.trg_venta_recalcular_total` |
| `venta_detalles.trg_venta_total_ins` | `supabase/migrations/0007_fix_triggers_ventas.sql:126` | after insert → `public.trg_venta_recalcular_total` |
| `venta_detalles.trg_venta_total_upd` | `supabase/migrations/0007_fix_triggers_ventas.sql:129` | after update → `public.trg_venta_recalcular_total` |
| `ventas.trg_audit_ventas` | `supabase/migrations/0001_init.sql:1551` | after insert or update → `public.fn_auditoria` |
| `ventas.trg_sello_ventas` | `supabase/migrations/0001_init.sql:1553` | before update → `public.fn_sello_modificacion` |
| `ventas.trg_venta_anular` | `supabase/migrations/0007_fix_triggers_ventas.sql:135` | after update of anulado → `public.trg_venta_anular` |

Los triggers AFTER del mismo evento se ejecutan por nombre: en detalle de venta, auditoría → movimiento → recalcular total; el recálculo hace UPDATE de ventas y genera otra auditoría de cabecera. No se observó recursión infinita: la anulación solo se dispara al modificar `anulado`. Una falla revierte también auditoría; su registro previo al movimiento no es evidencia de éxito persistente si hubo rollback. [Orden oficial de triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html).

### Inventario final de políticas

Se conserva el predicado completo normalizado para que sea revisable; **no se muestran políticas DROP ni ejemplos comentados**. Todas son permisivas y dirigidas a authenticated. Los grants de tabla siguen siendo una condición distinta de RLS.

| Tabla / política | Última definición | Comando y predicado efectivo |
| --- | --- | --- |
| `auditoria.auditoria_select_admin` | `supabase/migrations/0001_init.sql:998` | `for select to authenticated using (es_rol('administrador'))` |
| `carga_vendedor.carga_vendedor_delete_bodega` | `supabase/migrations/0001_init.sql:678` | `for delete to authenticated using (es_rol('bodega') or es_rol('administrador'))` |
| `carga_vendedor.carga_vendedor_select_propio` | `supabase/migrations/0001_init.sql:662` | `for select to authenticated using (auth.uid() = vendedor_id or es_rol('bodega') or es_rol('administrador'))` |
| `carga_vendedor.carga_vendedor_update_bodega` | `supabase/migrations/0001_init.sql:672` | `for update to authenticated using (es_rol('bodega') or es_rol('administrador')) with check (es_rol('bodega') or es_rol('administrador'))` |
| `carga_vendedor.carga_vendedor_write_bodega` | `supabase/migrations/0001_init.sql:667` | `for insert to authenticated with check (es_rol('bodega') or es_rol('administrador'))` |
| `clientes.clientes_delete_admin` | `supabase/migrations/0001_init.sql:567` | `for delete to authenticated using (es_rol('administrador'))` |
| `clientes.clientes_insert_cartera` | `supabase/migrations/0001_init.sql:552` | `for insert to authenticated with check ( (auth.uid() = vendedor_id and sucursal_id = mi_sucursal()) or es_rol('administrador') )` |
| `clientes.clientes_select_cartera` | `supabase/migrations/0001_init.sql:547` | `for select to authenticated using (auth.uid() = vendedor_id or es_rol('administrador'))` |
| `clientes.clientes_update_cartera` | `supabase/migrations/0001_init.sql:561` | `for update to authenticated using (auth.uid() = vendedor_id or es_rol('administrador')) with check (auth.uid() = vendedor_id or es_rol('administrador'))` |
| `configuracion.configuracion_insert_admin` | `supabase/migrations/0001_init.sql:579` | `for insert to authenticated with check (es_rol('administrador'))` |
| `configuracion.configuracion_select_admin` | `supabase/migrations/0001_init.sql:574` | `for select to authenticated using (es_rol('administrador'))` |
| `configuracion.configuracion_update_admin` | `supabase/migrations/0001_init.sql:584` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `despacho_detalles.despacho_detalles_insert_bodega` | `supabase/migrations/0001_init.sql:819` | `for insert to authenticated with check (es_rol('bodega') or es_rol('administrador'))` |
| `despacho_detalles.despacho_detalles_select_despacho` | `supabase/migrations/0001_init.sql:803` | `for select to authenticated using ( exists ( select 1 from despachos d where d.id = despacho_id and ( d.vendedor_id = auth.uid() or es_rol('bodega') or es_rol('produccion') or es_rol('administrador') ) ) )` |
| `despacho_detalles.despacho_detalles_update_admin` | `supabase/migrations/0001_init.sql:824` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `despacho_envases.despacho_envases_insert_bodega` | `supabase/migrations/0006_bodega_despachos_envases.sql:64` | `for insert to authenticated with check (es_rol('bodega') or es_rol('administrador'))` |
| `despacho_envases.despacho_envases_select_despacho` | `supabase/migrations/0006_bodega_despachos_envases.sql:48` | `for select to authenticated using ( exists ( select 1 from public.despachos d where d.id = despacho_id and ( d.vendedor_id = auth.uid() or es_rol('bodega') or es_rol('produccion') or es_rol('administrador') ) ) )` |
| `despacho_envases.despacho_envases_update_admin` | `supabase/migrations/0006_bodega_despachos_envases.sql:69` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `despachos.despachos_insert_bodega` | `supabase/migrations/0001_init.sql:783` | `for insert to authenticated with check ( ( es_rol('bodega') and despachador_id = auth.uid() and sucursal_id = mi_sucursal() ) or es_rol('administrador') )` |
| `despachos.despachos_select_operativo` | `supabase/migrations/0001_init.sql:773` | `for select to authenticated using ( auth.uid() = vendedor_id or (es_rol('bodega') and sucursal_id = mi_sucursal()) or (es_rol('produccion') and sucursal_id = mi_sucursal()) or es_rol('administrador') )` |
| `despachos.despachos_update_admin` | `supabase/migrations/0001_init.sql:795` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `devoluciones_envases.devoluciones_envases_insert_despacho` | `supabase/migrations/0001_init.sql:895` | `for insert to authenticated with check ( es_rol('administrador') or ( es_rol('bodega') and exists ( select 1 from despachos d where d.id = despacho_id and d.sucursal_id = mi_sucursal() ) ) or exists ( select 1 from despachos d where d.id = despacho_id and d.vendedor_id = auth.uid() ) )` |
| `devoluciones_envases.devoluciones_envases_select_despacho` | `supabase/migrations/0001_init.sql:876` | `for select to authenticated using ( es_rol('administrador') or ( es_rol('bodega') and exists ( select 1 from despachos d where d.id = despacho_id and d.sucursal_id = mi_sucursal() ) ) or exists ( select 1 from despachos d where d.id = despacho_id and d.vendedor_id = auth.uid() ) )` |
| `devoluciones_envases.devoluciones_envases_update_admin` | `supabase/migrations/0001_init.sql:914` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `devoluciones_productos.devoluciones_productos_insert_despacho` | `supabase/migrations/0001_init.sql:851` | `for insert to authenticated with check ( es_rol('administrador') or ( es_rol('bodega') and exists ( select 1 from despachos d where d.id = despacho_id and d.sucursal_id = mi_sucursal() ) ) or exists ( select 1 from despachos d where d.id = despacho_id and d.vendedor_id = auth.uid() ) )` |
| `devoluciones_productos.devoluciones_productos_select_despacho` | `supabase/migrations/0001_init.sql:832` | `for select to authenticated using ( es_rol('administrador') or ( es_rol('bodega') and exists ( select 1 from despachos d where d.id = despacho_id and d.sucursal_id = mi_sucursal() ) ) or exists ( select 1 from despachos d where d.id = despacho_id and d.vendedor_id = auth.uid() ) )` |
| `devoluciones_productos.devoluciones_productos_update_admin` | `supabase/migrations/0001_init.sql:870` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `gastos_extras.gastos_extras_insert_vendedor` | `supabase/migrations/0001_init.sql:753` | `for insert to authenticated with check ( (auth.uid() = vendedor_id and sucursal_id = mi_sucursal()) or es_rol('administrador') )` |
| `gastos_extras.gastos_extras_select_propio` | `supabase/migrations/0001_init.sql:748` | `for select to authenticated using (auth.uid() = vendedor_id or es_rol('administrador'))` |
| `gastos_extras.gastos_extras_update_admin` | `supabase/migrations/0001_init.sql:762` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `incidencias_produccion.incidencias_produccion_insert_produccion` | `supabase/migrations/0008_produccion_hu_19_23.sql:85` | `for insert to authenticated with check ( creado_por = (select auth.uid()) and (private.es_rol('produccion') or private.es_rol('administrador')) and ( produccion_id is null or exists ( select 1 from public.producciones p where p.id = produccion_id and p.sucursal_id = private.mi_sucursal() ) ) )` |
| `incidencias_produccion.incidencias_produccion_select_produccion` | `supabase/migrations/0008_produccion_hu_19_23.sql:72` | `for select to authenticated using ( private.es_rol('administrador') or ( private.es_rol('produccion') and creado_por in ( select id from public.perfiles where sucursal_id = private.mi_sucursal() ) ) )` |
| `mermas.mermas_insert_operativo` | `supabase/migrations/0010_fix_mermas_produccion.sql:145` | `for insert to authenticated with check ( creado_por = (select auth.uid()) and ( private.es_rol('administrador') or ( private.es_rol('bodega') and sucursal_id = private.mi_sucursal() ) or ( private.es_rol('produccion') and sucursal_id = private.mi_sucursal() and despacho_id is null and producto_id is not null ) ) )` |
| `mermas.mermas_select_operativo` | `supabase/migrations/0001_init.sql:922` | `for select to authenticated using ( es_rol('bodega') or es_rol('produccion') or es_rol('administrador') or ( despacho_id is not null and exists ( select 1 from despachos d where d.id = despacho_id and d.vendedor_id = auth.uid() ) ) )` |
| `mermas.mermas_update_admin` | `supabase/migrations/0001_init.sql:943` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `perfiles.perfiles_insert_admin` | `supabase/migrations/0001_init.sql:482` | `for insert to authenticated with check (es_rol('administrador'))` |
| `perfiles.perfiles_select_propio` | `supabase/migrations/0001_init.sql:470` | `for select to authenticated using ( auth.uid() = id or es_rol('administrador') or ( es_rol('bodega') and sucursal_id = mi_sucursal() ) )` |
| `perfiles.perfiles_update_admin` | `supabase/migrations/0001_init.sql:487` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `producciones.producciones_insert_produccion` | `supabase/migrations/0008_produccion_hu_19_23.sql:60` | `for insert to authenticated with check ( creado_por = (select auth.uid()) and sucursal_id = private.mi_sucursal() and (private.es_rol('produccion') or private.es_rol('administrador')) )` |
| `producciones.producciones_select_produccion` | `supabase/migrations/0008_produccion_hu_19_23.sql:52` | `for select to authenticated using ( private.es_rol('administrador') or (private.es_rol('produccion') and sucursal_id = private.mi_sucursal()) )` |
| `producciones.producciones_update_admin` | `supabase/migrations/0001_init.sql:961` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `productos.productos_insert_admin` | `supabase/migrations/0001_init.sql:534` | `for insert to authenticated with check (es_rol('administrador'))` |
| `productos.productos_select_autenticado` | `supabase/migrations/0001_init.sql:529` | `for select to authenticated using (true)` |
| `productos.productos_update_admin` | `supabase/migrations/0001_init.sql:539` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `reglas_comision.reglas_comision_delete_admin` | `supabase/migrations/0001_init.sql:608` | `for delete to authenticated using (es_rol('administrador'))` |
| `reglas_comision.reglas_comision_insert_admin` | `supabase/migrations/0001_init.sql:597` | `for insert to authenticated with check (es_rol('administrador'))` |
| `reglas_comision.reglas_comision_select_autenticado` | `supabase/migrations/0001_init.sql:592` | `for select to authenticated using (true)` |
| `reglas_comision.reglas_comision_update_admin` | `supabase/migrations/0001_init.sql:602` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `stock_bodega.stock_bodega_select_operativo` | `supabase/migrations/0001_init.sql:616` | `for select to authenticated using ( es_rol('administrador') or ( (es_rol('bodega') or es_rol('produccion')) and sucursal_id = mi_sucursal() ) )` |
| `stock_bodega.stock_bodega_update_bodega` | `supabase/migrations/0001_init.sql:632` | `for update to authenticated using (es_rol('bodega') or es_rol('administrador')) with check (es_rol('bodega') or es_rol('administrador'))` |
| `stock_bodega.stock_bodega_write_bodega` | `supabase/migrations/0001_init.sql:627` | `for insert to authenticated with check (es_rol('bodega') or es_rol('administrador'))` |
| `stock_envases.stock_envases_select_operativo` | `supabase/migrations/0009_fix_produccion_triggers.sql:201` | `for select to authenticated using ( private.es_rol('administrador') or ( (private.es_rol('bodega') or private.es_rol('produccion')) and sucursal_id = private.mi_sucursal() ) )` |
| `stock_envases.stock_envases_update_bodega` | `supabase/migrations/0001_init.sql:654` | `for update to authenticated using (es_rol('bodega') or es_rol('administrador')) with check (es_rol('bodega') or es_rol('administrador'))` |
| `stock_envases.stock_envases_write_bodega` | `supabase/migrations/0001_init.sql:649` | `for insert to authenticated with check (es_rol('bodega') or es_rol('administrador'))` |
| `storage.objects.comprobantes_insert_vendedor` | `supabase/migrations/0001_init.sql:1005` | `for insert to authenticated with check ( bucket_id = 'comprobantes' and (es_rol('vendedor') or es_rol('administrador')) )` |
| `storage.objects.comprobantes_select_propio` | `supabase/migrations/0001_init.sql:1020` | `for select to authenticated using ( bucket_id = 'comprobantes' and (es_rol('vendedor') or es_rol('bodega') or es_rol('administrador')) )` |
| `sucursales.sucursales_insert_admin` | `supabase/migrations/0001_init.sql:500` | `for insert to authenticated with check (es_rol('administrador'))` |
| `sucursales.sucursales_select_autenticado` | `supabase/migrations/0001_init.sql:495` | `for select to authenticated using (true)` |
| `sucursales.sucursales_update_admin` | `supabase/migrations/0001_init.sql:505` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `tipos_empaque.tipos_empaque_insert_admin` | `supabase/migrations/0001_init.sql:518` | `for insert to authenticated with check (es_rol('administrador'))` |
| `tipos_empaque.tipos_empaque_select_autenticado` | `supabase/migrations/0001_init.sql:513` | `for select to authenticated using (true)` |
| `tipos_empaque.tipos_empaque_update_admin` | `supabase/migrations/0001_init.sql:523` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `ubicaciones_vendedores.ubicaciones_vendedores_insert_propio` | `supabase/migrations/0001_init.sql:988` | `for insert to authenticated with check ( auth.uid() = vendedor_id or es_rol('administrador') )` |
| `ubicaciones_vendedores.ubicaciones_vendedores_select_operativo` | `supabase/migrations/0001_init.sql:979` | `for select to authenticated using ( auth.uid() = vendedor_id or es_rol('bodega') or es_rol('administrador') )` |
| `venta_detalles.venta_detalles_insert_venta` | `supabase/migrations/0001_init.sql:718` | `for insert to authenticated with check ( exists ( select 1 from ventas v where v.id = venta_id and (v.vendedor_id = auth.uid() or es_rol('administrador')) ) )` |
| `venta_detalles.venta_detalles_select_venta` | `supabase/migrations/0001_init.sql:707` | `for select to authenticated using ( exists ( select 1 from ventas v where v.id = venta_id and (v.vendedor_id = auth.uid() or es_rol('administrador')) ) )` |
| `venta_detalles.venta_detalles_update_admin` | `supabase/migrations/0001_init.sql:729` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |
| `ventas.ventas_insert_vendedor` | `supabase/migrations/0001_init.sql:690` | `for insert to authenticated with check ( (auth.uid() = vendedor_id and sucursal_id = mi_sucursal()) or es_rol('administrador') )` |
| `ventas.ventas_select_propio` | `supabase/migrations/0001_init.sql:685` | `for select to authenticated using (auth.uid() = vendedor_id or es_rol('administrador'))` |
| `ventas.ventas_update_admin` | `supabase/migrations/0001_init.sql:699` | `for update to authenticated using (es_rol('administrador')) with check (es_rol('administrador'))` |

### Inventario final de vistas, permisos y publicación

| Vista | Última definición | security_invoker |
| --- | --- | --- |
| `public.v_bidones_vacios_vendedor` | `supabase/migrations/0003_correcciones_seguridad_ventas.sql:39` | true |
| `public.v_clientes_inactivos` | `supabase/migrations/0001_init.sql:1738` | no declarado |
| `public.v_comision_vendedor` | `supabase/migrations/0001_init.sql:1709` | no declarado |
| `public.v_cuadre_despacho` | `supabase/migrations/0001_init.sql:1647` | no declarado |
| `public.v_historial_cliente` | `supabase/migrations/0001_init.sql:1760` | no declarado |
| `public.v_indicadores_produccion_diarios` | `supabase/migrations/0009_fix_produccion_triggers.sql:217` | true |
| `public.v_ranking_vendedores` | `supabase/migrations/0001_init.sql:1693` | no declarado |
| `public.v_stock_actual` | `supabase/migrations/0001_init.sql:1637` | no declarado |
| `public.v_ventas_diarias` | `supabase/migrations/0001_init.sql:1685` | no declarado |
| `public.v_ventas_producto` | `supabase/migrations/0001_init.sql:1775` | no declarado |

Las ocho vistas de 0001 se crean sin security_invoker; 0003 y 0009 sí lo fijan en las dos vistas posteriores. **Ningún GRANT SELECT a anon sobre esas ocho vistas aparece en 0001–0010**: una exposición anónima dependería de ACL preexistentes/default privileges de Supabase y debe comprobarse en el catálogo correspondiente, sin extrapolar desde PostgreSQL vacío.

| Objeto / permiso efectivo declarado | Última evidencia | Alcance observado |
| --- | --- | --- |
| public.es_rol(text), public.mi_sucursal() | `supabase/migrations/0003_correcciones_seguridad_ventas.sql:17`, `:19`, `:32`, `:33` | EXECUTE authenticated; PUBLIC/anon revocados. Helper público mi_sucursal no filtra activo; es_rol sí. |
| registrar_venta(uuid,text,jsonb,numeric,text) | `supabase/migrations/0003_correcciones_seguridad_ventas.sql:21`, `:24`, `:34` | EXECUTE authenticated; PUBLIC/anon revocados. |
| crear_despacho(uuid,uuid,uuid,uuid,jsonb,jsonb) | `supabase/migrations/0006_bodega_despachos_envases.sql:320` | Grant authenticated y EXECUTE PUBLIC de creación sin revocar; es invoker, RLS/ACL aplican. |
| corregir_devolucion(uuid,uuid,jsonb,jsonb) | `supabase/migrations/0006_bodega_despachos_envases.sql:413` | Grant authenticated y EXECUTE PUBLIC sin revocar; DEFINER con guarda admin activo. |
| Funciones trigger y auditoría públicas | Definiciones del inventario anterior; no REVOKE posterior | EXECUTE PUBLIC por defecto; retorno trigger no es RPC ordinaria que permita usar NEW libremente. |
| private schema, private.es_rol(text), private.mi_sucursal() | `supabase/migrations/0009_fix_produccion_triggers.sql:12`, `:13`, `:44`, `:45`, `:47`, `:48` | USAGE/EXECUTE authenticated; PUBLIC/anon revocados; ambos helpers filtran activo. |
| perfiles, productos, tipos_empaque, stock_envases, stock_bodega | `supabase/migrations/0008_produccion_hu_19_23.sql:228`, `:230`, `:231`, `:233`, `:234` | SELECT authenticated explícito. |
| producciones, incidencias_produccion | `supabase/migrations/0008_produccion_hu_19_23.sql:236`, `:238` | SELECT/INSERT authenticated explícitos. |
| mermas | `supabase/migrations/0010_fix_mermas_produccion.sql:175` | SELECT/INSERT authenticated explícitos. |
| v_indicadores_produccion_diarios | `supabase/migrations/0009_fix_produccion_triggers.sql:233`, `:237` | PUBLIC/anon revocados; SELECT authenticated. |
| Otras tablas/vistas/secuencias y storage.objects | No otro GRANT/REVOKE en la cadena | ACL finales dependen de defaults de plataforma. El fixture dio permisos DML solo para probar predicados RLS; no atribuirlos a migraciones. |
| supabase_realtime | `supabase/migrations/0008_produccion_hu_19_23.sql:211` | ADD TABLE producciones, incidencias_produccion y stock_envases; no mermas. La publicación debe existir previamente. |

0002 intenta revocar registrar_venta **antes de crearla** (`supabase/migrations/0002_modulo_ventas.sql:35`) dentro de un bloque `EXCEPTION WHEN OTHERS THEN NULL`: en una base limpia el error revierte los REVOKE anteriores de ese bloque. 0003 sí corrige la ACL final. No usar el comentario inicial de 0002 como evidencia de permisos finales ni eliminar 0003 por considerarla redundante. [Semántica oficial de EXCEPTION y rollback del bloque](https://www.postgresql.org/docs/current/plpgsql-control-structures.html).

## Hallazgos nuevos

### BACK-N1 — 0007 reintroduce doble entrada de envases

- **Severidad:** alta. **Estado:** confirmado en continuación diagnóstica; no se afirma despliegue remoto.
- **Evidencia:** `supabase/migrations/0007_fix_triggers_ventas.sql:53` suma envases al vender; `supabase/migrations/0001_init.sql:1201` vuelve a sumarlos al devolver a bodega. Contradice `supabase/migrations/0006_bodega_despachos_envases.sql:148` y `bd/triggers_negocio.sql:122`.
- **Comando usado:** T3 mediante `docker exec -i ... psql`; stock envases 10 → venta con 2 recibidos: 12 → devolución de esos 2: 14.
- **Impacto:** existencia útil registrada antes de llegar a bodega y contada dos veces; producción puede consumir envases inexistentes. No hay vínculo de procedencia que evite reportar el mismo lote en ambos pasos.
- **Issue relacionado:** #32 / OND-lpu, #28 / OND-8wi y #33 / OND-rnd. **Edición sugerida:** añadir criterio venta→retorno→producción que pruebe una única entrada física, y resolver expresamente qué definición prevalece al reconciliar 0007.

### BACK-N2 — Bodega inserta líneas en despachos de otra sucursal

- **Severidad:** alta. **Estado:** confirmado con rol authenticated y permisos DML de fixture.
- **Evidencia:** `supabase/migrations/0001_init.sql:819` y `supabase/migrations/0006_bodega_despachos_envases.sql:64` comprueban solo rol; funciones DEFINER `supabase/migrations/0001_init.sql:1056` y `supabase/migrations/0006_bodega_despachos_envases.sql:77` leen el padre sin comprobar identidad/ámbito.
- **Comando usado:** T2: bodega A inserta detalle en despacho B conocido por UUID; stock B 100 → 97, exit 0. No necesita que SELECT del padre permita verlo: la función DEFINER lo lee.
- **Impacto:** mueve inventario y carga de una sucursal ajena mediante INSERT directo. También `creado_por` del despacho/corrección y de varias escrituras directas se acepta sin equivalencia a auth.uid(); las FK validan existencia, no autoridad.
- **Issue relacionado:** #29 / OND-58e y #30 / OND-ptq. **Aceptación adicional:** probar INSERT directo de detalle y envase con UUID ajeno conocido; rechazar sin movimiento ni auditoría persistente.

### BACK-N3 — La ventana de ajuste se omite declarando es_ajuste=false

- **Severidad:** alta. **Estado:** confirmado.
- **Evidencia:** `supabase/migrations/0001_init.sql:1071` y `supabase/migrations/0006_bodega_despachos_envases.sql:92` solo verifican plazo si el cliente marca es_ajuste; default false en `supabase/migrations/0001_init.sql:267` y `supabase/migrations/0006_bodega_despachos_envases.sql:37`.
- **Comando usado:** T2 utiliza despacho de dos días y omite es_ajuste; el movimiento se acepta. La guarda temporal queda evitada independientemente del defecto de sucursal.
- **Impacto:** cualquier nueva línea puede presentarse como inicial fuera de los 15 minutos, incumpliendo HU-26. Configuracion.valor es texto sin validación: valores no enteros rompen el trigger (`supabase/migrations/0001_init.sql:1072`).
- **Issue relacionado:** #66 / OND-w76.9, #30 / OND-ptq. **Aceptación adicional:** derivar el carácter de ajuste en servidor y rechazar nuevas líneas tardías aunque es_ajuste=false o creado_en manipulado; validar parámetro temporal y límite exacto.

### BACK-N4 — Corrección no agrega duplicados ni serializa el despacho

- **Severidad:** alta. **Estado:** confirmado para duplicados; probable para carrera concurrente (sin ensayo de dos sesiones).
- **Evidencia:** `supabase/migrations/0006_bodega_despachos_envases.sql:347` lee sin FOR UPDATE; `:353` valida cada fila separadamente; `:386` reinserta todas. Trigger de devolución `:169` no bloquea padre ni verifica anulado; usa carga acumulada del vendedor, no pendiente del despacho.
- **Comando usado:** T5: despacho con 10 unidades y carga acumulada suficiente; dos filas del mismo producto de 7 pasan el tope individual y registran 14. El mismo ensayo fija p_creado_por a bodega bajo JWT admin; fila queda con autor ajeno, mientras log registra admin.
- **Impacto:** supera tope del despacho; correcciones simultáneas o INSERT inicial concurrente pueden dejar conjuntos que no corresponden a una sola corrección. No se afirma un deadlock reproducido.
- **Issue relacionado:** #32 / OND-lpu, #33 / OND-rnd, #42 / OND-vi4, #61 / OND-w76.4. **Aceptación adicional:** agregar por producto antes de validar, bloquear el padre compartido por todos los flujos y comprobar despacho activo; pruebas con productos repetidos y dos correcciones simultáneas.

### BACK-N5 — Anulación de despacho con devolución parcial crea stock

- **Severidad:** alta. **Estado:** confirmado.
- **Evidencia:** `supabase/migrations/0006_bodega_despachos_envases.sql:233` repone todo lo despachado y `:241` trunca carga a cero sin descontar devoluciones/ventas/mermas posteriores. `supabase/migrations/0001_init.sql:1341` omite reversión de devolución si el padre ya está anulado. Producción hace truncamiento equivalente (`supabase/migrations/0009_fix_produccion_triggers.sql:139`).
- **Comando usado:** T4: bodega 100 → despacho 10 → devolución 4 → anular despacho; bodega final **104**. Las operaciones fueron root con actor admin para aislar aritmética, no una prueba de elevación de rol.
- **Impacto:** CHECK cantidad>=0 conserva no negatividad pero no conservación del inventario. Una anulación posterior al consumo de producto también puede reintegrar envases sin recuperar unidades ya vendidas.
- **Issue relacionado:** #32 / OND-lpu. **Aceptación adicional:** comparar suma de existencias y movimientos en anulación con devolución parcial, ventas/mermas y producción consumida; rechazar dependencias incompatibles o compensarlas explícitamente sin greatest que oculte faltantes.

### BACK-N6 — UPDATE y anulación utilizan valores nuevos y permiten compensar repetidamente

- **Severidad:** alta. **Estado:** confirmado.
- **Evidencia:** `supabase/migrations/0001_init.sql:1396`, `:1409` compensan usando NEW; política admin `:943`; no trigger prohíbe reactivación. Funciones de reversión de venta/despacho/devoluciones/producción tampoco fijan campos originales ni tratan true→false.
- **Comando usado:** T6: merma de 2 deja stock 98; UPDATE cantidad=20,anulado=true → **118**. T12: merma 2, anular, reactivar, volver a anular → **102** desde 100.
- **Impacto:** anulación única por transición no equivale a compensación única por operación. Cambiar IDs/sucursal/cantidad antes o durante anulación puede afectar saldos distintos de los originales.
- **Issue relacionado:** #32 / OND-lpu y #61 / OND-w76.4. **Aceptación adicional:** inmutabilidad de campos que determinaron movimientos o compensación OLD→NEW; impedir reactivación sin nuevo movimiento y probar varios ciclos.

### BACK-N7 — INSERT ya anulado mueve inventario y queda fuera de reportes

- **Severidad:** alta. **Estado:** confirmado.
- **Evidencia:** `supabase/migrations/0009_fix_produccion_triggers.sql:67` no comprueba NEW.anulado; policy `supabase/migrations/0008_produccion_hu_19_23.sql:60` tampoco. Merma INSERT `supabase/migrations/0010_fix_mermas_produccion.sql:28` y devoluciones `supabase/migrations/0006_bodega_despachos_envases.sql:169` / `supabase/migrations/0001_init.sql:1200` tienen patrón similar.
- **Comando usado:** T7: INSERT produccion(cantidad=2,anulado=true) → bodega 102, envases 8 desde 10, indicadores 0.
- **Impacto:** operación invisible en agregados activos que sí consume/suma saldo; UPDATE true→true no compensará porque no hay transición. No hay CHECK que fuerce false en inserción.
- **Issue relacionado:** #32 / OND-lpu, #29 / OND-58e. **Aceptación adicional:** insertar registros anulados por REST/SQL autenticado debe rechazarse o tener efecto cero, con regla común y auditoría.

### BACK-N8 — Comisión reconstruida tiene mes, pero el cliente exige jornada

- **Severidad:** alta. **Estado:** confirmado.
- **Evidencia:** `supabase/migrations/0001_init.sql:1712` expone mes; `frontend/src/domains/ventas/api.ts:193` ordena por jornada; `bd/vistas.sql:112` es el diseño diario; tipos generados siguen mes (`frontend/src/types/database-generated.types.ts:1486`).
- **Comando usado:** T10: `select jornada from public.v_comision_vendedor limit 1` → exit 3, column jornada does not exist.
- **Impacto:** una base reconstruida según las migraciones falla al consultar la comisión desde el servicio actual, aunque existan ventas y permisos. No depende de datos remotos.
- **Issue relacionado:** #28 / OND-8wi, #34 / OND-cop, #35 / OND-uoi y #51 / OND-yew (tipos). **Aceptación adicional:** contrato de columnas y granularidad comprobado por llamada del cliente contra esquema reconstruido; regenerar tipos desde ese mismo esquema.

### BACK-N9 — Editar descuento de cabecera no recalcula total

- **Severidad:** media. **Estado:** confirmado.
- **Evidencia:** `supabase/migrations/0007_fix_triggers_ventas.sql:72` recalcula solo por triggers de detalles (`:126`, `:129`, `:132`); ventas tiene UPDATE admin (`supabase/migrations/0001_init.sql:699`) y ningún trigger de descuento/total.
- **Comando usado:** T8: venta de 1000, UPDATE descuento=500 → total permanece **1000.00**. Cambiar venta_id de un detalle recalcula solo el padre NEW (`supabase/migrations/0007_fix_triggers_ventas.sql:76`) y tampoco compensa carga ni total del padre OLD; esto último se constató en código, no en T8.
- **Impacto:** totales de cabecera, ranking/diarias y detalle se contradicen; permitir UPDATE directo de total también deja valores arbitrarios no negativos.
- **Issue relacionado:** #32 / OND-lpu y #61 / OND-w76.4. **Aceptación adicional:** prohibir mutaciones incompatibles o recalcular ambos padres/total al cambiar descuentos; comparar todos los agregados con fixtures.

### BACK-N10 — Dinero NUMERIC acepta NaN pese a CHECK no negativo

- **Severidad:** alta. **Estado:** confirmado.
- **Evidencia:** `supabase/migrations/0002_modulo_ventas.sql:137`, `:146` castean y solo comprueban precio<0; `supabase/migrations/0001_init.sql:218` CHECK precio>=0 y `:198` total>=0 no excluyen NaN. NUMERIC(12,2) es correcto para aritmética decimal ordinaria, pero no implica finitud.
- **Comando usado:** T11: detalle JSON con `"precio_unitario":"NaN"` → venta aceptada, `total=NaN`, exit 0.
- **Impacto:** valores monetarios no finitos entran en venta, subtotal y agregados. No se afirma aceptación de Infinity en NUMERIC(12,2), que tiene restricciones diferentes.
- **Issue:** **sin issue (proponer)**. **Título sugerido:** `[P1][Backend] Rechazar importes no finitos en ventas y configuración monetaria`. **Criterios de aceptación:** restricciones y RPC rechazan NaN en precio, descuento, total, gastos y reglas; prueban JSON string/casts, límites y rollback; conservan cálculo decimal y precios históricos. Vincular con #30 y #32.

### BACK-N11 — Saldo directo, carga y ubicación con ámbito más amplio del requerido

- **Severidad:** alta. **Estado:** confirmado para saldo directo y por predicados para carga/GPS.
- **Evidencia:** `supabase/migrations/0001_init.sql:627`, `:632` dejan INSERT/UPDATE a bodega; `:662`, `:667`, `:672`, `:678` permiten a bodega leer/escribir/borrar carga de cualquier vendedor; ubicación SELECT `:979` permite bodega sin sucursal. En ventas/clientes/gastos, ramas auth.uid()=vendedor_id no exigen es_rol('vendedor')/activo (`:547`, `:552`, `:685`, `:690`, `:748`, `:753`).
- **Comando usado:** T9b: UPDATE saldo propio=777 y INSERT en Planta Ondina ajena=123 pasan con rol bodega; T9 mover la fila de sucursal fue rechazado. Lectura estática del inventario de políticas para el resto; no prueba REST remota.
- **Impacto:** stock puede cambiar sin operación ni auditoría; eliminar carga permite que posteriores UPDATE de reversión afecten cero filas; inactivación no cierra todas las ramas basadas solo en identidad. GPS requiere decisión de alcance en #64 antes de activarse.
- **Issue relacionado:** #29 / OND-58e, #58 / OND-w76.1, #64 / OND-w76.7. **Aceptación adicional:** cubrir carga_vendedor, stock_envases y ubicaciones, y operaciones directas de perfiles inactivos; no limitar la matriz a las tablas mencionadas en S-02.

### BACK-N12 — RPC aceptan catálogo inactivo y entradas parcialmente ignoradas

- **Severidad:** media. **Estado:** confirmado en código; política comercial exacta de precios requiere decisión.
- **Evidencia:** registrar_venta valida cantidad/precio pero no productos.activo ni categoría de empaque (`supabase/migrations/0002_modulo_ventas.sql:134`); despacho tampoco (`supabase/migrations/0006_bodega_despachos_envases.sql:294`, `:305`). `p_envases` que no sea array se ignora sin error (`:304`). Corrección omite cantidades <=0 (`:357`, `:390`). FK vendedor→perfiles no exige rol vendedor (`supabase/migrations/0001_init.sql:256`).
- **Comando usado:** lectura completa y normalización de SQL; no se añadió ensayo de todos los tipos JSON.
- **Impacto:** desactivar catálogo no impide operaciones directas nuevas; un payload mal formado puede producir éxito parcial respecto de lo solicitado (envases omitidos). Precio histórico congelado se preserva, pero el servidor permite cualquier precio no negativo; no declarar desviación del catálogo como fraude sin ratificar reglas comerciales.
- **Issue relacionado:** #30 / OND-ptq, #65 / OND-w76.8, #33 / OND-rnd. **Aceptación adicional:** validar forma JSON, IDs, activo/rol/categoría y duplicados; rechazar entradas inválidas sin escrituras; ratificar permisos de precio/descuento, sin imponer igualdad con precio_base a ventas históricas.

### BACK-N13 — Cobertura de índices incompleta y varias restricciones no expresadas

- **Severidad:** media. **Estado:** confirmado en estructura; impacto de rendimiento probable y requiere medición.
- **Evidencia:** índices `supabase/migrations/0001_init.sql:374` y `supabase/migrations/0006_bodega_despachos_envases.sql:41`; incidencias FK sin índice `supabase/migrations/0001_init.sql:328`; producciones.producto_id `:316`; despacho_envases.tipo_empaque_id `supabase/migrations/0006_bodega_despachos_envases.sql:35`. Reglas permiten porcentaje y monto simultáneos, porcentaje>100 y vigencias solapadas (`supabase/migrations/0001_init.sql:141`, `:146`, `:147`); configuracion.valor texto (`:130`); motivo de merma solo NOT NULL (`:303`).
- **Comando usado:** consulta pg_constraint/pg_index del apéndice → **36** FK sin índice válido no parcial con todas las columnas FK al principio. Algunas tienen cobertura parcial por un índice de una sola columna: el conteo no significa 36 escaneos secuenciales inevitables. No se ejecutó EXPLAIN ni carga.
- **Impacto:** posibles costes de comprobación de FK y filtros; reglas ambiguas con selección por vigente_desde y empates sin desempate secundario. Ausencia de CHECK rol en FK no autoriza por sí sola: debe cubrirse en operación/RLS. No afirmar dinero almacenado como float: es NUMERIC(12,2), cantidades integer y timestamps timestamptz.
- **Issue relacionado:** #47 / OND-vrn, #34 / OND-cop, #63 / OND-w76.6, #67 / OND-w76.10. **Aceptación adicional:** medir índices de incidencias/producción/devoluciones y filtros compuestos sucursal-fecha bajo RLS; ratificar combinación/porcentaje/solapamientos de reglas y validar configuración/motivos. No crear todos los índices automáticamente.

### BACK-N14 — Reparación de carga en 0007 presupone que ninguna venta fue descontada

- **Severidad:** alta. **Estado:** probable, condicionado al historial/datos del entorno de actualización.
- **Evidencia:** `supabase/migrations/0007_fix_triggers_ventas.sql:150`, `:153`, `:160` descuentan todas las ventas activas, aunque 0001/0006 ya definen movimiento al insertar. No hay marca por venta ni identificación de movimientos previamente aplicados.
- **Comando usado:** lectura de 0007 y replay estricto que confirma la incompatibilidad del baseline; no se ejecutó la reparación sobre datos reales ni se simuló un historial remoto específico.
- **Impacto:** arreglar solo los CREATE TRIGGER duplicados puede habilitar un backfill que descuente dos veces ventas ya procesadas; greatest oculta el faltante al truncar. Reejecutar el backfill tampoco es idempotente sobre esos datos.
- **Issue relacionado:** #28 / OND-8wi, #42 / OND-vi4, #32 / OND-lpu. **Aceptación adicional:** plan de upgrade distingue operaciones descontadas/no descontadas con evidencia de origen y ensayo sobre datos sintéticos representativos; no usar reparación masiva por total de ventas sin esa reconciliación.

## Issues revisados

Fuente: snapshots de solo lectura `gh-issues.json` y `beads.json` en el scratchpad indicado por el coordinador; todos los GitHub siguientes aparecen OPEN. No se refrescó GitHub ni se alteró Beads. La revisión de HU se limita a requisitos del esquema/backend: no certifica ausencia/presencia de pantallas fuera de los api.ts autorizados.

| GitHub / Beads | ¿Sigue siendo preciso? | Edición concreta sugerida / aceptación pendiente |
| --- | --- | --- |
| #28 / OND-8wi | Sí, distinguiendo evidencia remota antigua y fallo local vigente; P1 | Añadir cadena estricta y continuación diagnóstica separadas; inventariar 0007 doble conteo/backfill, comisión mes→jornada y ACL dependiente de defaults. Exigir fresh install y upgrade, no solo ausencia de error de CREATE TRIGGER. |
| #29 / OND-58e | Parcial: 0008 ya expresa el endurecimiento local de producción; P1 | Redactar problema remoto como histórico; ampliar matriz con detalle/envase de despacho, carga/GPS, inactivos y stock directo. Documentar que SELECT reduce alcance de UPDATE. Corregir referencia antigua OND-8ox → OND-58e. |
| #30 / OND-ptq | Sí; P1 | Diferenciar registrar_venta sin grant anon final, crear_despacho invoker y corregir_devolucion definidor protegido por admin. Añadir autor de fila vs actor del log, bypass por INSERT directo, inputs/catálogo activo y pruebas del search_path sin afirmar explotación remota. |
| #31 / OND-3dk | Parcial: falta de triggers es remota, el repositorio sí los tiene; P1 | Título puede ser “Reconciliar y verificar auditoría efectiva de operaciones”. Exigir catálogo antes/después, motivo en corrección (hoy RPC/log no lo modelan), reglas/comisiones/catálogo y rollback de operación fallida. No recrear sin DROP lo ya versionado. |
| #32 / OND-lpu | Sí; inicio sobre ausencia de merma debe ser remoto fechado; P1 | Añadir T3–T7/T12: envases duplicados, devolución parcial+anulación, NEW vs OLD, registro ya anulado y reactivación repetida; descuento/traslado de detalles; la mera presencia del trigger no satisface conservación. |
| #33 / OND-rnd | Sí; P1 | Distinguir registro inicial de RPC corregir_devolucion ya conjunta. Validar agregado por producto, despacho activo, pendiente/carga y atomizar llegada solo después de ratificar su representación. No hay columna de llegada en la cabecera local. |
| #34 / OND-cop | Sí; P1 | Añadir divergencia mes/jornada y bruto/neto entre diseño, migración y tipos; cubrir reglas de límite, solapamiento e inmutabilidad antes de UI. |
| #35 / OND-uoi | Parcial; P2 | Reescribir “comisión sí usa Santiago” como “el diseño bd usa jornada Santiago, la migración aún mes de sesión”; incluir v_bidones que fecha devoluciones por d.creado_en (`supabase/migrations/0003_correcciones_seguridad_ventas.sql:57`), no de.creado_en. |
| #42 / OND-vi4 | Sí; P1 | Añadir bloqueo de padre compartido por devolución/corrección/anulación y orden global entre productos/envases, no solo ordenar un JSON. Backfill 0007 y reactivación también deben ser seguros frente a repetición. No hay evidencia de prueba concurrente aún. |
| #47 / OND-vrn | Sí como plan de medición; counts remotos fechados; P2 | Añadir consulta/candidatos locales y criterio de cobertura; retirar cualquier apariencia de 48 actuales. Medir con roles y datos representativos, incluidos filtros por sucursal/fecha y joins de incidencias. |
| #48 / OND-0lg | Sí, con catálogo remoto pendiente; P2 | Añadir resultado local tres tablas vs mermas ausente, requisito de publicación preexistente y pruebas de recepción/RLS. No cerrar por ALTER PUBLICATION presente. |
| #58 / OND-w76 y OND-w76.1 | Backend pendiente; P1 | Preservar espejo épica+hijo; aceptar sucursal nula admin requiere decisión explícita porque baseline/tipos la prohíben. Desactivar debe bloquear RPC y ramas RLS por identidad. `auth.users`→perfiles CASCADE (`supabase/migrations/0001_init.sql:69`) no elimina ventas: referencias operativas sin cascade pueden impedir eliminar perfil usado. |
| #59 / OND-w76.2 | Backend pendiente; P2 | La vista historial sí está en 0001; redactar “reconciliar y asegurar vista/consulta”, no “crear porque no existe localmente”. Invoker/permisos, paginación y descuentos/anulados deben probarse. |
| #60 / OND-w76.3 | Backend pendiente; P2 | Vista inactivos existe en `supabase/migrations/0001_init.sql:1738`; validar configuración entera, clientes sin compras y día Santiago; esquema no trae evento/tabla de notificación. |
| #61 / OND-w76.4 | Sí; P2 funcional con bloqueos P1 | UI de corrección no basta: añadir inmutabilidad, compensación exacta y motivo explícito, probado con T4–T9/T12 y rol autorizado. |
| #62 / OND-w76.5 | Parcial sobre “vistas no existen”; P2 | Existen en migraciones; revisar catálogo remoto y asegurar invoker antes de exponer/exportar. Cuadre local asigna ventas por vendedor/producto/día, no por despacho específico (`supabase/migrations/0001_init.sql:1663`): con dos despachos del día puede imputar la misma venta a ambos; agregar fixture y decisión de atribución. |
| #63 / OND-w76.6 | Sí; P2 | No habilitar edición de versiones históricas. Añadir restricciones a solapamientos/empates, finitud y parámetro doble/porcentaje según negocio; trazabilidad de reglas ausente en baseline. |
| #64 / OND-w76.7 | Decisión de alcance pendiente; P3 | Modelo GPS almacena histórico y permite lectura global a bodega: asegurar ámbito/retención antes de activar. No hay FK cliente/visita; no presentar GPS como historial de visitas. |
| #65 / OND-w76.8 | Backend pendiente; P2 | Precios históricos se congelan correctamente, pero producto/categoría de empaque siguen siendo mutable sin snapshot para reversión. Probar cambio de tipo_empaque entre movimiento/anulación y rechazar catálogo inactivo en nuevas RPC; no certificar UI. |
| #66 / OND-w76.9 | Sí, pero guarda temporal actual eludible; P2 funcional | BACK-N3 exige servidor que derive ajuste, inmutabilidad de creado_en y payload no confiable; separar cierre de la vulnerabilidad de la futura pantalla. |
| #67 / OND-w76.10 | Sí; P2 funcional | 0010 ya descuenta con lock y rechaza insuficiencia; falta lectura por ámbito y compensación correcta al anular/editar/reactivar. Motivo no vacío y registros ya anulados deben probarse. |
| #68 / OND-w76.11 | Decisión de alcance pendiente; P3 | Columnas y UNIQUE tipo_documento/folio existen (`supabase/migrations/0001_init.sql:195`, `:205`, `:206`); CHECK exige folio si hay tipo pero acepta folio sin tipo/cadenas vacías y no resuelve emisor/ámbito fiscal. No certificar emisión ni incorporar requisitos fiscales sin decisión. |
| #69 / OND-w76.12 | Parcial en evidencia de “no buckets”; P3 | Localmente seed crea bucket privado; políticas amplias ya están en migración. Mantener decisión de alcance y exigir acceso por propietario/sucursal/MIME/tamaño; no activar esas políticas sin revisión. |
| #70 / OND-w76.13 | Backend separado disponible, integración pendiente; P2 | Tabla incidencia con FK producción nullable y descripción validada/auditada desde 0008; no posee sucursal/jornada explícitas. Para incidencia general se infiere ámbito del creador y fecha de creado_en; decidir si suficiente, probar perfiles de misma sucursal y posible cambio de sucursal del creador. No reclasificar merma como incidencia. |

No se recomienda cerrar ninguno de estos issues con solo esta auditoría: sus criterios de despliegue, pruebas REST/concurrencia o funcionalidad aún no están acreditados. S-02 pertenece a #29/OND-58e y S-03 a #30/OND-ptq; OND-8ox corresponde a S-01, que no es propiedad de este worker.

## Límites

- No hubo Supabase MCP/CLI remoto, db push/link, Vercel ni escrituras GitHub/Beads. Las cinco entradas remotas, ACL/advisors, buckets reales, triggers realmente desplegados, datos anónimos y backups no son verificables aquí.
- PostgreSQL temporal 16.14 con Auth/Storage mínimos **no es Supabase local completo** ni PostgreSQL remoto 17.6. Las pruebas certifican SQL de aplicación y predicados en ese entorno, no PostgREST, JWT real, Storage API ni recepción Realtime.
- No se modificaron SQL fuente para hacer pasar la cadena. El replay estricto falló; el estado posterior solo se ensayó tras **DROP de cinco triggers en la base desechable**. No usar su éxito como aceptación de instalación limpia ni como permiso de migración remota.
- Para probar RLS, el fixture concedió DML a authenticated sobre tablas públicas y USAGE auth. Son permisos de prueba explícitos, distintos de ACL del código. Casos de aritmética se ejecutaron como postgres con auth.uid() simulado; T1/T2/T5/T9/T9b sí usaron SET ROLE authenticated según se indica.
- No hubo pruebas de latencia, cargas, dos sesiones concurrentes, desconexión tras commit, pgTAP, PostgreSQL 17 ni datos reales. Deadlocks/carreras y costes de índices se reportan como riesgos, no como efectos observados.
- Se preservaron cambios ajenos en `.opencode/opencode.json` y `.opencode/plugins/`. No se crearon scripts, dumps, capturas ni otros archivos del checkout. El contenedor se retiró al finalizar; no se instalaron paquetes globales.

### Comandos, preparación y salidas del ensayo aislado

Se ejecutó `codegraph explore 'supabase/migrations frontend/src/domains api.ts registrar_venta crear_despacho corregir_devolucion'` antes de búsquedas/lecturas para localizar servicios. Se leyeron migraciones en orden con `nl -ba ...`, se compararon objetos de `bd/*.sql` normalizando comentarios/espacios, y se consultaron snapshots JSON con Python 3 (el alias `python` no existe; se usó `python3`). Todos los UUID de pruebas de abajo son sintéticos.

Contenedor creado sin red, puerto ni volumen:

```bash
docker run -d --name ondina-backend-audit-20261013 --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16
```

Salida: `61733e64572ac9fc396c3c3f58d4c8047085bbf7fa88cd6fcc98bb6fee7ed4c1`. `select version()` devolvió PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1). El bootstrap ejecutado con `docker exec -i ondina-backend-audit-20261013 psql -X -q -v ON_ERROR_STOP=1 -U postgres` fue:

```sql
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,owner uuid,name text);
alter table storage.objects enable row level security;
create table storage.buckets(id text primary key,name text,public boolean);
create publication supabase_realtime;
```

Salida bootstrap exit 0 con `WARNING: wal_level is insufficient to publish logical changes; HINT: Set wal_level to "logical" before creating subscriptions`. Solo se inspeccionó definición de publicación, no emisión de eventos.

El núcleo exacto del replay ejecutado, sin archivos temporales, fue:

```python
import subprocess,pathlib,re
n='ondina-backend-audit-20261013'
def sql(s,one=False):
    return subprocess.run(['docker','exec','-i',n,'psql','-X','-q','-v',
        'ON_ERROR_STOP=1','-U','postgres']+(['-1'] if one else []),
        input=s,text=True,capture_output=True)
files=sorted(pathlib.Path('supabase/migrations').glob('*.sql'))
for f in files:
    p=sql(f.read_text(),not f.name.startswith('0001'))
    print(f.name,'exit',p.returncode,p.stderr.strip() if p.returncode else '')
    if p.returncode: break
# Continuación DIAGNÓSTICA: cambia solamente el catálogo desechable.
f=files[6]
for trigger,table in re.findall(r'create trigger (\w+).*?on (public\.\w+)',
        f.read_text()[:f.read_text().index('-- 5. Reparar')],re.S):
    p=sql(f'drop trigger if exists {trigger} on {table};')
    print('drop',trigger,p.returncode)
for f in files[6:]:
    p=sql(f.read_text(),True)
    print('diagnostic',f.name,'exit',p.returncode,p.stderr.strip() if p.returncode else '')
    if p.returncode: break
```

```text
0001_init.sql ... 0006_bodega_despachos_envases.sql: exit 0 (cada una)
0007_fix_triggers_ventas.sql: exit 3
ERROR: trigger "trg_venta_detalle_insert" for relation "venta_detalles" already exists
DROP diagnóstico de trg_venta_detalle_insert, trg_venta_total_ins,
trg_venta_total_upd, trg_venta_total_del, trg_venta_anular: exit 0 cada uno
diagnostic 0007 / 0008 / 0009 / 0010: exit 0 cada una
24 funciones de aplicación / 31 triggers / 70 políticas / 10 vistas
publicación: incidencias_produccion, producciones, stock_envases
bucket: comprobantes, public=f
ACL RPC: registrar_venta anon=f authenticated=t;
crear_despacho y corregir_devolucion anon=t authenticated=t vía PUBLIC
```

Consulta de cobertura de FK ejecutada por `docker exec ... psql -X -U postgres -P pager=off -c "..."`:

```sql
select c.conrelid::regclass as tabla,c.conname,pg_get_constraintdef(c.oid)
from pg_constraint c
where c.contype='f' and c.connamespace='public'::regnamespace
and not exists(
 select 1 from pg_index i
 where i.indrelid=c.conrelid and i.indisvalid and i.indpred is null
 and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey
)
order by 1,2;
```

Salida: 36 filas; entre ellas perfiles.sucursal_id, productos.tipo_empaque_id, producciones.producto_id/creado_por, incidencias_produccion.produccion_id/creado_por, despacho_envases.tipo_empaque_id, devoluciones_productos.producto_id/creado_por y devoluciones_envases.tipo_empaque_id/creado_por. Este criterio busca cobertura completa al principio, no considera cobertura parcial ni demuestra uso/coste del plan.

### Fixture y comandos SQL de casos sintéticos

Cada entrada de pruebas se pasó por stdin a:

```bash
docker exec -i ondina-backend-audit-20261013 psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres
```

Fixture: dos sucursales A/B, admin A, vendedor A, bodega A, vendedor B e inactivo A; producto agua retornable AUDIT-P, stock 100 por sede, envases 10, carga vendedor A e inactivo 20, dos cabeceras de despacho de dos días. Estos comandos explicitan los permisos adicionales de prueba:

```sql
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
insert into sucursales(id,nombre) values
 ('00000000-0000-0000-0000-000000000001','AUDIT-A'),
 ('00000000-0000-0000-0000-000000000002','AUDIT-B');
insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003'),('10000000-0000-0000-0000-000000000004'),
 ('10000000-0000-0000-0000-000000000005');
insert into perfiles(id,sucursal_id,nombres,apellidos,rol,activo) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','A','A','administrador',true),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','V','A','vendedor',true),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','B','A','bodega',true),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','V','B','vendedor',true),
 ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','I','A','vendedor',false);
insert into tipos_empaque(id,nombre,categoria) values('30000000-0000-0000-0000-000000000001','AUDIT-E','retornable');
insert into productos(id,nombre,tipo,tipo_empaque_id,precio_base) values
 ('20000000-0000-0000-0000-000000000001','AUDIT-P','agua','30000000-0000-0000-0000-000000000001',1000);
insert into clientes(id,sucursal_id,vendedor_id,nombre,direccion,creado_por) values
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','AUDIT-C','X','10000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','AUDIT-I','X','10000000-0000-0000-0000-000000000001');
insert into stock_bodega(sucursal_id,producto_id,cantidad) values
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',100),
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',100);
insert into stock_envases(sucursal_id,tipo_empaque_id,cantidad) values
 ('00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',10),
 ('00000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',10);
insert into carga_vendedor(vendedor_id,producto_id,cantidad) values
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',20),
 ('10000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001',20);
insert into despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por,creado_en) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',now()-interval '2 days'),
 ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',now()-interval '2 days');
```

El siguiente Python expande **las mismas sentencias de las pruebas ejecutadas**, con variables para evitar UUID repetidos. Cada prueba vive en su conexión/transacción y hace ROLLBACK; un error en T9/T10 también revierte al cerrar la conexión.

```python
import subprocess
n='ondina-backend-audit-20261013'
s1='00000000-0000-0000-0000-000000000001';s2='00000000-0000-0000-0000-000000000002'
a='10000000-0000-0000-0000-000000000001';v='10000000-0000-0000-0000-000000000002'
b='10000000-0000-0000-0000-000000000003';inactive='10000000-0000-0000-0000-000000000005'
p='20000000-0000-0000-0000-000000000001';e='30000000-0000-0000-0000-000000000001'
c='40000000-0000-0000-0000-000000000001';ci='40000000-0000-0000-0000-000000000005'
d='50000000-0000-0000-0000-000000000001';d2='50000000-0000-0000-0000-000000000002'
details='[{"producto_id":"'+p+'","cantidad":1,"precio_unitario":1000,"envases_recibidos":0}]'
tests={
 'T1':f"begin;set local role authenticated;set local request.jwt.claim.sub='{inactive}';select registrar_venta('{ci}','efectivo','{details}');reset role;select 'ventas_inactivo='||count(*) from ventas where vendedor_id='{inactive}';rollback;",
 'T2':f"begin;set local role authenticated;set local request.jwt.claim.sub='{b}';insert into despacho_detalles(despacho_id,producto_id,cantidad) values('{d2}','{p}',3);reset role;select 'stock_B='||cantidad from stock_bodega where sucursal_id='{s2}' and producto_id='{p}';rollback;",
 'T3':f"begin;set local request.jwt.claim.sub='{v}';select registrar_venta('{c}','efectivo','{details.replace(chr(34)+'envases_recibidos'+chr(34)+':0',chr(34)+'envases_recibidos'+chr(34)+':2')}');select 'tras_venta='||cantidad from stock_envases where sucursal_id='{s1}' and tipo_empaque_id='{e}';insert into devoluciones_envases(despacho_id,tipo_empaque_id,cantidad,creado_por) values('{d}','{e}',2,'{v}');select 'tras_devolucion='||cantidad from stock_envases where sucursal_id='{s1}' and tipo_empaque_id='{e}';rollback;",
 'T4':f"begin;set local request.jwt.claim.sub='{a}';insert into despacho_detalles(despacho_id,producto_id,cantidad) values('{d}','{p}',10);insert into devoluciones_productos(despacho_id,producto_id,cantidad,creado_por) values('{d}','{p}',4,'{a}');update despachos set anulado=true where id='{d}';select 'bodega_final='||cantidad from stock_bodega where sucursal_id='{s1}' and producto_id='{p}';rollback;",
 'T5':f"begin;set local request.jwt.claim.sub='{a}';insert into despacho_detalles(despacho_id,producto_id,cantidad) values('{d}','{p}',10);set local role authenticated;select corregir_devolucion('{d}','{b}','[{{\"producto_id\":\"{p}\",\"cantidad\":7}},{{\"producto_id\":\"{p}\",\"cantidad\":7}}]','[]');reset role;select 'devuelto='||sum(cantidad)||';actor_suplantado='||bool_and(creado_por='{b}') from devoluciones_productos where despacho_id='{d}' and not anulado;rollback;",
 'T6':f"begin;set local request.jwt.claim.sub='{a}';insert into mermas(sucursal_id,producto_id,cantidad,motivo,creado_por) values('{s1}','{p}',2,'AUDIT','{a}');update mermas set cantidad=20,anulado=true where sucursal_id='{s1}' and producto_id='{p}';select 'stock_tras_anular='||cantidad from stock_bodega where sucursal_id='{s1}' and producto_id='{p}';rollback;",
 'T7':f"begin;set local request.jwt.claim.sub='{a}';insert into producciones(sucursal_id,producto_id,cantidad,anulado,creado_por) values('{s1}','{p}',2,true,'{a}');select 'stock='||cantidad from stock_bodega where sucursal_id='{s1}' and producto_id='{p}';select 'envases='||cantidad from stock_envases where sucursal_id='{s1}' and tipo_empaque_id='{e}';select 'indicadores='||count(*) from v_indicadores_produccion_diarios where sucursal_id='{s1}';rollback;",
 'T8':f"begin;set local request.jwt.claim.sub='{v}';select registrar_venta('{c}','efectivo','{details}');update ventas set descuento=500 where vendedor_id='{v}';select 'descuento='||descuento||';total='||total from ventas where vendedor_id='{v}';rollback;",
 'T9':f"begin;set local role authenticated;set local request.jwt.claim.sub='{b}';update stock_bodega set sucursal_id=(select id from sucursales where nombre='Planta Ondina') where sucursal_id='{s1}' and producto_id='{p}';reset role;select 'stock_transferido='||cantidad from stock_bodega where sucursal_id=(select id from sucursales where nombre='Planta Ondina') and producto_id='{p}';rollback;",
 'T9b':f"begin;set local role authenticated;set local request.jwt.claim.sub='{b}';update stock_bodega set cantidad=777 where sucursal_id='{s1}' and producto_id='{p}';reset role;select 'saldo_directo='||cantidad from stock_bodega where sucursal_id='{s1}' and producto_id='{p}';rollback;begin;set local role authenticated;set local request.jwt.claim.sub='{b}';insert into stock_bodega(sucursal_id,producto_id,cantidad) select id,'{p}',123 from sucursales where nombre='Planta Ondina';reset role;select 'insert_otra_sucursal='||cantidad from stock_bodega where sucursal_id=(select id from sucursales where nombre='Planta Ondina') and producto_id='{p}';rollback;",
 'T10':"select jornada from public.v_comision_vendedor limit 1;",
 'T11':f"begin;set local request.jwt.claim.sub='{v}';select registrar_venta('{c}','efectivo','[{{\"producto_id\":\"{p}\",\"cantidad\":1,\"precio_unitario\":\"NaN\"}}]');select 'total='||total from ventas where vendedor_id='{v}';rollback;",
 'T12':f"begin;set local request.jwt.claim.sub='{a}';insert into mermas(sucursal_id,producto_id,cantidad,motivo,creado_por) values('{s1}','{p}',2,'AUDIT','{a}');update mermas set anulado=true where motivo='AUDIT';update mermas set anulado=false where motivo='AUDIT';update mermas set anulado=true where motivo='AUDIT';select 'stock='||cantidad from stock_bodega where sucursal_id='{s1}' and producto_id='{p}';rollback;"
}
for label,s in tests.items():
    r=subprocess.run(['docker','exec','-i',n,'psql','-X','-q','-A','-t','-v',
        'ON_ERROR_STOP=1','-U','postgres'],input=s,text=True,capture_output=True)
    print(label,'exit',r.returncode,r.stdout.strip(),r.stderr.strip())
```

Salidas observadas (UUID de venta aleatorios omitidos en esta tabla, no tienen significado para la conclusión):

| Caso | Exit | Salida útil |
| --- | --- | --- |
| T1 | 0 | ventas_inactivo=1 |
| T2 | 0 | stock_B=97 |
| T3 | 0 | tras_venta=12; tras_devolucion=14 |
| T4 | 0 | bodega_final=104 |
| T5 | 0 | devuelto=14;actor_suplantado=true |
| T6 | 0 | stock_tras_anular=118 |
| T7 | 0 | stock=102; envases=8; indicadores=0 |
| T8 | 0 | descuento=500.00;total=1000.00 |
| T9 | 3 | ERROR: new row violates row-level security policy for table "stock_bodega" |
| T9b | 0 | saldo_directo=777; insert_otra_sucursal=123 |
| T10 | 3 | ERROR: column "jornada" does not exist |
| T11 | 0 | total=NaN |
| T12 | 0 | stock=102 |

Retirada y comprobación final del contenedor:

```bash
docker rm -f ondina-backend-audit-20261013
docker ps -a --filter name=ondina-backend-audit-20261013 --format '{{.Names}}'
```

Salida de `docker rm -f`: `ondina-backend-audit-20261013` (exit 0). La comprobación `docker ps -a` no devolvió nombres (exit 0): el contenedor ya no existe.
