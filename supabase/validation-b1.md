# B1 validation report — 2026-10-13

## Result and provenance

B1 / OND-5gi.5 is implemented on `Cristhian-S1/fix-b1-reconciliar`, based on `059172a020a89023d31aef0204f7d6b0a4e688b6` (`origin/develop` at dispatch). GitHub #28's reconstruction/reconciliation work and #40's real SQL CI foundation are delivered; neither issue's broader production/security acceptance is asserted closed. No GitHub/Beads writes, remote Supabase connection, link, db push, Vercel call, Git push or deployment occurred.

The supplied schema/roles files were read from the coordinator's absolute scratchpad paths, without querying production. The source schema SHA-256 is `dec1d59d22d89390ef4309fa9c6878c2df713a7025ac071c22c76ed32177a4dd`. The dump's PostgreSQL-17 replay was checked using Supabase CLI **2.111.0** and the CLI image **public.ecr.aws/supabase/postgres:17.6.1.156**; SQL `version()` reported **PostgreSQL 17.6**.

## Delivered changes

- CLI-generated `config.toml`: local project `ondina-erp`, PostgreSQL major 17, signup disabled. The pre-existing CLI `.gitignore` already has `.branches`/`.temp`, so it required no change.
- Faithful supplied baseline + forward delta; all ten previous migration files moved byte-for-byte to `legacy-migrations/` with a warning README.
- Delta adds 3 trigger helper functions, 6 secured report views, 15 trigger bindings, 21 historical secondary indexes, 1 incident CHECK as NOT VALID, 3 Realtime publication bindings and 4 replacements restoring 0008 production RLS intent. No table/column/data deletion or stock backfill.
- Synthetic seed with 2 sucursales, all four roles in each, an additional global administrator without sucursal, 2 customers, 6 sale products, 7 packaging types and representative stock/load. No real names/RUTs, passwords or login identities.
- pgTAP smoke suite, a reproducible baseline-to-delta data-preservation rehearsal and a read-only schema-comparison utility.
- `migrations-check` now pins setup-cli by full SHA (`b60b5899c73b63a2d2d651b1e90db8d4c9392f51`, verified v1.6.0) and CLI 2.111.0, runs db start/reset/pgTAP, captures database logs on failure and always stops without backup; timeout 20 minutes, display name `Validar migraciones Supabase`. YAML comparison confirms every other job and workflow-level field is unchanged.
- [Reconciliation matrix and later production procedure](reconciliation.md) and [database guide](../docs/engineering/database.md) explain the retained design, deployment gates, backup/repair/dry-run/apply/verification/recovery and known limits.

## Clean reconstruction and SQL tests

`supabase start` exited **0**; `supabase db reset --local` exited **0**, and `supabase test db --local` exited **0** on the final source. A separate fresh `supabase stop --no-backup` → `supabase db start` → reset → test run also passed, exercising the exact database-only CI approach. The final suite has **40 passing assertions**: exact 23-table/10-view inventory, all public tables with RLS, expected functions, commission `jornada`, nullable global-admin branch, secure exposure of new objects, authenticated production stock/packaging/audit and ordinary merma cancellation/audit.

Final reset output tail (ANSI colors removed):

```text
Seeding data from supabase/seed.sql...
Restarting containers...
A new version of Supabase CLI is available: v2.120.0 (currently installed v2.111.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
A new version of Supabase CLI is available: v2.120.0 (currently installed v2.111.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
Finished supabase db reset on branch main.
{"target":"local","version":"","message":"Reset local database."}
```

The CLI's local database branch label `main` in that message is independent of the Git worktree branch shown above.

Final pgTAP output tail:

```text
Connecting to local database...
psql:/home/cristhian/orca/workspaces/ondina/fix-b1-reconciliar/supabase/tests/001_schema_smoke.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/cristhian/orca/workspaces/ondina/fix-b1-reconciliar/supabase/tests/001_schema_smoke.test.sql .. ok
All tests successful.
Files=1, Tests=40,  0 wallclock secs ( 0.02 usr +  0.01 sys =  0.03 CPU)
Result: PASS
```

## Baseline-to-delta update rehearsal

`bash supabase/tests/rehearse-upgrade.sh` exited **0**. It reset to the supplied baseline, seeded synthetic rows, recorded a sale of 3, production of 7 and a plant loss of 2, then fingerprinted all 23 public tables and auth.users. Counts and deterministic JSON-content hashes matched exactly after applying the delta and after applying it again; this includes IDs, relationships, timestamps, historical audit rows and all balances. Reapplication also proves idempotent object creation, policies and publications.

```text
PASS: upgrade preserved all rows in 23 public tables and auth.users (counts + content hashes).
PASS: delta reapplied without duplicate objects or data/stock changes.
seller_load=17
warehouse_stock=105
empty_packaging=93
```

Seller load 20→17 stayed 17 through both delta applications, demonstrating that the omitted 0007 sales backfill cannot double-deduct that sale (BD-03 / BACK-N14). The rehearsal ends with a normal clean reset and pgTAP run; all rows are synthetic and local. Its earlier end-of-script test run had 37 assertions, before three additional new-object ACL/view checks were added; the final reconstruction and database-only run above passed all 40.

## Dump comparison

After final reset, both `supabase db dump --local --schema public` and a full application-schema local dump succeeded. The original supplied dump also includes private helpers, so the full dump checks those separately. `supabase/tests/compare-schema.py` tokenizes statements outside quoted strings/function bodies, normalizes outer whitespace/CRLF and compares statement multisets. Existing public object definitions/ACL statements must remain identical; only the named delta objects, four replaced policy definitions and three publication additions are allowed.

```text
Public-only dump also emits CLI-owned public schema creation/owner boilerplate; excluded from application-object comparison.
PASS: public dump: 452 remote statements; 525 local statements; 4 replaced policy definitions; 77 documented added/replacement statements.
Added objects: 3 functions, 6 views, 15 triggers, 21 secondary indexes, 1 NOT VALID CHECK, 3 Realtime bindings; 4 policies replaced.
PASS: all 11 private-schema statements unchanged.
PASS: all existing public tables/columns/constraints, functions, views, stock triggers, remaining policies and ACL statements unchanged.
Whole dump: one CLI-managed extension difference outside public (pg_net); no other unexplained statements.
```

There are **no unexplained application differences**. Explicit environment-only exclusions are public-schema creation/owner boilerplate emitted by `--schema public`, and CLI's `pg_net` extension outside public. The baseline includes one ACL replay reset for `v_indicadores_produccion_diarios`, because local Supabase defaults otherwise leave extra anon rights absent from the supplied snapshot; final ACLs now reproduce the snapshot. No application constraints, existing stock functions/triggers, RPC arguments, remaining policies or old ACLs changed.

The schema comparator and [reconciliation matrix](reconciliation.md) provide the reproducible object-level audit trail. Final dumps and the supplied snapshot contain no data rows; temporary outputs remain outside the repository.

## Negative checks of the SQL gate

Deliberate faults were injected **locally**, verified to return nonzero and removed/restored before final reset:

| Fault | Command | Exit / evidence |
| --- | --- | --- |
| Disable clientes RLS | `supabase test db --local` | 1; every-public-table RLS assertion fails (have 1, want 0) |
| Disable trg_produccion_insert | `supabase test db --local` | 1; expected warehouse/packaging balances fail |
| Add migration with nonexistent SQL type | `supabase db reset --local` | 1; type THIS_IS_NOT_A_TYPE does not exist |
| Recreate existing sales detail trigger | `supabase db reset --local` | 1; SQLSTATE 42710, trg_venta_detalle_insert already exists |

The temporary negative migration is absent from the final tree. These checks prove the real commands fail where the former semicolon test would pass; hosted GitHub Actions itself was not run or modified remotely.

## Cleanup and static checks

Final `supabase stop --no-backup` exited **0**:

```text
{"project_id_filter":"ondina-erp","backup":false,"message":"Stopped supabase local development setup."}
```

Final Docker inventory has **no ondina-erp Supabase containers** (indeed no Supabase containers matched at the check). No commands targeted the pre-existing `postgres` or `elastic_hermann` containers; unrelated concurrent containers were left alone. `postgres` remained stopped with its pre-existing exit state.

TOML parses with project_id ondina-erp / major 17 / signup false; CI YAML parses; workflow job ownership is verified; Bash syntax passes; all new/changed relative Markdown links resolve; the ten archived SQL files are byte-identical to the base commit; `git diff --check` passes. No frontend files changed, so frontend lint/build/tests were outside this task. A per-command `core.hooksPath=/dev/null` commit override avoids the configured Beads hooks and honors the dispatch's explicit no-Beads-writes boundary; the SQL/static checks above were run directly.

## Remaining work and release limits

- B2 owns existing view security/ACLs, RLS by sucursal/active profile, RPC grants and nonfinite monetary input; the full anonymous/all-role/two-sucursal/inactive-profile matrix must be added there.
- Integrity tasks own mutable quantities, reactivation, already-annulled inserts, cancellation conservation, partial returns, concurrency and commission-history semantics (BACK-N2..N7/N9..N13). The newly restored ordinary merma reversal retains historical semantics and does not resolve BACK-N6.
- The incident CHECK is NOT VALID to preserve existing potentially invalid history; review/repair that data deliberately before validation. No production data was available for such a review.
- Generated frontend commission types still say `mes`; the live service expects `jornada`, which this baseline preserves. Type regeneration remains in the separately owned frontend task.
- The coordinator owns required-check renaming, integration, any later authorized production ledger repair and deployment. The procedure is documented, not executed; passing local checks is not production authorization or full closure of #28/#40.
