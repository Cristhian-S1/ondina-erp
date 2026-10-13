# Revisión independiente del backend — ola B (R1)

- **Tarea Beads:** OND-5gi.9
- **GitHub:** #27, #29, #30, #31, #32, #33, #42, #71
- **Base revisada:** `integration/post-migracion` @ `3bf28a8` (develop + frontend B3)
- **Modo:** solo lectura. No se modificó código, SQL ni documentación distinta de este archivo. No se ejecutó SQL, no hubo acceso remoto a Supabase y no se levantó stack local.
- **Revisor:** worker Orca (`task_ca16d49ba128`, `ctx_5f55ea40ff0f`), Claude Haiku 5.5.
- **Fecha:** 2026-10-13

Índice de referencias: [auditoría profunda](../auditoria-profunda-2026-10-13.md), [revisión de seguridad previa](seguridad-revision.md), [validación B3](../../../../../supabase/validation-b3.md), [reconciliación](../../../../../supabase/reconciliation.md).

## Resumen ejecutivo

No encontré una fuga de datos alcanzable por la API ni una ruta de anulación que duplique compensación con los grants actuales. Los controles principales (anon, `search_path`, identidad activa, reactivación, stock no negativo, idempotencia) están verificados con evidencia. Los hallazgos que requieren acción son: (a) la anulación de despacho no concilia mermas vinculadas (RB-1, latente), (b) dos decisiones de negocio abiertas (precio libre en ventas y atribución del cuadre, RB-2 y RB-3), y (c) tres riesgos de aplicación remota que deben resolverse con preflight antes de cualquier `db push` (RB-4, RB-5, RB-6).

## Alcance y método

- Migraciones: `20261013000100_align_repo_design.sql`, `20261013181647_harden_database_security.sql`, `20261013184049_b3_data_integrity.sql`. Se leyeron completas.
- Contexto: `20261013000000_remote_baseline.sql` (triggers, CHECK y políticas previas).
- Pruebas: `supabase/tests/001`, `002` y `003` revisadas por sus aserciones de privilegios y de escenarios, no ejecutadas.
- Documentación: `supabase/reconciliation.md` (secciones de validación de montos, aplicación remota y compuertas B3), `supabase/validation-b3.md`.
- Frontend: diff de `2722944` (19 archivos), además de `RegistrarVenta.tsx`, `Gastos.tsx`, `RegistrarCliente.tsx` y `Login.tsx` solo para el punto de mensajes de error.
- Comprobaciones estáticas: búsquedas de `GRANT`, `CREATE TRIGGER`, `CHECK`, `greatest(`, `errcode`, `SECURITY DEFINER` (escaneo de cabeceras de todas las migraciones) y de los `from()`/`rpc()` del frontend.

**Límites:** no se reejecutaron pgTAP, `concurrency-b3.py` ni `rehearse-upgrade.sh`; los resultados citados en `validation-b3.md` se toman como evidencia documentada, no como verificación independiente. No se revisaron en detalle los esquemas `storage` y `realtime`, ni `auth.users`, ni `compare-schema.py`.

## Tabla de hallazgos

| ID | Severidad | Estado | Área | Resumen | Issue |
| --- | --- | --- | --- | --- | --- |
| RB-1 | Medio | Latente | Stock | Anulación de despacho no descuenta mermas vinculadas; la merma posterior no comprueba despacho anulado | #32 |
| RB-2 | Medio | Conocido (BD-14) | Reportes | `v_cuadre_despacho` atribuye ventas por vendedor/producto/día | #62 (fuera de alcance) |
| RB-3 | Medio | Decisión pendiente | Ventas | `precio_unitario` lo fija el cliente; no se contrasta con el catálogo | #42 / #71 |
| RB-4 | Alto (si hay solapes) | Remoto | Migración | `EXCLUDE` de `reglas_comision` valida al aplicarse y aborta con datos solapados | #31 / #42 |
| RB-5 | Medio | Remoto | Migración | `auditoria_accion_check` sin `NOT VALID`: escaneo bajo bloqueo exclusivo | #31 |
| RB-6 | Medio | Remoto | Migración | Índices sin `CONCURRENTLY` sobre ventas, despachos y auditoría | #31 |
| RB-7 | Bajo | Verificar | Migración | Atomicidad de `DROP POLICY` masivo si el runner no es transaccional | #29 |
| RB-8 | Bajo | Vigente | Concurrencia | Bloqueo por sucursal serializa todas las escrituras de stock | #42 |
| RB-9 | Bajo | Latente | Ventas | Línea insertada en venta anulada sin error | #42 |
| RB-10 | Bajo | Decisión | Stock | Devolución de envases sin tope ni trazabilidad hacia ventas | #33 |
| RB-11 | Bajo | Vigente | Frontend | Corrección de devolución sin clave de reintento | #33 / #42 |
| RB-12 | Bajo | Vigente | Frontend | Fallback `?? crypto.randomUUID()` pierde idempotencia en silencio | #42 |
| RB-13 | Bajo | Vigente | Frontend | Dos mensajes del allow-list nunca se muestran (errcode 42501) | #30 |
| RB-14 | Bajo | Vigente | Frontend | Varias pantallas muestran `err.message` sin pasar por el allow-list | #30 |
| RB-15 | Bajo | Vigente | RLS | Bodega ve `rut` y `telefono` de vendedores de su sucursal | #29 |
| RB-16 | Bajo | Vigente | RLS | Admin de sucursal puede asignar cliente a vendedor de otra sucursal | #29 |
| RB-17 | Informativo | Vigente | Grants | Helpers `SECURITY DEFINER` ejecutables por `authenticated` | #30 |
| RB-18 | Informativo | No reproducido | Ventas | `p_descuento` nulo se normaliza a 0 sin error | #71 |
| RB-19 | Informativo | Vigente | Reportes | `v_ranking_vendedores` cambia su total de bruto a neto de descuento sin nota | — |

## Detalle de hallazgos

### RB-1 (Medio, latente) — La anulación de despacho no concilia mermas vinculadas

- **Evidencia:**
  - `supabase/migrations/20261013184049_b3_data_integrity.sql:231` calcula lo pendiente como `despachado − devuelto`. No resta mermas.
  - `:467-471` (`trg_merma_insert`): una merma vinculada a despacho ya resta la carga del vendedor. Al anular el despacho, esa pérdida se vuelve a tratar como pendiente de devolver.
  - `:547-564` (`trg_merma_anular`): no comprueba `d.anulado`, a diferencia de `:186` y `:216`. Si el despacho ya está anulado, anular la merma suma la carga por segunda vez.
  - Alcanzabilidad: `despachos` no tiene `GRANT UPDATE` ni política de update (`181647:41-44`, `:820-833`). La anulación solo ocurre con `service_role` o SQL directo. Por eso es latente.
  - Cobertura: `003_integrity.test.sql` prueba anulación parcial y anulación con venta, pero no con merma vinculada.
- **Escenario:** despacho de 10 u., merma vinculada de 2 u. (carga 8). Otro despacho del mismo producto deja carga total 13. Al anular: bodega +10 y carga −10, así que la carga queda en 3. Las 2 u. perdidas se devuelven al almacén y la merma sigue activa. El total del sistema no crece, pero 2 u. se reasignan de la carga de otro despacho a bodega. Si la carga no alcanza, `saldo_no_negativo` aborta la operación (comportamiento seguro).
- **Sugerencia:** calcular lo pendiente como `despachado − devuelto − mermas vinculadas activas`, y que `trg_merma_anular` retorne sin compensar cuando `d.anulado`. Añadir una prueba pgTAP con merma vinculada y anulación.

### RB-2 (Medio, conocido) — Cuadre atribuye ventas por vendedor/producto/día

- **Evidencia:** `20261013184049_b3_data_integrity.sql:893-928` (join de `:914-917`). El mismo patrón está en `20261013000100_align_repo_design.sql:190-225`. `supabase/validation-b3.md:145-149` lo declara como BD-14 / #62 abierto.
- **Escenario:** dos despachos del mismo vendedor, producto y día comparten el total vendido; la `diferencia` de cada uno queda mal calculada.
- **Sugerencia:** decisión de negocio sobre la atribución venta→despacho. No se corrige en este worker. Mientras tanto, no presentar `diferencia` como conciliada en la UI.

### RB-3 (Medio, decisión de negocio) — El precio de venta lo fija el cliente

- **Evidencia:**
  - `20261013184049_b3_data_integrity.sql:642` lee `precio_unitario` del JSON. `:651-659` solo valida finitud y `≥ 0`. No compara con `productos.precio_base`.
  - `frontend/src/domains/ventas/hooks/useRegistrarVenta.ts:21` envía el precio del formulario.
  - `v_comision_vendedor` (`:845-859`) calcula la base con `subtotal`, así que el precio influye en la comisión.
- **Escenario:** un vendedor registra ventas a precio 0 o con precio arbitrario dentro de su RLS; la base de comisión y el total quedan a su criterio.
- **Sugerencia:** confirmar si el precio libre es diseño. Si no lo es, validar contra el catálogo o exigir motivo cuando el precio difiere. Pendiente de decisión.

### RB-4 (Alto si hay solapes, bloqueante de despliegue) — `EXCLUDE` de comisiones valida al aplicar

- **Evidencia:** `20261013184049_b3_data_integrity.sql:814` crea `btree_gist` y `:815-816` agrega `EXCLUDE` sin `NOT VALID`. PostgreSQL valida las filas existentes en el momento. `supabase/reconciliation.md` (compuertas B3) reconoce que la migración aborta con solapes legacy.
- **Riesgo:** si producción tiene reglas solapadas, la migración falla. No es una fuga, pero bloquea el despliegue, y si el runner no es transaccional deja un estado parcial (ver RB-7).
- **Preflight sugerido** (ejecutar en la restauración del backup, no en producción directamente):

```sql
select a.id as regla_a, b.id as regla_b
from public.reglas_comision a
join public.reglas_comision b
  on a.id < b.id
 and a.tipo_producto = b.tipo_producto
 and tstzrange(a.vigente_desde, a.vigente_hasta, '[)')
     && tstzrange(b.vigente_desde, b.vigente_hasta, '[)');
```

- **Sugerencia:** el resultado debe ser cero filas antes de la aprobación de release. Si no lo es, resolver con decisión de negocio. Mantener la compuerta descrita en `reconciliation.md`.

### RB-5 (Medio, remoto) — `auditoria_accion_check` sin `NOT VALID`

- **Evidencia:** `20261013184049_b3_data_integrity.sql:105-106` elimina y vuelve a crear el `CHECK` sobre `auditoria` sin `NOT VALID`. Eso escanea toda la tabla bajo `ACCESS EXCLUSIVE`, bloqueando lecturas y escrituras. `auditoria` crece con cada escritura de negocio, porque los triggers `:107-116` insertan en ella.
- **Sugerencia:** `add constraint ... check (...) not valid;` y luego `validate constraint` en una ventana aparte. `VALIDATE` toma un bloqueo mucho más débil, pero aun así escanea.

### RB-6 (Medio, remoto) — Índices sin `CONCURRENTLY`

- **Evidencia:** `20261013000100_align_repo_design.sql:310-330` crea índices sobre `ventas`, `venta_detalles`, `despachos`, `despacho_detalles`, `devoluciones_*`, `mermas`, `producciones` y `auditoria`. `20261013184049_b3_data_integrity.sql:11-12` crea índices únicos parciales sobre `ventas` y `despachos`. Ninguno usa `CONCURRENTLY`, que no puede ejecutarse dentro de una transacción de migración. Un build normal toma `SHARE` y bloquea escrituras durante la construcción.
- **Riesgo:** proporcional al volumen de cada tabla. El repositorio no contiene medición de tamaños.
- **Sugerencia:** medir volumen en la restauración. Si las tablas son grandes, crear índices fuera de la migración con `CONCURRENTLY` o confirmar la ventana de escritura prevista en `reconciliation.md`.

### RB-7 (Bajo, verificar) — Atomicidad de la reconstrucción de políticas

- **Evidencia:** `20261013181647_harden_database_security.sql:41-44` elimina todas las políticas de `public` y `:816-822` revoca todos los grants. Si el runner de migraciones no ejecuta cada archivo en una sola transacción, un fallo entre el `DROP POLICY` y el `CREATE POLICY` deja tablas con RLS y sin políticas.
- **Efecto:** fail-closed (corte de servicio, no fuga).
- **Sugerencia:** confirmar en el procedimiento de `db push` que cada archivo es transaccional, y que el rehearsal reproduce el mismo comportamiento.

### RB-8 (Bajo) — Bloqueo por sucursal serializa todas las escrituras de stock

- **Evidencia:** `20261013184049_b3_data_integrity.sql:29-36` (`bloquear_saldos`) bloquea todas las filas de `stock_bodega` y `stock_envases` de la sucursal, y la carga del vendedor, en cada movimiento. `:991-998` toma `SHARE` sobre `reglas_comision` en cada `INSERT` de ventas.
- **Orden de bloqueo (verificado):** en todos los caminos revisados el padre se bloquea antes que los saldos: `:124-126` (ventas), `:164-168` y `:198-202` (devoluciones), `:214-217` y `:228` (anulación), `:269-277` (detalle de despacho), `:364` (producciones), `:430-433` (mermas). No encontré un deadlock estático.
- **Impacto:** ventas, despachos y devoluciones de una misma sucursal se serializan.
- **Sugerencia:** medir la contención con el script de concurrencia. Si aparece, considerar bloqueo por fila ordenado en lugar de por sucursal.

### RB-9 (Bajo, latente) — Línea insertada en venta anulada sin error

- **Evidencia:** `20261013184049_b3_data_integrity.sql:125`: `if v.anulado then return new; end if;` no lanza error. No es alcanzable por la API, porque `venta_detalles` no tiene `GRANT INSERT` (`181647:831-833`).
- **Sugerencia:** lanzar `'La venta está anulada'`, que ya está en el allow-list (`frontend/src/lib/errors.ts:52`).

### RB-10 (Bajo, decisión) — Devolución de envases sin tope ni trazabilidad

- **Evidencia:** `20261013184049_b3_data_integrity.sql:746-766` (`insertar_devolucion`), comentario en `:761`. `trg_devolucion_envase_insert` (`:193-209`) suma a `stock_envases` sin relacionar la devolución con un despacho ni con una venta.
- **Riesgo:** el abuso requiere rol bodega o admin en su sucursal. El diseño está declarado en el comentario, pero no hay conciliación entre envases recibidos en ventas y envases devueltos.
- **Sugerencia:** conciliación periódica (recibidos vs devueltos). Registrarla como riesgo de negocio.

### RB-11 (Bajo) — Corrección de devolución sin clave de reintento

- **Evidencia:** `frontend/src/domains/bodega/pages/Devoluciones.tsx:339-348` ejecuta `corregirDevolucion` sin clave. `frontend/src/domains/bodega/api.ts:218-234` tampoco la envía. La firma SQL `20261013184049_b3_data_integrity.sql:791-811` no tiene `p_idempotency_key`.
- **Escenario:** un reintento tras un fallo de red ejecuta una segunda corrección. El estado final coincide, porque la primera se anula y se reinserta, pero se duplica la auditoría.
- **Sugerencia:** aceptar clave y reutilizar el patrón de `solicitudes_devolucion`, o documentarlo como excepción junto a los llamadores legacy de `validation-b3.md`.

### RB-12 (Bajo) — Fallback que pierde idempotencia en silencio

- **Evidencia:** `frontend/src/domains/ventas/api.ts:191` y `frontend/src/domains/bodega/api.ts:197`, `:214`, `:244` usan `?? crypto.randomUUID()`. Si el llamador no pasa la clave, cada llamada obtiene una nueva.
- **Impacto actual:** nulo, porque solo los hooks llaman estas funciones y siempre pasan clave.
- **Sugerencia:** exigir la clave en el tipo del adaptador en lugar de generarla.

### RB-13 (Bajo) — Dos mensajes del allow-list nunca se muestran

- **Evidencia:** `frontend/src/lib/errors.ts:15` y `:36` mapean `'No tienes permisos para modificar este despacho.'` y `'No tienes permisos para registrar devoluciones.'`. El SQL los lanza con `errcode='42501'` (`20261013184049_b3_data_integrity.sql:166`, `:200`, `:274`, `:323`). `mensajeErrorSupabase` consulta primero el código (`errors.ts:7`, `:107-109`), así que el usuario ve `'No tienes permisos para realizar esta acción.'`.
- **Sugerencia:** eliminar esas entradas, o cambiar el SQL a `P0001` si se quiere el texto específico. Es una decisión de contrato de errores (B2).

### RB-14 (Bajo) — Errores crudos mostrados en páginas

- **Evidencia:**
  - `frontend/src/domains/ventas/pages/RegistrarVenta.tsx:253` y `:593` muestran `err.message`.
  - `frontend/src/domains/ventas/pages/Gastos.tsx:48` y `RegistrarCliente.tsx:89` muestran `err.message`.
  - `frontend/src/pages/Login.tsx:26` muestra el mensaje de Supabase Auth.
- **Alcance real:** en el flujo de venta, el caso alcanzable es `new Error('No hay sesión activa')` (`useRegistrarVenta.ts:36`), un texto fijo y no sensible. `Login` no pasa por el allow-list. Estas páginas están fuera del diff de `2722944`, salvo `RegistrarVenta`.
- **Sugerencia:** pasar cualquier error por `mensajeErrorSupabase` o usar texto fijo.

### RB-15 (Bajo) — Datos personales de vendedores visibles a bodega

- **Evidencia:** `20261013181647_harden_database_security.sql:47` permite a bodega leer perfiles de vendedores de su sucursal. `:824` concede `SELECT` sobre la tabla completa. La tabla incluye `rut` y `telefono` (`20261013000000_remote_baseline.sql:1176-1177`).
- **Sugerencia:** vista o `GRANT` por columna sin `rut` ni `telefono` para bodega.

### RB-16 (Bajo) — Admin de sucursal puede asignar cliente a vendedor de otra sucursal

- **Evidencia:** `20261013181647_harden_database_security.sql:70-71`: el `WITH CHECK` no verifica que `vendedor_id` pertenezca a `sucursal_id`.
- **Efecto:** `registrar_venta` rechaza la venta (`20261013184049_b3_data_integrity.sql:623-626`, vendedor fuera de la sucursal del cliente). El impacto es de consistencia de datos, no de fuga ni de venta indebida.
- **Sugerencia:** `with check` adicional con `exists (select 1 from public.perfiles p where p.id = vendedor_id and p.rol = 'vendedor' and p.activo and p.sucursal_id = clientes.sucursal_id)`.

### RB-17 (Informativo) — Helpers `SECURITY DEFINER` ejecutables por `authenticated`

- **Evidencia:** `20261013181647_harden_database_security.sql:843-844` y `20261013184049_b3_data_integrity.sql:888` conceden `EXECUTE` sobre `private.es_rol(text)`, `private.mi_sucursal()`, `private.es_admin_global()`, `private.perfil_activo()` y `private.perfil_en_ambito(uuid)`.
- **Efecto:** `perfil_en_ambito` responde si un UUID pertenece a la propia sucursal, documentado en `181647:31-32`. No encontré fuga entre sucursales. Los UUID no son adivinables.

### RB-18 (Informativo, no reproducido) — `p_descuento` nulo se trata como 0

- **Evidencia:** `20261013184049_b3_data_integrity.sql:634` usa `coalesce(p_descuento, 0)`. El guard de `NaN`/`Infinity` (`:596`) solo se activa si el valor llega como cadena, porque JSON no codifica `NaN`.
- **Frontend:** `frontend/src/lib/format.ts:18-24` (`parseMiles`) nunca devuelve `NaN`, y el esquema usa `z.number()` (`ventas/schemas.ts:65`). La UI no alcanza este caso.
- **Estado:** no reproducido en Postgres.

### RB-19 (Informativo) — Cambio de significado en `v_ranking_vendedores`

- **Evidencia:** `20261013181647_harden_database_security.sql:767-779` sumaba `cantidad × precio` por línea (bruto). `20261013184049_b3_data_integrity.sql:861-867` suma `v.total`, que descuenta el descuento de cabecera.
- **Efecto:** la columna `total_vendido` cambia de significado sin nota en la migración. Es un tema de reporte, no de seguridad.

## Controles verificados (sin hallazgo)

- **Anon:** sin `USAGE` de esquema y sin `GRANT` sobre tablas, vistas, secuencias ni funciones de `public` y `private` (`181647:816-822`). `supabase/tests/002_security.test.sql:71-72` lo afirma.
- **`SECURITY DEFINER` sin `search_path`:** escaneo de las cabeceras de todas las migraciones, sin hallazgos. Todas las funciones definer fijan `set search_path = ''` y usan nombres calificados.
- **Perfil inactivo:** `private.es_rol` y `private.mi_sucursal` filtran `activo` (`181647:5-13`). Las políticas revisadas pasan por ellos o por `perfil_activo`.
- **Autoría:** `creado_por` y `despachador_id` se fuerzan en las políticas (`181647:70`, `:79`, `:98`, `:116`, `:128`, `:134`) y en las RPC (`crear_despacho`, `20261013184049_b3_data_integrity.sql:699-701`; `corregir_devolucion`, `:797`; `registrar_venta` usa `auth.uid()`).
- **Doble compensación:** los triggers de anulación son `AFTER UPDATE OF anulado ... WHEN (new.anulado AND NOT old.anulado)` (baseline `:1617`, `:1633`, `:1641`, `:1649`, `:1657`). Además, los triggers de devolución retornan si el despacho ya está anulado (`B3:186`, `:216`). La anulación de despacho corre después de los triggers hijos, así que estos ven el padre ya anulado.
- **Reactivación:** `proteger_movimiento` la bloquea (`B3:57-59`) y `003_integrity.test.sql:49` lo prueba.
- **Stock negativo:** `CHECK` de baseline en `carga_vendedor`, `stock_bodega`, `stock_envases` y `venta_detalles` (`:1003`, `:1244`, `:1256`, `:1323`), más `saldo_no_negativo` (`B3:39-48`). No quedan clamps `greatest(...)` en rutas de stock: las únicas ocurrencias son el total de venta y la base de comisión.
- **Devoluciones acumulativas:** `B3:169-172` suma las devoluciones vigentes con el padre bloqueado (`:164`). Corrige la validación por línea de `181647:605-620`, que permitía duplicar productos.
- **Idempotencia:** claves únicas `ventas_idempotency_b3` (`B3:11`), `despachos_idempotency_b3` (`:12`) y `solicitudes_devolucion` (`:18-25`). La búsqueda se acota a `creado_por` y sucursal. Una colisión entre usuarios devuelve un error genérico y no revela datos (`:587`, `:693`, `:779`). Hay advisory lock por clave (`:584`, `:690`, `:775`).
- **Finitud de importes:** los ocho `CHECK` `_finito_b2` son `NOT VALID` (`181647:783-805`) y aplican a filas nuevas y actualizadas. `registrar_venta` rechaza `NaN` e infinitos (`B3:596`, `:651`).
- **Autenticación en el frontend:** `mensajeErrorSupabase` solo devuelve texto del allow-list o el mensaje genérico (`errors.ts:103-119`).
- **Ciclo de clave en el frontend (ventas, despachos y devoluciones):** clave nueva tras éxito; misma clave tras error mientras el contenido no cambie. Ventas: `useRegistrarVenta.ts:38-48`. Despachos: `Despachos.tsx:298-309`. Devoluciones: `Devoluciones.tsx:360-362`. Un doble clic comparte clave y el advisory lock devuelve el mismo id.
- **Orden de despliegue:** B3 mantiene las firmas antiguas con parámetros por defecto (`DEFAULT NULL`), así que el frontend antiguo sigue funcionando con el SQL nuevo. El frontend nuevo requiere el SQL primero, como indica `reconciliation.md`. Ese orden es el correcto.
- **Publicación Realtime:** `000100:298-307` añade tres tablas protegidas por RLS. No encontré grants a `anon`.

## Preflight y orden remoto

1. Preflight de solapes de comisiones (consulta de RB-4). Debe devolver cero filas.
2. Medir el volumen de `ventas`, `venta_detalles`, `auditoria` y `despachos` en la restauración (RB-5, RB-6).
3. Confirmar la transaccionalidad del runner (RB-7).
4. Orden: SQL antes que frontend, como ya documenta `reconciliation.md`.
5. Refrescar el caché del esquema de PostgREST tras aplicar (ya incluido en `B3:1058`).

## Qué quedó fuera

- No se ejecutaron pgTAP, `concurrency-b3.py` ni `rehearse-upgrade.sh`.
- No se revisó el comportamiento real de RLS con JWT en Supabase, ni Storage, ni Realtime en producción.
- No se revisaron en detalle `compare-schema.py` ni `rehearse-upgrade.sh`.
- No se propusieron cambios de código ni de SQL; cada sugerencia queda para su worker u owner.
