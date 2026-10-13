# B4 query and index evidence — 2026-10-13

Scope: OND-5gi.8, GitHub #47 (indexes measured under RLS) and the advisor findings
it covers. Realtime (#48 / BD-12) and generated types (#51 / FE-09) are verified in
[`tests/perf/realtime-rls-check.mjs`](tests/perf/realtime-rls-check.mjs) and in the
validation notes below. All numbers come from an isolated local stack with synthetic data.
They are not production latency, load or write-cost measurements.

## Method

- Stack: Supabase CLI 2.111.0, local PostgreSQL 17, project `ondina-erp-b4` on ports
  55320–55329 (an isolated copy, so the default `ondina-erp` stack was never touched).
- Volume: [`tests/perf/synthetic_volume.psql`](tests/perf/synthetic_volume.psql) on top of
  `seed.sql` (deterministic `setseed`). 40 sellers in 2 sucursales, 1,002 clientes,
  50,000 ventas (≈90,000 detalles), 50,000 despachos (100,000 detalles, 50,000 envases),
  50,000 producciones, 25,000 mermas, 20,000 gastos over 730 days. Triggers are skipped
  during the bulk load (`session_replication_role = replica`); CHECK, UNIQUE and FK
  constraints still apply.
- Measurement: [`tests/perf/measure.py`](tests/perf/measure.py). It runs 25 read paths
  taken from `frontend/src/domains/*/api.ts` and `frontend/src/lib/*.ts`, plus the three
  views they read. Each runs as `authenticated` with a JWT claim for the actor (seller,
  bodega, producción, branch administrator, global administrator), so RLS applies.
  Statements mirror the PostgREST filters and ordering; they are equivalent, not
  byte-identical. Each query runs once as warm-up, then 5 times with
  `EXPLAIN (ANALYZE, BUFFERS)`. The table reports the median.
- "Before" is the B3 chain (`20261013000000` → `20261013184049`) with the same volume
  loaded. "After" is the chain including `20261013193000_b4_indexes_realtime.sql`, after
  `supabase db reset --local` and the same volume load. Both were measured with `ANALYZE`.

## Before and after

| Consulta | Actor | Filas | Antes (ms) | Después (ms) | Buffers antes | Buffers después |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| ventas_jornada_count | vendedor_A | 1 | 0.667 | 0.182 | 37 | 27 |
| clientes_ruta | vendedor_A | 25 | 0.2 | 0.232 | 54 | 54 |
| productos_venta | vendedor_A | 6 | 0.2 | 0.144 | 16 | 16 |
| carga_vendedor_propia | vendedor_A | 0 | 0.019 | 0.012 | 2 | 2 |
| gastos_hoy | vendedor_A | 0 | 1.665 | 0.017 | 704 | 2 |
| mi_comision | vendedor_A | 1180 | 18.21 | 20.379 | 232392 | 282246 |
| ranking_mes | admin_A | 20 | 15.456 | 15.255 | 4024 | 4724 |
| vendedores_sucursal | bodega_A | 20 | 0.62 | 0.244 | 14 | 14 |
| despachos_sucursal | bodega_A | 25000 | 9.371 | 9.131 | 871 | 873 |
| despacho_detalles_in | bodega_A | 400 | 6.351 | 6.491 | 2890 | 2894 |
| despacho_envases_in | bodega_A | 200 | 6.227 | 6.391 | 2359 | 2353 |
| devoluciones_productos_in | bodega_A | 0 | 0.052 | 0.051 | 2 | 1 |
| devoluciones_envases_in | bodega_A | 0 | 0.134 | 0.052 | 2 | 1 |
| stock_bodega | bodega_A | 6 | 0.241 | 0.222 | 11 | 11 |
| stock_envases | bodega_A | 7 | 0.235 | 0.242 | 11 | 11 |
| carga_vendedores_in | bodega_A | 6 | 1.46 | 1.026 | 40 | 40 |
| productos_catalogo | bodega_A | 6 | 0.089 | 0.069 | 5 | 5 |
| sucursales_activas | admin_global | 2 | 0.162 | 0.164 | 11 | 11 |
| perfil_propio | vendedor_A | 1 | 0.077 | 0.081 | 3 | 3 |
| producciones_recientes | produccion_A | 30 | 0.261 | 0.25 | 142 | 78 |
| historial_producciones | admin_A | 200 | 0.952 | 0.31 | 2085 | 420 |
| historial_producciones_producto | admin_A | 200 | 1.929 | 0.983 | 2085 | 2091 |
| mermas_recientes | produccion_A | 30 | 2.423 | 0.446 | 1144 | 79 |
| indicadores_produccion | produccion_A | 93 | 9.695 | 9.38 | 2985 | 2985 |

Reading the table:

- **Material plan changes (accepted):** `gastos_hoy` (sequential scan of `gastos_extras`
  → index; 704 → 2 buffers), `mermas_recientes` (1,144 → 79 buffers, 2.4 → 0.45 ms),
  `historial_producciones` (2,085 → 420 buffers, 0.95 → 0.31 ms), `producciones_recientes`
  (142 → 78 buffers) and `ventas_jornada_count` (37 → 27 buffers, 0.67 → 0.18 ms).
- **No material change:** the rest. Differences below about 1 ms on sub-millisecond
  queries are within run-to-run noise. Do not read them as regressions or gains.
- **`mi_comision` and `ranking_mes` are unchanged in plan.** Their buffer totals rose
  (232k → 282k, 4.0k → 4.7k) between the two loads. Their index lists are identical. Dropping
  the new `ventas` index leaves `mi_comision` at 282,246 buffers, so the B4 `ventas` index
  does not cause the increase. The cause is in the data load or statistics, not in the SQL
  changes; this was not reproduced further. Both queries stay at about 15–20 ms.

## Why the commission and ranking views stay sequential

`v_comision_vendedor` computes `sum(...) OVER (PARTITION BY v.id)` before its
`vendedor_id` filter, so the filter cannot be pushed below the window. Under RLS the
`ventas` policy is an `OR` of administrator and seller branches with InitPlans, so the
planner does not use the `vendedor_id` index for the base scan. The result is a sequential
scan of `ventas` limited by RLS (about 4 ms at 50k rows). Adding indexes does not change
that plan. Fixing it needs a view or policy redesign, which touches B2 security and
commission semantics, so it is deliberately left out of B4. Revisit it when `ventas`
exceeds roughly 1 million rows, or when the commission screen becomes a measured bottleneck.

## Index decisions

Accepted (created by `20261013193000_b4_indexes_realtime.sql`; each changed a measured plan):

| Index | Query that justified it | Result |
| --- | --- | --- |
| `idx_producciones_sucursal_creado_en` on `producciones (sucursal_id, creado_en desc) where not anulado` | `producciones_recientes`, `historial_producciones` | Sort and bitmap removed; 2,085 → 420 buffers |
| `idx_mermas_sucursal_creado_en_pendientes` on `mermas (sucursal_id, creado_en desc) where not anulado and despacho_id is null and producto_id is not null` | `mermas_recientes` | 1,144 → 79 buffers |
| `idx_gastos_extras_vendedor_creado_en` on `gastos_extras (vendedor_id, creado_en desc)` | `gastos_hoy` | Sequential scan replaced; 704 → 2 buffers |
| `idx_ventas_vendedor_creado_en_activas` on `ventas (vendedor_id, creado_en) where not anulado` | `ventas_jornada_count` | Two-index bitmap replaced by one range scan; 37 → 27 buffers |

Candidates tested and rejected (not in the migration):

- `despachos (sucursal_id, creado_en desc)` for `despachos_sucursal`: the planner kept
  `idx_despachos_sucursal` plus a sort. 9.37 → 10.09 ms, no buffer change.
- A composite `(sucursal_id, producto_id, creado_en)` for the product-filtered history
  was not tested and is not added. The accepted index already serves the branch and time
  predicates of that query, and the product filter adds a measured 0.98 ms (2,091 buffers).
  Revisit it if that query becomes a measured bottleneck.

Foreign keys (`unindexed_foreign_keys`, INFO; 40 findings after B4, unchanged from before):

- Not indexed. None of the measured read paths filters or joins on these columns, and
  the parents have no client DELETE path (B2) and no `ON DELETE CASCADE` other than
  `auth.users → perfiles`. The cost is a FK check on rare parent key changes, not a read
  path. These are mainly audit columns (`creado_por`, `modificado_por`), catalog
  references (`tipo_empaque_id`, `producto_id` on static catalog rows) and composite
  `(vendedor_id, sucursal_id)` / `(cliente_id, sucursal_id)` keys whose parents are not deleted.
- Revisit this decision if a delete, merge or reassignment flow is added, or if a measured
  query starts filtering on one of these columns.

Unused indexes (`unused_index`, INFO): 24 before, 6 after. Most restored 0001 indexes are
now exercised by the measured queries. The six remaining (`idx_auditoria_creado_en`,
`idx_mermas_despacho`, `idx_mermas_sucursal`, `idx_ubicaciones_vendedor`,
`idx_venta_detalles_producto`, `idx_ventas_sucursal`) are not read by any measured query.
They are NOT dropped: #47 requires an observation window on the remote project and a check
of the restrictions they support (for example, `idx_ventas_sucursal` may serve the
administrator RLS branch, which this run did not measure).

## Advisor findings

| Advisor | Before | After | Decision |
| --- | --- | --- | --- |
| `performance` WARN `auth_rls_initplan` (`incidencias_produccion_insert_b3`) | 1 | 0 | Fixed: the policy is recreated with `(select auth.uid())` and `(select private.*())`; same predicate, covered by pgTAP 004. |
| `performance` INFO `unindexed_foreign_keys` | 40 | 40 | Justified above (no read path, no cascade, no client DELETE). |
| `performance` INFO `unused_index` | 24 | 6 | Not dropped; observation window required. |
| `security` INFO `rls_enabled_no_policy` (`private.solicitudes_devolucion`) | 1 | 1 | Intentional: the private retry-key table has RLS on, all privileges revoked, no policy, and is written only by the B3 security-definer RPC. |

Run as `supabase db advisors --local --type performance --level info` and
`--type security --level info`. Security: no WARN or ERROR findings before or after.

## Realtime (#48 / BD-12)

- `supabase_realtime` now publishes `producciones`, `mermas`, `stock_envases` and
  `incidencias_produccion`. The last one was published by 0008 and has no current
  subscriber; it is kept until a product decision removes it. `mermas` was added by B4
  with an idempotent guard; `pgTAP 004` checks the exact set.
- RLS check (`tests/perf/realtime-rls-check.mjs`): the first run failed on a timing race
  (a fixed 4 s wait, before deliveries arrived); the check now polls for the expected
  events. Four consecutive runs after that change all passed their six checks. The own-branch production user receives producciones and
  mermas INSERTs for its branch. A branch-B user subscribed with a forged branch-A filter
  receives nothing. A branch-B control receives its own rows. A deactivated profile with
  a valid JWT receives nothing (B2 active-profile helpers).
- Limit: `DELETE` events are not delivered with a `sucursal_id` filter unless the table
  uses `REPLICA IDENTITY FULL`. The application has no DELETE path (B2), so this is not
  enabled. Revisit if a delete flow is added.
- Limit: the check uses synthetic fixtures on the local stack, not a second browser session
  against a remote project.

## Generated types (#51 / FE-09)

- `frontend/src/types/database-generated.types.ts` was regenerated with
  `supabase gen types typescript --local --schema public` from the full local chain
  (including B4). Changes include `perfiles.sucursal_id` as nullable (global admin), the
  B3 columns and RPCs, `mermas.motivo` and the current FK names. The B3 RPCs
  (`registrar_devolucion`, `contar_ventas_jornada`) are typed but not used by develop's
  frontend.
- `frontend/src/types/database.ts` was removed. It was a manual, incompatible schema copy
  with no importer.
- `as never` removed from `bodega/api.ts` (`crear_despacho`, `corregir_devolucion`, two
  inserts) and `produccion/api.ts` (two inserts). `tsc -b` passes with no `as never` left
  in `domains/*/api.ts` or `lib/*.ts`.
- Kept, with `// TODO(#51)`: `ventas/api.ts` `p_detalles as unknown as Json`.
  `DetalleVentaInput` is an interface and lacks the index signature the `Json` type needs.
  The fix (a type alias in `domains/ventas/types.ts`) is outside B4's ownership.
- `types/index.ts` already declares `Perfil.sucursal_id: string | null`, which matches the
  regenerated type, so it was not changed.

## Validation

Commands ran against the isolated `ondina-erp-b4` stack, with the config in
`/tmp/ondina-b4` changed only for `project_id` and ports.

- `supabase db reset --local --workdir /tmp/ondina-b4`: exit 0, all four migrations and seed.
- `supabase test db --local --workdir /tmp/ondina-b4`: 4 files, 616 assertions
  (B1 40, B2 459, B3 98 unchanged, B4 19), `Result: PASS`.
- `rehearse-upgrade.sh` run from `/tmp/ondina-b4` with `LOCAL_DB_CONTAINER=supabase_db_ondina-erp-b4`:
  `PASS` for the baseline delta, B2, B3 and B4 forward migrations (fingerprints of all 23
  public tables and `auth.users` unchanged), then full reset and pgTAP `PASS`.
- `supabase db advisors --local` results are in the table above.
- Frontend (`frontend/`, Node v26.3.1 — `engines` pins ^22.12, no Node 22 was available here): `npm run lint` exit 0; `npm run build` exit 0; `npm run size` "Presupuesto OK"; `npm run test` 42 files / 470 tests passed.

## Limits

- Synthetic local data on one machine. Results are medians of 5 executions. Sub-millisecond
  differences are noise. No concurrency or production-load test was run.
- Write cost of the four new indexes was not measured. They add maintenance on
  `producciones`, `mermas`, `gastos_extras` and `ventas`, each on write paths the app uses.
  Remote acceptance should include a write-latency comparison.
- `CREATE INDEX` is not concurrent inside the migration transaction. It blocks writes
  to the four tables while building. Apply it on the remote project only in the reviewed
  maintenance window, or replace it with `CREATE INDEX CONCURRENTLY` in a reviewed out-of-transaction
  step after timing against a production-sized copy.
- Remote advisors and `unused_index` windows were not checked; no remote access was used.
