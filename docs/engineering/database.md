# Database and Migrations

## Sources and deployment gate

`bd/` contains historical SQL design/business objects. `supabase/migrations/` is the active production-snapshot baseline plus forward-only deltas; the former 0001..0010 files are archived under `supabase/legacy-migrations/` and must not be executed.
Read [schema reconciliation](../../supabase/reconciliation.md) for the object inventory, synthetic upgrade rehearsal, known security/integrity limits and later authorized migration-ledger repair procedure. The supplied 2026-10-13 snapshot was verified locally; this is not a current production guarantee or authorization to deploy. Do not run production `supabase db push` until fresh schema/history reconciliation, isolated verification and the separate security/integrity release gates are complete.

## Required invariants

- Supabase Auth owns credentials; `perfiles.id` references `auth.users.id`. Never store application passwords.
- RLS, grants, views and RPC authorization must enforce identity, role, active profile and sucursal. A navigation check does not provide database authorization.
- Triggers/transactions own `stock_bodega`, `stock_envases` and `carga_vendedor`. Cancellation compensates each movement once and retains its audit trail; reactivation must not silently recreate movements.
- Preserve historical sale prices and commission rules. A new catalog/configuration value must not rewrite past monetary results.
- Dispatch adjustments append quantities within the configured window; they do not edit/subtract recorded lines.
- Return corrections are administrator-only, atomic annul-and-reinsert operations. Product returns are bounded by dispatched quantities; empty-container returns have no equivalent upper cap. Recheck authorization and stock consistency inside the transaction.
- The existing return-correction flow changes quantities on the recorded product/container lines, retaining audit context; catalog-line changes need a separate approved decision.
- Dispatch containers are `uso_interno` packaging; their dispatch/return/cancellation participates in container stock and audit history.

These are required behavior and retained design decisions, not a claim that the deployed schema already satisfies them.

## Change workflow

Read the `supabase` and `supabase-postgres-best-practices` skills. Confirm the exact local/staging project before writes; a linked remote does not authorize an ad hoc change.
Rebuild with pinned Supabase CLI 2.111.0 and Docker: `supabase start`, `supabase db reset --local`, `supabase test db --local`; stop this project's containers with `supabase stop --no-backup` when finished. `supabase/tests/rehearse-upgrade.sh` exercises the baseline-to-delta upgrade using synthetic rows and exact data fingerprints. The SQL CI job executes reset and pgTAP against a local database, without production credentials.
The SQL suite includes B1 reconstruction/stock smoke tests and B2 role, branch, inactive-profile, RPC/default ACL, dispatch deadline and nonfinite-money rollback tests. Run `supabase db lint --local --schema public,private --fail-on error` too. The eight B2 monetary checks remain NOT VALID until a separately authorized remote data review and validation scan; the exact procedure is in the reconciliation guide. Extend the remaining concurrency/stock/cancellation cases as integrity tasks land; local SQL success does not establish production REST or Realtime authorization safety.
Discover commands through the installed CLI's `--help`, review generated migrations and preserve applied history. Serialize migration integration and never run two writers against the same database environment.
See [deployment](deployment.md) for release coordination. Track unresolved reconstruction, security and integrity findings in Beads/GitHub.
