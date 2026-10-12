# Database and Migrations

## Sources and deployment gate

`bd/` contains SQL design/business objects; `supabase/migrations/` contains versioned changes. The remote schema and migration history are a third state requiring verification.
The [2026-10-09 audit](../archive/audits/2026-10-09/auditoria-integral-2026-10-09.md) found divergence. Do not run production `supabase db push` until isolated reconciliation and verification are complete.

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
Rebuild and test real SQL in isolation: roles, anonymous access, another sucursal, RPC grants, concurrency, stock and cancellation. Existing semicolon CI checks cannot establish this.
Discover commands through the installed CLI's `--help`, review generated migrations and preserve applied history. Serialize migration integration and never run two writers against the same database environment.
See [deployment](deployment.md) for release coordination. Track unresolved reconstruction, security and integrity findings in Beads/GitHub.
