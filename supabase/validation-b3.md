# B3 integrity validation — 2026-10-13

Scope: OND-5gi.7; GitHub #31, #32, #33, #34, #35, #42, #70;
BD-02..BD-14 as applicable to integrity (B2 authorization and B4 performance/
Realtime/type generation remain separate work). This report records isolated
local evidence, not a production guarantee or authorization to deploy.

## Changes and decisions

The forward migration is `20261013184049_b3_data_integrity.sql`. See the
[database decisions](../docs/engineering/database.md#b3-business-decisions--2026-10-13)
for D-COM-1/D-TZ-1/D-INC-1/D-IDEM-1, cancellation semantics, audit composite keys,
legacy correction reasons and historical container-credit provenance.
[Reconciliation](reconciliation.md#b3-remote-gates-and-frontend-sequencing)
describes remote data gates and SQL-before-frontend sequencing.

The frontend commit is intentionally separate and last. It routes initial
product/container returns through one RPC, retains a retry key per mounted form
submission, separates descriptive incidents and quantified losses, and adds only
reviewed Spanish business errors to the public catalog. It retains the existing
branch selectors and dispatch Dialog.

## Environment and commands

Supabase CLI 2.111.0, local PostgreSQL 17 via `supabase_db_ondina-erp`, synthetic
fixtures only. No remote Supabase, linking/push, Vercel, GitHub/Beads writes or
unrelated-container operations were performed. The Supabase changelog and
PostgreSQL range/locking documentation were checked before implementation;
[range constraints](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT)
and [explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
support the exclusion/lock choices.

Run sequentially, never against the same database as another worker:

```bash
supabase start
supabase db reset --local
supabase test db --local
supabase db lint --local --schema public,private --fail-on error
bash supabase/tests/rehearse-upgrade.sh
python3 supabase/tests/concurrency-b3.py
# The concurrency script commits synthetic rows; restore the clean fixture.
supabase db reset --local
supabase test db --local
supabase stop --no-backup
```

From `frontend/`: `npm run lint`, `npm run build`, `npm run size`, `npm run test`.

## Evidence

All commands below exited 0 on 2026-10-13. The clean reset applied all four
migrations and synthetic seed; the upgrade rehearsal reset to the supplied
baseline, applied B1 twice, applied B2/B3 once, then returned to a fresh full-chain
reset and repeated pgTAP. Relevant tails:

```text
supabase db reset --local
Applying migration 20261013000000_remote_baseline.sql...
Applying migration 20261013000100_align_repo_design.sql...
Applying migration 20261013181647_harden_database_security.sql...
Applying migration 20261013184049_b3_data_integrity.sql...
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch main.
# The CLI's local database branch label is main; the Git branch is
# Cristhian-S1/fix-b3-integridad.

supabase test db --local
001_schema_smoke.test.sql .. ok
002_security.test.sql ...... ok
003_integrity.test.sql ..... ok
All tests successful.
Files=3, Tests=597
Result: PASS

supabase db lint --local --schema public,private --fail-on error
Linting schema: public
Linting schema: private
No schema errors found

bash supabase/tests/rehearse-upgrade.sh
PASS: upgrade preserved all rows in 23 public tables and auth.users (counts + content hashes).
PASS: delta reapplied without duplicate objects or data/stock changes.
PASS: 20261013181647_harden_database_security.sql preserved all row counts and content hashes.
PASS: 20261013184049_b3_data_integrity.sql preserved all row counts and content hashes.
Files=3, Tests=597
Result: PASS

python3 supabase/tests/concurrency-b3.py
PASS: concurrent 7 + 7 against dispatch 10 serializes parent; second rejects; final returned=7.
PASS: simultaneous same-key return returns identical UUID; one return row and one stock movement.
PASS: concurrent sale and post-commit retry reuse original UUID; only one sale persists.
PASS: opposite product orders complete; dispatch retry creates no additional dispatch.
PASS: exact final warehouse=89 and seller load=30; no stock backfill or duplicate effect.

npm run lint
> eslint .
# exit 0
npm run build
> tsc -b && vite build
# exit 0
npm run size
[bundle] Presupuesto OK.
npm run test
Test Files 43 passed (43)
Tests 508 passed (508)
```

The SQL total is B1 **40**, B2 **459**, B3 **98** assertions. Local Markdown
links/anchors, shell syntax and `git diff --check` were verified. The independent
concurrency fixture was discarded by the final upgrade rehearsal/reset; no
concurrency rows remain in the normal seed state.

Local stack shutdown also exited 0:

```text
supabase stop --no-backup
{"project_id_filter":"ondina-erp","backup":false,"message":"Stopped supabase local development setup."}
```

No `supabase_*ondina-erp` containers remain running. Other workers' containers
were neither stopped nor otherwise operated on.

## Coverage and deliberate limits

- pgTAP covers exact audit reproductions: sale/return/production container counts,
  partial-return dispatch annulment, OLD-valued loss/production reversal,
  repeated annulment/reactivation, already-annulled inserts, negative balances,
  aggregate duplicates, whole-operation rollback, correction reasons,
  historical/prorated net commissions, interval boundaries, Santiago dates/DST,
  incident role/branch/actor isolation and audit trigger coverage.
- The two-session script proves a blocked second session before releasing the
  first transaction: concurrent 7+7 returns against dispatch 10; same-key return
  and sale; a post-commit retry; opposite product orders; exact final balances.
- B1/B2 suites remain active. Their monetary constraint probes
  explicitly suspend B3 history guards only for the privileged fixture,
  separately testing the underlying finite-money constraints. Successful rate
  boundary probes are audited; rejected probes preserve all rows. B3 independently
  tests the stricter history guards. Expected ACLs include the two new RPCs and
  incident SELECT/INSERT; no other B2 permissions are expanded.
- BD-11 payload/catalog validation is covered together with B2: inactive
  products, malformed container arrays and nonpositive return quantities are
  rejected. BD-12 Realtime and BD-13 index/performance work remain B4 concerns.
  **BD-14 / #62 remains open:** the retained `v_cuadre_despacho` still attributes
  sales by seller/product/day, so two same-day dispatches can share the same
  sales total. B3 changes its timezone only; choosing sale-to-dispatch attribution
  requires a separate business/schema decision outside these seven issues.
- No HU-13 general correction UI, HU-15 rule admin UI, HU-26 adjustment UI or
  HU-29 warehouse losses flow is implemented. No historical stock backfill,
  monetary rewrite, loss-to-incident conversion, automatic legacy incident
  classification or production data cleanup is performed.
- Retry-key retention is in the mounted form; reload persistence and durable
  offline outboxes are outside this bugfix. Legacy callers omitting retry keys
  retain non-idempotent behavior. Commission rule overlap and historical stock
  anomalies require remote preflight/reconciliation; the migration fails rather
  than repairs those conditions silently.
- Local pgTAP, direct PostgreSQL sessions and frontend mocks do not certify real
  production REST/JWT, Realtime delivery, load/latency or cross-session browser
  behavior. B4 owns generated frontend DB types; the service adapters keep the
  existing casts for new columns/RPCs until that snapshot is regenerated.
