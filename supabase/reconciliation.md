# Schema reconciliation — 2026-10-13

## Authority and scope

This is B1 / OND-5gi.5, GitHub #28 and the SQL-execution foundation of #40, addressing BD-01..BD-03 and BACK-N8/N14. The coordinator supplied a read-only production dump and its migration ledger; this work never connected to that project. Production is also used by develop, so a branch name is not an isolation boundary.

The active imperative chain has four versions:

1. `20261013000000_remote_baseline.sql`: the supplied remote schema, including its `private` helpers, extensions, owners, RLS and grants. It already replays against a fresh CLI-created Supabase database. No SQL statements were removed; LF normalization, provenance comments and one explicit anon ACL reset were added. The reset removes CLI bootstrap default view privileges from `v_indicadores_produccion_diarios` to reproduce the supplied snapshot, which grants that view only to authenticated/service_role. No existing remote ACL is hardened by this baseline-only replay correction. Supabase creates Auth, Storage, platform roles and the `supabase_realtime` publication before application migrations. The baseline contains no production rows or credentials.
2. `20261013000100_align_repo_design.sql`: missing historical objects and four production-policy replacements, with no DML/backfill. Existing installations skip the baseline through explicit ledger repair and execute only this delta and later reviewed migrations.

3. `20261013181647_harden_database_security.sql`: B2 / OND-5gi.6, GitHub #27/#29/#30/#71. Hardens all public view security, application ACLs/defaults, active-profile/branch RLS, existing RPC authorization, dispatch deadlines and finite-money checks. No historical data is changed; RPC signatures and view columns stay stable. See the B2 section below and [B2 validation](validation-b2.md).

4. `20261013184049_b3_data_integrity.sql`: B3 / OND-5gi.7, GitHub #31/#32/#33/#34/#35/#42/#70. Adds coherent OLD-value stock reversal, complete business/balance audit bindings, atomic aggregated returns and correction reasons, optional retry keys, historical nonoverlapping commission rules and Santiago business dates. Enables descriptive incidents under the existing role/branch model with explicit branch metadata for new rows. See [B3 validation](validation-b3.md) and [business decisions](../docs/engineering/database.md#b3-business-decisions--2026-10-13).

The five production ledger versions supplied by the coordinator are `20260806024044`, `20260806024400`, `20260806232318`, `20260806232340`, `20260817034401`. None is the repository's old 0001..0010 sequence. Those ten files are archived unchanged in [legacy-migrations](legacy-migrations/README.md); they must never run as an installation or update chain.

The accompanying role dump contains only platform-role settings/grants (timeouts and a logging parameter grant). It is evidence, not an application migration; local platform roles remain CLI-owned. No Storage buckets or Realtime tables were present in the supplied remote inventory. Remote security vulnerabilities are faithfully represented in the baseline and hardened by B2; B3 addresses the stock, return, commission and calendar defects described below. Historical-data reconciliation and authorized remote application remain pending.

## B1 object decisions

This dated matrix describes the baseline-to-B1 delta only. The B2 section supersedes its security/grant decisions; table/column names, signatures and historical data remain preserved.

“Kept” means the supplied baseline definition wins, including its constraints, column types, owner and ACL, even when legacy differs. “Added” includes replacing a named policy to restore the legacy intent. Every other existing object remains unchanged. New views are security invoker, anonymous access is revoked, and authenticated access is SELECT-only; new trigger helpers use an empty search path and have PUBLIC/anon/authenticated execution revoked. These are protections for newly introduced objects, not B2-wide hardening.

### Tables and columns

All 23 tables and their existing PK, unique, check and FK constraints are kept. No table, column, row, identity or relationship is removed or renamed. Named secondary indexes are inventoried separately below.

| Object | Remote | Legacy / design | Decision |
| --- | --- | --- | --- |
| `public.auditoria` | Present | Present | Kept unchanged |
| `public.carga_vendedor` | Present | Present | Kept unchanged |
| `public.clientes` | Present | Present | Kept unchanged |
| `public.configuracion` | Present | Present | Kept unchanged |
| `public.despacho_detalles` | Present | Present | Kept unchanged |
| `public.despacho_envases` | Present | Present | Kept unchanged |
| `public.despachos` | Present | Present | Kept unchanged |
| `public.devoluciones_envases` | Present | Present | Kept unchanged |
| `public.devoluciones_productos` | Present | Present | Kept unchanged |
| `public.gastos_extras` | Present | Present | Kept unchanged |
| `public.incidencias_produccion` | Present | 0008 adds trimmed description length 1..1000 | Kept columns; added named CHECK as NOT VALID (existing rows retained; new/updated rows checked) |
| `public.mermas` | Present | Present | Kept unchanged |
| `public.perfiles` | Present | 0001 requires a sucursal | Kept nullable sucursal_id; preserves global administrators and existing composite FKs |
| `public.producciones` | Present | Present | Kept unchanged |
| `public.productos` | Present | Present | Kept unchanged |
| `public.reglas_comision` | Present | Present | Kept unchanged |
| `public.stock_bodega` | Present | Present | Kept unchanged |
| `public.stock_envases` | Present | Present | Kept unchanged |
| `public.sucursales` | Present | Present | Kept unchanged |
| `public.tipos_empaque` | Present | Present | Kept unchanged |
| `public.ubicaciones_vendedores` | Present | Present | Kept unchanged |
| `public.venta_detalles` | Present | Present | Kept unchanged |
| `public.ventas` | Present | Present | Kept unchanged |

### Views

The current frontend calls three baseline views, and all are retained: commissions use `jornada`, ranking uses `mes`, and production indicators use Santiago dates. The generated TypeScript snapshot still describes commission `mes`; it is stale evidence, not authority to break the live `jornada` query. No frontend files are changed in B1.

| Object | Remote | Legacy / design | Decision |
| --- | --- | --- | --- |
| `public.v_bidones_vacios_vendedor` | Present | Present | Kept remote definition |
| `public.v_comision_vendedor` | Present | 0001 defines monthly mes; bd/vistas.sql defines daily jornada | Kept remote definition and jornada contract |
| `public.v_indicadores_produccion_diarios` | Present | Present | Kept remote definition |
| `public.v_ranking_vendedores` | Present | Present | Kept remote definition |
| `public.v_stock_actual` | Absent | Present in 0001 / bd/vistas.sql | Added, security invoker + authenticated SELECT |
| `public.v_cuadre_despacho` | Absent | Present in 0001 / bd/vistas.sql | Added, security invoker + authenticated SELECT |
| `public.v_ventas_diarias` | Absent | Present in 0001 / bd/vistas.sql | Added, security invoker + authenticated SELECT |
| `public.v_clientes_inactivos` | Absent | Present in 0001 / bd/vistas.sql | Added, security invoker + authenticated SELECT |
| `public.v_historial_cliente` | Absent | Present in 0001 / bd/vistas.sql | Added, security invoker + authenticated SELECT |
| `public.v_ventas_producto` | Absent | Present in 0001 / bd/vistas.sql | Added, security invoker + authenticated SELECT |

### Functions

Function signatures and current RPC arguments stay unchanged. No 0007 sales replacement or stock backfill is ported. `fn_auditoria_simple` is already present and remains unchanged; only its missing trigger bindings are installed.

| Object | Remote | Legacy / design | Decision |
| --- | --- | --- | --- |
| `private.es_rol` | Present | Present | Kept unchanged |
| `private.mi_sucursal` | Present | Present | Kept unchanged |
| `public.corregir_devolucion` | Present | Present | Kept unchanged |
| `public.crear_despacho` | Present | Present | Kept unchanged |
| `public.es_rol` | Present | Present | Kept unchanged |
| `public.fn_auditoria_simple` | Present | Present | Kept unchanged |
| `public.mi_sucursal` | Present | Present | Kept unchanged |
| `public.registrar_venta` | Present | Present | Kept unchanged |
| `public.rls_auto_enable` | Present | Platform-generated, absent from application legacy | Kept unchanged |
| `public.trg_despacho_anular` | Present | Present | Kept unchanged |
| `public.trg_despacho_detalle_insert` | Present | Present | Kept unchanged |
| `public.trg_despacho_envase_insert` | Present | Present | Kept unchanged |
| `public.trg_devolucion_envase_anular` | Present | Present | Kept unchanged |
| `public.trg_devolucion_envase_insert` | Present | Present | Kept unchanged |
| `public.trg_devolucion_producto_anular` | Present | Present | Kept unchanged |
| `public.trg_devolucion_producto_insert` | Present | Present | Kept unchanged |
| `public.trg_merma_insert` | Present | Present | Kept unchanged |
| `public.trg_produccion_anular` | Present | Present | Kept unchanged |
| `public.trg_produccion_insert` | Present | Present | Kept unchanged |
| `public.trg_venta_anular` | Present | Present | Kept unchanged |
| `public.trg_venta_detalle_insert` | Present | Present | Kept unchanged |
| `public.trg_venta_recalcular_total` | Present | Present | Kept unchanged |
| `public.fn_sello_modificacion` | Absent | Present in 0001 | Added with empty search_path; no client EXECUTE |
| `public.fn_auditoria` | Absent | Present in 0001 | Added with empty search_path; no client EXECUTE |
| `public.trg_merma_anular` | Absent | Present in 0001 | Added with empty search_path; no client EXECUTE |

### Triggers

Bindings are unique by table/name and created after `DROP TRIGGER IF EXISTS`. Existing stock and sale triggers are retained. All new audit records are prospective: no synthetic reconstruction of production audit history occurs. Locations use bigint IDs and intentionally have no UUID audit binding.

| Object | Remote | Legacy / design | Decision |
| --- | --- | --- | --- |
| `despacho_envases.trg_audit_despacho_envases` | Present | Present | Kept unchanged |
| `despachos.trg_despacho_anular` | Present | Present | Kept unchanged |
| `despacho_detalles.trg_despacho_detalle_insert` | Present | Present | Kept unchanged |
| `despacho_envases.trg_despacho_envase_insert` | Present | Present | Kept unchanged |
| `devoluciones_envases.trg_devolucion_envase` | Present | Present | Kept unchanged |
| `devoluciones_envases.trg_devolucion_envase_anular` | Present | Present | Kept unchanged |
| `devoluciones_productos.trg_devolucion_producto` | Present | Present | Kept unchanged |
| `devoluciones_productos.trg_devolucion_producto_anular` | Present | Present | Kept unchanged |
| `mermas.trg_merma_insert` | Present | Present | Kept unchanged |
| `producciones.trg_produccion_anular` | Present | Present | Kept unchanged |
| `producciones.trg_produccion_insert` | Present | Present | Kept unchanged |
| `ventas.trg_venta_anular` | Present | Present | Kept unchanged |
| `venta_detalles.trg_venta_detalle_insert` | Present | Present | Kept unchanged |
| `venta_detalles.trg_venta_total_del` | Present | Present | Kept unchanged |
| `venta_detalles.trg_venta_total_ins` | Present | Present | Kept unchanged |
| `venta_detalles.trg_venta_total_upd` | Present | Present | Kept unchanged |
| `ventas.trg_audit_ventas` | Absent | 0001 | Added |
| `ventas.trg_sello_ventas` | Absent | 0001 | Added |
| `despachos.trg_audit_despachos` | Absent | 0001 | Added |
| `despachos.trg_sello_despachos` | Absent | 0001 | Added |
| `producciones.trg_audit_producciones` | Absent | 0001 | Added |
| `gastos_extras.trg_audit_gastos` | Absent | 0001 | Added |
| `gastos_extras.trg_sello_gastos` | Absent | 0001 | Added |
| `mermas.trg_audit_mermas` | Absent | 0001 | Added |
| `clientes.trg_sello_clientes` | Absent | 0001 | Added |
| `devoluciones_productos.trg_audit_devoluciones_productos` | Absent | 0001 | Added |
| `devoluciones_envases.trg_audit_devoluciones_envases` | Absent | 0001 | Added |
| `venta_detalles.trg_audit_venta_detalles` | Absent | 0001 | Added |
| `despacho_detalles.trg_audit_despacho_detalles` | Absent | 0001 | Added |
| `incidencias_produccion.trg_audit_incidencias_produccion` | Absent | 0008 | Added |
| `mermas.trg_merma_anular` | Absent | 0001 | Added |

The ordinary merma reversal is restored as the historical false→true transition. Its legacy use of mutable NEW values and lack of reactivation protection are deliberately retained here for the dedicated integrity task (BACK-N6); B1 does not claim cancellation is safe against edited quantities, repeated toggles, prior already-annulled inserts or historical inconsistent balances. Applying the delta never cancels an existing merma or recalculates stock.

### Policies

All 68 existing policy names are retained. The four production/incidents policies below are replaced with 0008 definitions using the already-present active-profile private helpers, identity checks and sucursal checks. The 0010 `mermas_insert_operativo` and operational container-stock read policy already exist and are kept. Other role/sucursal hardening is B2.

| Object | Remote | Legacy / design | Decision |
| --- | --- | --- | --- |
| `auditoria.auditoria_select_admin` | Present | Present | Kept unchanged |
| `carga_vendedor.carga_vendedor_delete_bodega` | Present | Present | Kept unchanged |
| `carga_vendedor.carga_vendedor_select_propio` | Present | Present | Kept unchanged |
| `carga_vendedor.carga_vendedor_update_bodega` | Present | Present | Kept unchanged |
| `carga_vendedor.carga_vendedor_write_bodega` | Present | Present | Kept unchanged |
| `clientes.clientes_delete_admin` | Present | Present | Kept unchanged |
| `clientes.clientes_insert_cartera` | Present | Present | Kept unchanged |
| `clientes.clientes_select_cartera` | Present | Present | Kept unchanged |
| `clientes.clientes_update_cartera` | Present | Present | Kept unchanged |
| `configuracion.configuracion_insert_admin` | Present | Present | Kept unchanged |
| `configuracion.configuracion_select_admin` | Present | Present | Kept unchanged |
| `configuracion.configuracion_update_admin` | Present | Present | Kept unchanged |
| `despacho_detalles.despacho_detalles_insert_bodega` | Present | Present | Kept unchanged |
| `despacho_detalles.despacho_detalles_select_despacho` | Present | Present | Kept unchanged |
| `despacho_detalles.despacho_detalles_update_admin` | Present | Present | Kept unchanged |
| `despacho_envases.despacho_envases_insert_bodega` | Present | Present | Kept unchanged |
| `despacho_envases.despacho_envases_select_despacho` | Present | Present | Kept unchanged |
| `despacho_envases.despacho_envases_update_admin` | Present | Present | Kept unchanged |
| `despachos.despachos_insert_bodega` | Present | Present | Kept unchanged |
| `despachos.despachos_select_operativo` | Present | Present | Kept unchanged |
| `despachos.despachos_update_admin` | Present | Present | Kept unchanged |
| `devoluciones_envases.devoluciones_envases_insert_despacho` | Present | Present | Kept unchanged |
| `devoluciones_envases.devoluciones_envases_select_despacho` | Present | Present | Kept unchanged |
| `devoluciones_envases.devoluciones_envases_update_admin` | Present | Present | Kept unchanged |
| `devoluciones_productos.devoluciones_productos_insert_despacho` | Present | Present | Kept unchanged |
| `devoluciones_productos.devoluciones_productos_select_despacho` | Present | Present | Kept unchanged |
| `devoluciones_productos.devoluciones_productos_update_admin` | Present | Present | Kept unchanged |
| `gastos_extras.gastos_extras_insert_vendedor` | Present | Present | Kept unchanged |
| `gastos_extras.gastos_extras_select_propio` | Present | Present | Kept unchanged |
| `gastos_extras.gastos_extras_update_admin` | Present | Present | Kept unchanged |
| `incidencias_produccion.incidencias_produccion_insert_produccion` | Present | 0008 intent missing remotely | Added: replace with 0008 definition |
| `incidencias_produccion.incidencias_produccion_select_produccion` | Present | 0008 intent missing remotely | Added: replace with 0008 definition |
| `mermas.mermas_insert_operativo` | Present | Present | Kept unchanged |
| `mermas.mermas_select_operativo` | Present | Present | Kept unchanged |
| `mermas.mermas_update_admin` | Present | Present | Kept unchanged |
| `perfiles.perfiles_insert_admin` | Present | Present | Kept unchanged |
| `perfiles.perfiles_select_propio` | Present | Present | Kept unchanged |
| `perfiles.perfiles_update_admin` | Present | Present | Kept unchanged |
| `producciones.producciones_insert_produccion` | Present | 0008 intent missing remotely | Added: replace with 0008 definition |
| `producciones.producciones_select_produccion` | Present | 0008 intent missing remotely | Added: replace with 0008 definition |
| `producciones.producciones_update_admin` | Present | Present | Kept unchanged |
| `productos.productos_insert_admin` | Present | Present | Kept unchanged |
| `productos.productos_select_autenticado` | Present | Present | Kept unchanged |
| `productos.productos_update_admin` | Present | Present | Kept unchanged |
| `reglas_comision.reglas_comision_delete_admin` | Present | Present | Kept unchanged |
| `reglas_comision.reglas_comision_insert_admin` | Present | Present | Kept unchanged |
| `reglas_comision.reglas_comision_select_autenticado` | Present | Present | Kept unchanged |
| `reglas_comision.reglas_comision_update_admin` | Present | Present | Kept unchanged |
| `stock_bodega.stock_bodega_select_operativo` | Present | Present | Kept unchanged |
| `stock_bodega.stock_bodega_update_bodega` | Present | Present | Kept unchanged |
| `stock_bodega.stock_bodega_write_bodega` | Present | Present | Kept unchanged |
| `stock_envases.stock_envases_select_operativo` | Present | Present | Kept unchanged |
| `stock_envases.stock_envases_update_bodega` | Present | Present | Kept unchanged |
| `stock_envases.stock_envases_write_bodega` | Present | Present | Kept unchanged |
| `sucursales.sucursales_insert_admin` | Present | Present | Kept unchanged |
| `sucursales.sucursales_select_autenticado` | Present | Present | Kept unchanged |
| `sucursales.sucursales_update_admin` | Present | Present | Kept unchanged |
| `tipos_empaque.tipos_empaque_insert_admin` | Present | Present | Kept unchanged |
| `tipos_empaque.tipos_empaque_select_autenticado` | Present | Present | Kept unchanged |
| `tipos_empaque.tipos_empaque_update_admin` | Present | Present | Kept unchanged |
| `ubicaciones_vendedores.ubicaciones_vendedores_insert_propio` | Present | Present | Kept unchanged |
| `ubicaciones_vendedores.ubicaciones_vendedores_select_operativo` | Present | Present | Kept unchanged |
| `venta_detalles.venta_detalles_insert_venta` | Present | Present | Kept unchanged |
| `venta_detalles.venta_detalles_select_venta` | Present | Present | Kept unchanged |
| `venta_detalles.venta_detalles_update_admin` | Present | Present | Kept unchanged |
| `ventas.ventas_insert_vendedor` | Present | Present | Kept unchanged |
| `ventas.ventas_select_propio` | Present | Present | Kept unchanged |
| `ventas.ventas_update_admin` | Present | Present | Kept unchanged |

The former `mermas_insert_bodega` is not ported: 0010 explicitly supersedes it with `mermas_insert_operativo`. Commented-out `venta_detalles_delete_admin` and receipt policies are examples, not active legacy objects; no DELETE permission, receipt table or Storage feature is introduced. Global administrator profiles stay valid without a sucursal; the restored 0008 production INSERT policy still requires a matching sucursal, as legacy intended. Choosing a global admin's production target is a later explicit policy decision.

### Secondary indexes

The snapshot has 33 indexes: 31 supporting existing PK/unique constraints and two named secondary indexes. The 21 absent secondary indexes below restore 0001's declared access paths using `IF NOT EXISTS`; the same definitions are in bd/ondina_schema_supabase.sql. No constraint-backed index is dropped or duplicated.

| Object | Remote | Legacy / design | Decision |
| --- | --- | --- | --- |
| `idx_auditoria_tabla_registro` | Present | Present | Kept unchanged |
| `idx_despacho_envases_despacho` | Present | Present | Kept unchanged |
| `idx_clientes_sucursal` | Absent | Present in 0001 / bd | Added |
| `idx_clientes_vendedor` | Absent | Present in 0001 / bd | Added |
| `idx_ventas_sucursal` | Absent | Present in 0001 / bd | Added |
| `idx_ventas_vendedor` | Absent | Present in 0001 / bd | Added |
| `idx_ventas_cliente` | Absent | Present in 0001 / bd | Added |
| `idx_ventas_creado_en` | Absent | Present in 0001 / bd | Added |
| `idx_venta_detalles_venta` | Absent | Present in 0001 / bd | Added |
| `idx_venta_detalles_producto` | Absent | Present in 0001 / bd | Added |
| `idx_despachos_sucursal` | Absent | Present in 0001 / bd | Added |
| `idx_despachos_vendedor` | Absent | Present in 0001 / bd | Added |
| `idx_despachos_creado_en` | Absent | Present in 0001 / bd | Added |
| `idx_despacho_detalles_despacho` | Absent | Present in 0001 / bd | Added |
| `idx_despacho_detalles_producto` | Absent | Present in 0001 / bd | Added |
| `idx_devoluciones_productos_despacho` | Absent | Present in 0001 / bd | Added |
| `idx_devoluciones_envases_despacho` | Absent | Present in 0001 / bd | Added |
| `idx_mermas_sucursal` | Absent | Present in 0001 / bd | Added |
| `idx_mermas_despacho` | Absent | Present in 0001 / bd | Added |
| `idx_producciones_sucursal` | Absent | Present in 0001 / bd | Added |
| `idx_producciones_creado_en` | Absent | Present in 0001 / bd | Added |
| `idx_ubicaciones_vendedor` | Absent | Present in 0001 / bd | Added |
| `idx_auditoria_creado_en` | Absent | Present in 0001 / bd | Added |

### Other schema and data decisions

| Object / operation | Remote | Legacy / design | Decision |
| --- | --- | --- | --- |
| `private` schema + es_rol/mi_sucursal ACL | Present | 0008/0009 | Kept unchanged |
| `pg_stat_statements`, `pgcrypto`, `supabase_vault`, `uuid-ossp` | Present | Supabase platform / legacy | Kept IF NOT EXISTS; platform-owned objects not recreated |
| `supabase_realtime`: producciones | Not published | 0008 subscribes | Added idempotently |
| `supabase_realtime`: incidencias_produccion | Not published | 0008 subscribes | Added idempotently |
| `supabase_realtime`: stock_envases | Not published | 0008 subscribes | Added idempotently; existing private-helper read policy retained |
| `incidencias_produccion_descripcion_largo` | Absent | 0008 CHECK 1..1000 trimmed chars | Added NOT VALID, no cleanup/backfill; later validate after reviewing invalid older rows |
| 0004 / remote catalog migration contents | Schema-only dump has no data | Six sale products + packaging | Local synthetic seed only; no production catalog deletion/upsert |
| 0005 test-product deletion | Historical data DML | Deletes sample catalog rows | Intentionally not ported: no production data deletion |
| 0007 carga_vendedor backfill | Existing sales already moved stock | Deducts every active sale again | Intentionally not ported (BD-03 / BACK-N14) |
| 0007 envases_recibidos stock addition | Remote sales trigger omits it | Reintroduced in legacy 0007 | Intentionally not ported (BACK-N1); preserve single existing movement |
| Existing views/RPC ACL and broad RLS | Present with known defects | Mixed historical state | Kept; B2 must harden before production release |
| Cancellation/inventory/NaN/concurrency semantics | Known defects | BACK-N2..N7/N9..N13 | Intentionally no broad integrity rewrite in B1 |
| Storage buckets / receipt objects | No buckets | Deferred HU-07 / future features | Intentionally not ported |
| Platform role timeout/logging settings | Supplied roles dump | No application design counterpart | Intentionally not ported; CLI owns local roles |

## B2 security delta and application contract

All ten public views use `security_invoker=true`; only the three current frontend views retain authenticated SELECT (`v_comision_vendedor`, `v_ranking_vendedores`, `v_indicadores_produccion_diarios`). RLS on the underlying tables limits seller commissions/ranking to their own rows. Ranking additionally excludes non-sales roles, because warehouse staff can legitimately read seller profiles but must not obtain a ranking through that join. No anon/PUBLIC table, sequence, schema or function access remains in `public`/`private`. Only current frontend RPCs retain authenticated EXECUTE in public; trigger functions, event-trigger helpers and public role/branch wrappers have none. Private helpers are callable only as necessary for RLS and the invoker dispatch RPC; `private` remains outside the API's exposed schemas.

The 23-table policy set is replaced, not augmented: old permissive policies cannot broaden access through OR. Actor-independent checks use `(select auth.uid())` and stable helper initplans; inherited PK/FK/branch indexes are retained. An inactive/missing profile has no role or branch privileges, including catalog reads. A global active administrator is exactly an administrator with NULL sucursal; other administrators are confined to their branch. Shared products/packaging/commission rules have no branch column and are readable by active profiles. The current app has no catalog/profile/configuration management writes, so these unused mutations are closed by grants as well as policies. Clients have no DELETE path; balances/load have no direct write grants or policies.

| Surface | Authorized caller and scope |
| --- | --- |
| Clients, sales, expenses | Active seller: own rows in own branch; administrator: authorized branch(es) |
| Seller load | Active seller: own rows; warehouse/admin: sellers within authorized branch(es); no client writes |
| Dispatch parents/lines | Seller: own reads; warehouse/production: branch reads; administrator: authorized branches; creation/line insertion: warehouse/admin only |
| Returns | Warehouse/admin in parent dispatch branch; correction RPC: administrator only |
| Production and plant losses | Production/admin in authorized branch; warehouse may read losses and record authorized losses; identity/initial active state checked on inserts |
| GPS | Active seller: own SELECT/INSERT; administrator: authorized branches SELECT; warehouse/production: no rows |
| Incident, audit, configuration | RLS is installed, but these unused current-frontend objects have no authenticated SELECT/write grants; tests temporarily grant SELECT inside a rolled-back transaction to inspect defense-in-depth policies |
| `registrar_venta(uuid,text,jsonb,numeric,text)` | Active seller or administrator, authorized active customer/seller and branch; administration acts for the customer's seller while `creado_por` remains `auth.uid()` |
| `crear_despacho(uuid,uuid,uuid,uuid,jsonb,jsonb)` | Active warehouse/admin, authorized branch and seller, caller equals both supplied actor IDs; remains SECURITY INVOKER |
| `corregir_devolucion(uuid,uuid,jsonb,jsonb)` | Active administrator within dispatch branch; supplied actor must equal session, stored actor derives from `auth.uid()` |

All SECURITY DEFINER functions set an empty search path and qualify application objects. Existing stock/cancellation implementations are preserved except the dispatch window guard. Every product/container line insertion checks the parent branch and a server-clock deadline, regardless of `es_ajuste`. A new BEFORE INSERT trigger stamps `despachos.creado_en` from `clock_timestamp()`, preventing future-dated client input from extending the window. Missing configuration falls back to 15 minutes, matching the historical `bd/seed.sql` value; an existing configured value is respected. No HU-26 interface, idempotency redesign, return-cap/cancellation rewrite, bucket or receipt feature is added.

Default application exposure is revoked for objects created by `postgres`, including global PUBLIC function EXECUTE (a schema-local revoke alone cannot remove that default). Platform-owned `supabase_admin` defaults in other schemas are untouched. A future migration/owner must explicitly review its own defaults and grants; this migration is not a promise that subsequently created views become invoker automatically.

### Deferred monetary constraint validation

Eight named `*_finito_b2` constraints reject NaN and both infinities; commission percentage also requires <=100. Existing numeric precision, generated subtotals and nonnegative checks are preserved. Typmod-constrained numeric columns already reject infinities with SQLSTATE 22003; explicit CHECKs also protect NaN and future type changes. The sale RPC parses price as unconstrained numeric first, so NaN/Infinity inputs get stable Spanish P0001 messages before a typmod cast, and the whole operation rolls back even if an earlier detail moved stock.

Every new CHECK remains **NOT VALID**, including on the synthetic local seed: it protects new/updated rows without scanning or rewriting uninspected production history. After the separate remote backup/restore and release-authorization gate, run this read-only inspection on the exact target. Do not silently delete or coerce invalid historical money; obtain a reviewed repair decision first.

```sql
select 'ventas.total' as field, count(*) as invalid_rows from public.ventas where total in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
union all select 'ventas.descuento', count(*) from public.ventas where descuento in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
union all select 'venta_detalles.precio_unitario', count(*) from public.venta_detalles where precio_unitario in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
union all select 'venta_detalles.subtotal', count(*) from public.venta_detalles where subtotal in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
union all select 'gastos_extras.monto', count(*) from public.gastos_extras where monto in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
union all select 'reglas_comision.porcentaje', count(*) from public.reglas_comision where porcentaje in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or porcentaje > 100
union all select 'reglas_comision.monto_fijo', count(*) from public.reglas_comision where monto_fijo in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
union all select 'productos.precio_base', count(*) from public.productos where precio_base in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric);
```

Only after every count is zero and the owner approves the separate scan, apply these statements in a maintenance window and record the results. VALIDATE scans historical rows and takes a table lock; rehearse the timing on the restored copy first.

```sql
alter table public.ventas validate constraint ventas_total_finito_b2;
alter table public.ventas validate constraint ventas_descuento_finito_b2;
alter table public.venta_detalles validate constraint venta_detalles_precio_unitario_finito_b2;
alter table public.venta_detalles validate constraint venta_detalles_subtotal_finito_b2;
alter table public.gastos_extras validate constraint gastos_extras_monto_finito_b2;
alter table public.reglas_comision validate constraint reglas_comision_porcentaje_finito_b2;
alter table public.reglas_comision validate constraint reglas_comision_monto_fijo_finito_b2;
alter table public.productos validate constraint productos_precio_base_finito_b2;
```

The RPC messages requiring the coordinator's frontend catalog update are listed exactly in [B2 validation](validation-b2.md). No frontend code is changed here; unknown messages safely use the existing generic fallback until that separately owned update lands.

## Local and CI procedure

CLI **2.111.0**, Docker and PostgreSQL **17.6** were used. `config.toml` was generated by `supabase init`, with project_id `ondina-erp`, PostgreSQL major 17 and `[auth].enable_signup = false`; other generated defaults are retained. The existing CLI `.gitignore` covers `.branches` and `.temp`. The local bootstrap also creates `pg_net` in the platform-owned `extensions` schema; it is an explained environment difference outside the public application schema, not a B1 delta. Only this project may own the default local ports during the run; stop this project's stack before another worktree starts it.

```bash
supabase start
supabase db reset --local
supabase test db --local
bash supabase/tests/rehearse-upgrade.sh
supabase db lint --local --schema public,private --fail-on error
# The B1-only snapshot comparator intentionally rejects B2 security differences.
# For that historical diagnostic only, reset to B1 first:
supabase db reset --local --version 20261013000100
supabase db dump --local --schema public --file /tmp/ondina-local-public.sql
supabase db dump --local --file /tmp/ondina-local-full.sql
# Compare with the supplied read-only snapshot file, never a live remote query:
python3 supabase/tests/compare-schema.py /path/to/remote-schema.sql \
  /tmp/ondina-local-public.sql /tmp/ondina-local-full.sql
# Restore the complete reviewed chain after the B1-only diagnostic.
supabase db reset --local
supabase test db --local
supabase stop --no-backup
```

The seed creates two fictional sucursales, one profile of each role in each branch, a global administrator, two fictional customers, six catalog products, seven packaging types and initial balances. Fixture emails use example.invalid, RUTs are absent, and auth.users have no login passwords or identities. Seeds are CLI-local only; the production procedure never includes `--include-seed`.

pgTAP asserts the exact table/view inventory, every public table's RLS flag, expected public/private functions, the commission column and nullable admin branch contract. It performs production and ordinary merma cancellation through authenticated RLS and checks stock, packaging and audit actor. Transactions roll back each test file. B2 adds a separate role/object matrix, inactive/missing-profile checks, cross-branch/peer-seller writes, RPC/trigger/default ACL checks and atomic nonfinite-money rejection. Concurrency and the remaining stock-integrity matrix belong to B3/B5; these SQL tests do not establish production REST/Realtime behavior.

The upgrade rehearsal resets only the local baseline, seeds representative data, records a sale/production/merma, fingerprints **all rows** of all 23 public tables plus auth.users, applies the delta and applies it a second time. Exact counts and content digests must remain identical after each application, including stock, seller load, foreign keys and historical timestamps. It then applies each later forward migration once and compares all fingerprints again; B2 does not claim migration reapplication is supported. The script finishes with the complete reset and pgTAP run. CI's `migrations-check` pins setup-cli by full SHA and CLI 2.111.0, starts only the isolated database, resets migrations + seed, runs pgTAP and always stops with `--no-backup`; other jobs are unchanged. The coordinator owns required-check configuration and integration.

## Later authorized production application (not executed here)

1. Schedule a write-maintenance window and serialize database writers. Take a provider-supported **full backup including Auth and application data** with a tested restoration path, plus fresh schema, role settings and migration-ledger exports. Confirm the exact target and commit; a schema-only CLI dump is not a data backup. Keep exports outside Git.
2. Compare that fresh schema and ledger with this supplied baseline. Stop if production has drifted or the five versions differ. Rehearse the same delta against an isolated restored copy and verify row counts, content/relationship checks, balances, grants, RLS and relevant client queries. B2/integrity acceptance remains a separate release gate.
3. From a clean checkout of the reviewed commit, deliberately configure the intended remote connection only after explicit release authorization. The commands below use `--linked` for clarity and are **documentation only** in this run. Record the original ledger before repairing it. Repair changes metadata; it does not revert SQL or data.

```bash
supabase migration repair --linked --status reverted \
  20260806024044 20260806024400 20260806232318 20260806232340 20260817034401
supabase migration repair --linked --status applied 20261013000000
supabase migration list --linked
supabase db push --linked --dry-run
# Review: only 20261013000100 and any explicitly approved later deltas may be pending.
# The baseline MUST NOT appear in this dry-run. Never use --include-all or --include-seed.
supabase db push --linked
```

4. Verify the applied ledger, schema diff, unchanged historical row counts/balances and application reads. Check that Realtime now contains exactly the three intended additions. Review and eventually validate the eight NOT VALID B2 monetary constraints using the procedure above, as well as the NOT VALID incident constraint after resolving historical invalid rows without silent deletion. Keep the backup and evidence until release acceptance.
5. On failure, stop writes and inspect the transaction/ledger before retrying. Do not mark an actually executed delta reverted or rerun the baseline. If only metadata repair happened, restore the saved ledger entries to their original states; if schema/data changed, prefer a reviewed forward fix or restore the tested full backup with the deployment owner. No destructive reverse migration or stock reconstruction is supplied.

References: [database guide](../docs/engineering/database.md), [backend audit](../docs/archive/audits/2026-10-13/workers/backend-schema-rpc.md), [CLI local development](https://supabase.com/docs/guides/local-development/overview), [pgTAP guidance](https://supabase.com/docs/guides/local-development/testing/pgtap-extended), [configuration](https://supabase.com/docs/guides/local-development/managing-config).

## Validation evidence

See [B3 validation report](validation-b3.md) for the integrity-chain evidence, [B2 validation report](validation-b2.md) for the security-hardening evidence and remaining release limits; see [B1 validation report](validation-b1.md) for exact local outputs, semantic dump comparison and limitations. The supplied dump SHA-256 is `dec1d59d22d89390ef4309fa9c6878c2df713a7025ac071c22c76ed32177a4dd`.

## B3 remote gates and frontend sequencing

B3 has only been verified locally. Do not execute its baseline or seed remotely,
repair a ledger, link this checkout or push any SQL without the separately
approved deployment procedure above. Apply the SQL commit before releasing the
separate frontend commit: the client requires `registrar_devolucion`,
`contar_ventas_jornada`, the trailing retry arguments and incident branch column.
The old argument sets remain callable through trailing defaults; B3 removes old
function definitions before creating extended signatures to avoid ambiguous
PostgREST overloads. Recheck dependencies and refresh the API schema cache.

Before applying the exclusion constraint, inspect all commission intervals for
overlaps, invalid ranges and nonfinite values. PostgreSQL must validate the
exclusion constraint immediately; B3 intentionally aborts on overlapping legacy
rules rather than choosing winners, deleting history or rewriting commissions.
Resolve any conflict with a reviewed business decision and isolated rehearsal.
B2's eight NOT VALID monetary constraints retain their separate review gate.
Inspect historical cancellations, returned-above-dispatched totals, absent or
insufficient balances and product/packaging catalog history before enabling
corrections. B3 introduces stricter invariants; it does not silently make
inconsistent historical data pass. Existing historical container double credits
remain an explicit reconciliation concern, without any blanket stock backfill.

The upgrade rehearsal compares every original public/auth field using frozen
baseline column projections, retaining exact row counts and content hashes while
allowing additive metadata columns. B3 adds no public business table; its private
retry ledger begins empty. Existing sales receive the metadata default marking
the baseline's plant-container-credit semantics without updating their stored
balances. New retry keys, reasons, production packaging snapshots and incident
branches do not rewrite old rows. Audit actor requirements apply to authenticated
business operations; seed/maintenance events without a JWT can retain null actor.
Legacy incidents are preserved with author-based RLS but need an authorized
branch review for the new explicitly filtered UI list; no reclassification of
old losses or silent conversion is performed.

## B6 revision R1 delta

Migration `20261013200000_b6_revision_fixes.sql` (OND-5gi.9; GitHub #29, #30, #31, #32, #33, #42) follows B4 and is forward-only.
Its behavior is documented in the [database guide](../docs/engineering/database.md#b6-backend-review-fixes--2026-10-13).
It changes functions, policies, one CHECK and grants; it rewrites no rows, balances, prices or history.

Remote ordering and gates:

- Apply the SQL before the frontend commit. The new bodega seller list (`vendedores_sucursal`) and the correction key argument
  (`corregir_devolucion(..., p_idempotency_key)`) do not exist before this migration. Before the frontend lands, the previous
  bodega client reads only its own profile, so dispatch and return screens list no sellers.
- RB-4 preflight, before applying B3 on the restored copy. B3's `EXCLUDE` constraint on `reglas_comision` aborts on any overlap.
  The query must return zero rows:

  ```sql
  select a.id as regla_a, b.id as regla_b
  from public.reglas_comision a
  join public.reglas_comision b
    on a.id < b.id
   and a.tipo_producto = b.tipo_producto
   and tstzrange(a.vigente_desde, a.vigente_hasta, '[)')
       && tstzrange(b.vigente_desde, b.vigente_hasta, '[)');
  ```

- RB-5 `auditoria_accion_check` is created `NOT VALID` by this migration, so new and updated rows are checked without a
  table scan here. B3 still creates the same check validated, and that statement scans `auditoria` when B3 is applied.
  Avoiding that scan requires `NOT VALID` in B3's statement, which this delta does not change. The repository does not
  record the size of `auditoria`; measure it on the restored copy before the window. Validate the historical rows separately,
  in a window after the count is zero:

  ```sql
  select count(*) from public.auditoria where accion not in ('INSERT','UPDATE','ANULACION','DELETE'); -- must be 0
  alter table public.auditoria validate constraint auditoria_accion_check;
  ```

- Index creation (RB-6): the non-concurrent indexes from B1, B3 and B4 are accepted at the measured remote volume
  (38 sales and 16 dispatches on 2026-10-13). Larger volumes need `CREATE INDEX CONCURRENTLY` as separate statements outside
  a transaction.
- Local Auth: `[auth.email].enable_signup` is the CLI key for the email/password provider (`GOTRUE_EXTERNAL_EMAIL_ENABLED`) and
  must stay `true`. Self-service sign-up is closed by `[auth].enable_signup = false` (`GOTRUE_DISABLE_SIGNUP=true`). With the
  previous `false`, every password sign-in failed with `Email logins are disabled`, so the B5 journeys could not sign in.

Local validation on 2026-10-13 (isolated stack, `project_id` `ondina-erp`, after the B6 migration):

- `supabase db reset --local`: passed.
- `supabase test db --local`: 5 files, 654 assertions, passed. `005_b6_revision.test.sql` is new; `002_security.test.sql`
  now expects bodega to read only its own profile and uses the six-argument correction signature.
- `supabase/tests/rehearse-upgrade.sh`: passed. Row counts and content hashes were unchanged for every public table and
  `auth.users` after each forward migration, including the B6 delta. The script's final reset and suite also passed.
- `supabase db advisors --local --type security`: no issues found.
- Frontend (from `frontend/`): lint, build, size, unit tests (43 files, 522 tests) and `test:integration` (6 files, 22 tests) passed.
