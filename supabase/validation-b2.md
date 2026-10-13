# B2 database security validation — 2026-10-13

## Scope and provenance

B2 / OND-5gi.6, GitHub #27, #29, #30 and #71 is implemented on `Cristhian-S1/fix-b2-seguridad`, based on local develop `9042da7`. The only application migration added is [20261013181647_harden_database_security.sql](migrations/20261013181647_harden_database_security.sql), generated with `supabase migration new harden_database_security` and then authored as a forward security delta. The supplied B1 baseline/delta/seed are unchanged. This report records local synthetic evidence; it does not assert that production has been migrated or that the issues can be closed remotely.

No remote Supabase access/link/push, Vercel call, Git push, GitHub/Beads write, Storage bucket, frontend edit or Sprint 2 feature was performed. In particular, SEG-07's future receipt Storage policies, the HU-26 interface, B3 cancellation/return/concurrency integrity and B4 indexes/Realtime/Auth configuration are outside this task. SQL commit hooks are disabled per command to honor the no-Beads-writes boundary; validation is run directly.

## Implemented security decisions

- **#27 / SEG-01:** all ten public views are invoker views; anon has no application schema/table/view/sequence/function access. Only the three views queried by the current frontend retain authenticated SELECT. Seller commission/ranking rows follow their own base-table RLS; the ranking view explicitly excludes warehouse/production roles, which otherwise can join legitimately visible seller profiles into empty ranking entries.
- **#29 / SEG-02..05:** every public table has an explicit active-profile policy set, replacing all permissive baseline policies. Seller data is confined to actor and branch; warehouse/production and branch administrators are confined to their own branch. NULL branch grants global scope only to an active administrator. Shared catalog objects remain readable by active profiles. Every client insert surface checks the authenticated author; privileged RPCs derive the stored author from `auth.uid()`. Direct stock/load mutation and client deletion are closed. GPS SELECT/INSERT belongs to the active seller, with scoped/global administrator SELECT and no warehouse access. Public helper wrappers and private helpers return no role/branch privileges for inactive/missing profiles.
- **#30 / SEG-06, SEG-08:** only `registrar_venta`, `crear_despacho`, and `corregir_devolucion` have authenticated EXECUTE in public. All trigger/event-trigger/internal functions deny client execution. Existing SECURITY DEFINER bodies have empty search paths and qualified application objects. Dispatch remains invoker, while sale/correction explicitly validate active role, actor, customer/seller/parent and branch. Both dispatch line triggers enforce the deadline irrespective of `es_ajuste`; a BEFORE INSERT trigger stamps the parent date from the server clock, so future client dates cannot extend it. The configured window is honored, with the historical 15-minute default if the key is absent.
- **#71 / BD-07 / BACK-N10:** eight NOT VALID CHECKs protect sales total/discount, detail unit price/generated subtotal, expense amount, commission percent/fixed amount and base product price. They exclude NaN and both infinities; percentage also requires <=100. Existing decimal precision and historical prices stay intact. The sale RPC detects nonfinite price/discount as unconstrained numeric before typmod casts and returns stable Spanish P0001 messages. A failed later detail rolls back earlier sale/detail/stock/audit work.

Authenticated grants match the current frontend API modules and invoker-view dependencies; GPS permissions are the explicit additional security contract in #29. Unimplemented configuration/audit/incidence/profile/catalog management writes have no grants, and unused report views have no authenticated SELECT. Policies still protect those objects: the test transaction temporarily grants SELECT to inspect their RLS and then rolls everything back. The only retained unused mutation is `mermas.anulado` for the explicit B1 cancellation acceptance; no other merma column is writable. Remaining cancellation/reactivation behavior is B3-owned.

Default exposure is removed for future application objects owned by `postgres`, including PUBLIC's global function EXECUTE default. This deliberately does not rewrite platform-owned `supabase_admin` defaults or other platform schemas. The complete role/object/grant contract and the separate remote data-check/VALIDATE procedure are in [reconciliation](reconciliation.md#b2-security-delta-and-application-contract).

## Frontend catalog handoff: exact new P0001 messages

The coordinator should add these **eleven exact strings** to the Spanish allow-list in `frontend/src/lib/errors.ts`; no frontend edit is included here. Until that update lands, the current safe generic fallback still handles them. The first seven authorization/window messages are also useful for direct RPC/REST denial diagnosis; no UUID or raw database detail is embedded.

```text
No tienes permisos para registrar ventas.
No tienes permisos para crear despachos en esta sucursal.
No tienes permisos para corregir devoluciones de esta sucursal.
No tienes permisos para modificar este despacho.
El usuario de la operación no coincide con la sesión.
El vendedor no existe o está desactivado.
La ventana de ajuste del despacho expiró.
El descuento debe ser un número finito.
El precio unitario debe ser un número finito.
El formato de los detalles de venta no es válido.
El formato de las líneas no es válido.
```

Existing baseline Spanish business messages are preserved (including `Solo administración puede corregir devoluciones`, `Cliente inexistente o fuera de su cartera/sucursal` and `El producto no existe o está desactivado`). No new RPC/signature is required by the frontend. Administration registering a sale uses the customer's seller and load, with the authenticated administrator as author; global administration can operate across both synthetic branches.

## Regression evidence

The initial B1 run failed all four new reproductions: anonymous SELECT, anonymous EXECUTE, two non-invoker views and inactive seller client access. After hardening, [002_security.test.sql](tests/002_security.test.sql) exercises nonempty fixtures in both branches, a second seller in branch A, all nine seeded role/branch identities, a missing profile and a disabled seller. The **499 total assertions** include all **40 unchanged B1 assertions**.

The security tests check real role-switched queries and writes (`request.jwt.claims`, sub and `SET ROLE authenticated/anon`), frontend SELECT/RPC grants before test-only grants, all 23 tables, the three current frontend views, all ten views under anon, both public/private trigger ACLs and empty definer search paths. They cover allowed production/sale/dispatch/return/expense/GPS operations, same-branch peer and cross-branch denials, author spoofing, wrong-role RPC calls, branch/global administrator behavior, inactive/missing profiles, forbidden balance writes/deletes, initial-annulled stock movements, future dispatch dates and both expired flag values on product/container lines.

NaN and both infinity strings/casts are rejected for every writable monetary field; percentage 0 and 100 remain legal, 100.01 is rejected. A savepoint temporarily removes only the price-finiteness constraint to prove that generated-subtotal finiteness independently rejects NaN, then restores the original DDL. Full public-table JSON fingerprints prove rejected monetary calls and expired dispatch additions leave every row, timestamp, balance, load and audit row unchanged.

## Final local command evidence

Validation used Supabase CLI **2.111.0**, Docker and the project's PostgreSQL-17 stack. A fresh `supabase stop --no-backup` was followed by full `supabase start`, `supabase db reset --local`, `supabase test db --local`, the upgrade rehearsal and lint against the final migration. Command tails and advisor results are recorded below after the final run.

All commands below exited **0** on the final SQL source. No concurrent reset/test/rehearsal process was active at the final check.

`supabase start` rebuilt the empty stack and applied baseline → B1 → B2 before seeding; its credential-bearing connection summary is intentionally omitted. Safe start tail:

```text
Initialising schema...
Applying migration 20261013000000_remote_baseline.sql...
Applying migration 20261013000100_align_repo_design.sql...
Applying migration 20261013181647_harden_database_security.sql...
Seeding data from supabase/seed.sql...
```

`supabase db reset --local` tail:

```text
Restarting containers...
A new version of Supabase CLI is available: v2.120.0 (currently installed v2.111.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
A new version of Supabase CLI is available: v2.120.0 (currently installed v2.111.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
Finished supabase db reset on branch main.
{"target":"local","version":"","message":"Reset local database."}
```

`supabase test db --local` tail:

```text
Connecting to local database...
psql:/home/cristhian/orca/workspaces/ondina/fix-b2-seguridad/supabase/tests/001_schema_smoke.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/cristhian/orca/workspaces/ondina/fix-b2-seguridad/supabase/tests/001_schema_smoke.test.sql .. ok
psql:/home/cristhian/orca/workspaces/ondina/fix-b2-seguridad/supabase/tests/002_security.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/cristhian/orca/workspaces/ondina/fix-b2-seguridad/supabase/tests/002_security.test.sql ...... ok
All tests successful.
Files=2, Tests=499,  1 wallclock secs ( 0.04 usr  0.00 sys +  0.01 cusr  0.01 csys =  0.06 CPU)
Result: PASS
```

`bash supabase/tests/rehearse-upgrade.sh` preservation evidence:

```text
PASS: upgrade preserved all rows in 23 public tables and auth.users (counts + content hashes).
PASS: delta reapplied without duplicate objects or data/stock changes.
seller_load=17
warehouse_stock=105
empty_packaging=93
PASS: 20261013181647_harden_database_security.sql preserved all row counts and content hashes.
All tests successful.
Files=2, Tests=499,  0 wallclock secs ( 0.03 usr  0.01 sys +  0.02 cusr  0.01 csys =  0.07 CPU)
Result: PASS
```

`supabase db lint --local --schema public,private --fail-on error`:

```text
Connecting to local database...
Linting schema: public
Linting schema: private

No schema errors found
{"results":[],"message":"db lint"}
```

`supabase db advisors --local --type security --fail-on error`:

```text
Connecting to local database...
No issues found
{"results":[],"message":"db advisors"}
```

The local security advisor reports **zero findings**, and lint reports **zero warnings/errors**. Independent pgTAP catalog checks confirm zero non-invoker public views, zero anon application EXECUTE/SELECT, zero client-executable trigger/event-trigger functions and exactly three authenticated public RPCs. The two required definer RPCs (sale and correction) retain deliberate authenticated execution; their authorization is tested inside the functions. Private RLS helpers retain only the execution necessary for caller policies, not public API exposure. Remote Auth configuration and provider-level advisor findings were not inspected.

A final view catalog inspection found all **10 owners = postgres**, all **10 reloptions = {security_invoker=true}**, authenticated SELECT only on the three current frontend views, and no anon/PUBLIC ACL entries. Service-role ownership/platform privileges remain intact. Application defaults are probed by creating a temporary public table/function in the test transaction and verifying neither API role receives implicit grants.

Static validation: `bash -n supabase/tests/rehearse-upgrade.sh`, all changed Markdown relative file/anchor links and `git diff --check` passed. No frontend source/dependencies changed, so npm checks are outside this database-only scope.


## Final cleanup

After the validated work was committed, `supabase stop --no-backup` exited **0**:

```text
{"project_id_filter":"ondina-erp","backup":false,"message":"Stopped supabase local development setup."}
```

The final Docker inventory contains **no `ondina-erp` Supabase containers**. Commands never targeted the unrelated `postgres` or `elastic_hermann` containers; `postgres` retains its pre-existing stopped state and `elastic_hermann` was absent from both inventories. Three unrelated running containers were left untouched. The final report cleanup evidence is included by amending the same local commit; no push or merge occurred.

## Remote application and remaining limits

The eight new constraints deliberately remain NOT VALID even on the clean synthetic stack, avoiding any claim about uninspected production rows. [Reconciliation](reconciliation.md#deferred-monetary-constraint-validation) supplies a read-only eight-field data check and all eight exact `VALIDATE CONSTRAINT` statements for a later separately authorized, backed-up maintenance window. Existing invalid rows are not coerced/deleted; an update to such a row can fail until its repair is reviewed.

Local SQL covers database authorization and the current frontend's database contract, not browser behavior, a remote JWT/REST session, production advisor execution or a live Realtime subscription. No production data/catalog/ACL was fetched. B3/B5 still own full cancellation conservation, return caps/duplicate correction aggregation, reactivation, concurrency and the remaining business-integrity matrix; B4 owns publication/index/Auth follow-ups. The B1-only schema comparator intentionally rejects the B2 security differences; the documented diagnostic procedure resets to B1 for that comparison and restores the complete chain afterward. The upgrade rehearsal now applies each later forward migration once and verifies that every public/auth fixture row is preserved; only B1's delta is tested for idempotent reapplication.

References: [Supabase grants/RLS and invoker views](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html), [B1 evidence](validation-b1.md), [database guide](../docs/engineering/database.md).
