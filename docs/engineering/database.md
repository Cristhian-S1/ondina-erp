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
See [deployment](deployment.md) for release coordination. For backups, PITR and the manual dump/restore
procedure (free plan) and the Pro plan requirement, read [backups and recovery](backups.md) (#41). Track unresolved reconstruction, security and integrity findings in Beads/GitHub.

## B3 business decisions — 2026-10-13

These coordinator-approved decisions apply to the forward B3 migration. See
[B3 validation](../../supabase/validation-b3.md) for dated local evidence and
[reconciliation](../../supabase/reconciliation.md) for the remote release gates.

- **D-COM-1 (#34):** select the commission rule whose `[vigente_desde, vigente_hasta)`
  contains the sale creation instant. `btree_gist` and an exclusion constraint
  prevent overlapping rules for a product type. Rates/type/start already used
  by a sale cannot be edited or deleted; an end can close prospectively without
  excluding any existing sale. A backdated new rule cannot reprice a prior sale,
  including one that originally had no rule. Sale insertion takes a shared rule
  table lock so concurrent rule writes cannot evade these history checks. The
  base is each line subtotal multiplied by `max(gross - discount, 0) / gross`
  (zero for a zero gross sale); ranking sums the same sale net total. Percentage
  and fixed components retain the existing combined formula, with a fixed
  amount counted once per sale/product type/rule. Round the final commission to
  two decimals, not each prorated line. Keep the existing `jornada` view columns.
- **D-TZ-1 (#35):** derive every business date from
  `(ts at time zone 'America/Santiago')::date`, and months from
  `date_trunc('month', ts at time zone 'America/Santiago')`. Ranking retains its
  `timestamptz` contract by encoding Santiago month start explicitly. Date empty
  container returns by their own creation instant, not the dispatch creation
  instant. `contar_ventas_jornada` computes today's count under caller RLS in
  SQL, independent of the browser timezone and daylight saving transitions.
- **D-INC-1 (#70):** `incidencias_produccion` is descriptive and never changes
  stock. `mermas` is a quantified loss and changes the indicated product or
  packaging balance. The existing production incidents page provides clearly
  separate forms; recording an incident does not implicitly create a loss.
  Record a real loss once using the loss form. New incidents store their
  operational branch, with actor and optional production association validated
  by RLS. Old incidents retain author-based visibility; no old loss is renamed,
  converted or automatically linked to an incident. The new branch-filtered UI
  shows explicitly scoped incidents; legacy rows remain preserved and need an
  authorized classification/branch review before inclusion in that list.
- **D-IDEM-1 (#42):** `registrar_venta`, `crear_despacho` and
  `registrar_devolucion` accept a final optional
  `p_idempotency_key uuid default null`. A non-null key is globally unique per
  operation kind and is serialized with a transaction advisory lock; the same
  authorized actor retrying it gets the original UUID without another stock
  movement or audit event. Keep keys for the lifetime of their business record;
  do not purge retry metadata without a retention decision. A null key preserves
  old callers' behavior. The client keeps a key for the same payload/identity
  after failure and creates a new one after success or a changed submission;
  this retention lasts for the mounted form, not across a browser reload.

## B3 movement and audit contract

Plant container stock is credited only when the containers physically return to
plant, and is consumed once by returnable production. A sale records containers
received by the seller without crediting plant; the seller container view shows
received minus returned quantities by business day (a negative daily net is a
movement total, not an assertion of negative plant stock). Historical sales from
the supplied baseline retain `envases_en_planta=true`, so their cancellation
undoes the original plant credit; new sales default to false. This is additive
provenance metadata, not a balance repair. Historical double counts still need
a separately authorized, evidence-based balance reconciliation.

Dispatch cancellation compensates the outstanding quantities after active
returns, then annuls those returns without compensating them again. It never
uses `greatest(balance, 0)` to hide an insufficient balance. All reversals use
`OLD` quantities/identity, repeated annulment is a no-op, already-annulled inserts
make no movement, and reactivation is rejected. Active movement lines cannot be
edited or deleted. Header discount changes recalculate the sale total. Product
packaging/type and packaging category cannot change once used by a historical
sale or production; new production also snapshots its consumed packaging.

Initial returns and administrator corrections lock the parent dispatch before
checking aggregate quantities. Product returns are cumulative and bounded by
dispatched totals; empty containers have no such cap. Corrections annul and
reinsert in one transaction and store `motivo` in return rows and audit events.
The trailing `p_motivo text default null` preserves the previous correction RPC
contract; an omitted reason records the explicit legacy-client marker
`Corrección de devolución (cliente anterior)`, while an explicit blank is
rejected. A future correction UI should require an actual operator reason.

Locks follow parent, warehouse/product UUID, seller/product UUID, then packaging
UUID; parent locks run in BEFORE INSERT triggers, before FK key-share locks.
RPC JSON iteration and aggregated return insertion are deterministic. The
current helper locks existing branch balances, trading branch-level contention
for a simple consistent order; validate throughput before changing that order.
Negative balances raise a reviewed Spanish P0001 and roll back the transaction.

Every business row write for sales/lines, dispatches/lines, returns, production,
losses, incidents, expenses, commission rules, configuration and all three
balances emits one audit event with authenticated actor, OLD/NEW JSON and reason
when applicable. Balance events use the branch or seller UUID as `registro_id`;
configuration uses the zero UUID, with its actual composite/text key retained in
JSON. SQL migrations/seeds or maintenance without a JWT actor may have a null
actor; authenticated application writes cannot spoof `auth.uid()`. Audit events
roll back with failed business operations and remain unavailable for client
mutation. No general correction, rule-administration, dispatch-adjustment or
warehouse-loss UI is introduced by B3.

## B4 indexes, Realtime and generated types — 2026-10-13

- Migration `20261013193000_b4_indexes_realtime.sql` (OND-5gi.8; GitHub #47, #48, BD-12). It adds four measured
  indexes, publishes `mermas` to `supabase_realtime` (`producciones` and `stock_envases` were already published by 0008),
  and recreates the B3 incident insert policy with `(select auth.uid())`. Nothing else changes.
- Each index is justified by a before/after `EXPLAIN (ANALYZE, BUFFERS)` plan change; the rejected candidates and
  the unindexed foreign-key decision are in [supabase/perf-b4.md](../../supabase/perf-b4.md).
- Plain `CREATE INDEX` blocks writes to the indexed table while it builds. Remote application requires the reviewed
  maintenance window described in that migration's header.
- Realtime must respect RLS for every subscriber; `supabase/tests/perf/realtime-rls-check.mjs` checks this on the
  local stack. Realtime `DELETE` events are not filtered by branch without `REPLICA IDENTITY FULL`; the application
  has no DELETE path, so this is not enabled.
- Frontend types come from `supabase gen types typescript --local --schema public` run on the full local chain.
  Regenerate them after every migration that changes the public schema.
- Auth settings and the remote dashboard checklist are in [auth.md](auth.md).

## B6 backend review fixes — 2026-10-13

Migration `20261013200000_b6_revision_fixes.sql` (OND-5gi.9; GitHub #29, #30, #31, #32, #33, #42) closes the
actionable findings of the [backend review R1](../archive/audits/2026-10-13/workers/revision-backend-ola-b.md)
(RB-1, RB-5, RB-9, RB-11, RB-15, RB-16). It is forward-only and rewrites no rows, balances or history. Local evidence
and the remote gates are in [reconciliation](../../supabase/reconciliation.md#b6-revision-r1-delta).

- **Dispatch cancellation (RB-1).** Outstanding stock is `dispatched − returned − active linked losses`. A loss
  linked to a dispatch already left the seller's load, so it is not returned to the warehouse when the dispatch is
  cancelled, and it stays recorded. Cancelling that loss after its dispatch was cancelled adds nothing. A linked
  loss may not exceed the outstanding quantity of its dispatch (`La merma supera lo despachado pendiente de ese producto.`),
  so the cancellation never computes a negative return. Container losses come from the plant pool and always
  compensate.
- **Sale lines (RB-9).** A line inserted into an annulled sale raises `La venta está anulada` (P0001).
- **Correction retries (RB-11).** `corregir_devolucion` takes a trailing `p_idempotency_key uuid default null` and
  uses the same `private.solicitudes_devolucion` ledger as `registrar_devolucion`. A replay of the same key returns
  without a second annul/reinsert cycle or audit row. Calls without a key keep the previous behavior. The return type
  stays `void`.
- **Profiles (RB-15).** `perfiles` rows are visible only to their owner and to branch administration. Bodega no
  longer reads seller `rut` or `telefono`; it lists active sellers of its branch through `vendedores_sucursal(p_sucursal_id)`,
  which returns only `id`, `nombres` and `apellidos`. History screens use `vendedores_historial_sucursal(p_sucursal_id)`
  ([migration](../../supabase/migrations/20261025163734_r1_14_vendedores_historial.sql)), which returns active and
  inactive sellers of the branch with only `id`, `nombres`, `apellidos` and `activo`, behind the same gate;
  `vendedores_sucursal` stays the source for new dispatches. Column grants cannot express "own row only", so the
  restriction is row-level. Policies that checked a seller as the caller now use `private.es_vendedor_activo(id, sucursal_id)`.
- **Client sellers (RB-16).** A client INSERT requires the seller to be an active `vendedor` of the same branch.
  The branch match was already enforced by `clientes_vendedor_id_sucursal_id_fkey`. The baseline grants no UPDATE on
  `clientes` and defines no UPDATE policy, so the check guards INSERT; any future UPDATE policy must repeat it.
- **Audit action check (RB-5).** `auditoria_accion_check` is `NOT VALID`; `VALIDATE` is a separate reviewed step in
  [reconciliation](../../supabase/reconciliation.md#b6-revision-r1-delta).
- **Frontend contract.** Every adapter that writes a retried operation requires its idempotency key
  (`ventas/api.ts`, `bodega/api.ts`); the adapters no longer generate one. A correction uses the same key lifecycle as
  the other flows.

### Documented decisions (no code change)

- **RB-3, custom unit price.** HU-01 allows unit prices other than the standard price
  ([sales story](../product/stories/sales.md#hu-01)). The server keeps the finite and non-negative checks. Comparing
  against `productos.precio_base` would contradict HU-01, so a price-deviation control needs a new story.
- **RB-10, container returns without a cap.** Empty containers need not come from the same dispatch, so
  `insertar_devolucion` does not cap them. Reconciling containers received in sales against containers returned is a
  business-risk follow-up, not a database invariant.
- **RB-19, ranking net of discount.** `v_ranking_vendedores.total_vendido` is `sum(ventas.total)`, which is net of the
  header discount. This follows the commission decision D-COM-1, row "Comisión" in
  [product context](../product/context.md). The B2 view summed gross line amounts; the B3 view sums net totals, and no
  migration note records the change. Reports must label the column as net.
- **RB-8, branch-level stock lock.** `bloquear_saldos` serializes stock writes per branch. Accepted at the current
  scale. Measure contention with `supabase/tests/concurrency-b3.py` before considering per-row locks in a fixed order.
- **RB-6, non-concurrent index creation.** The B1, B3 and B4 indexes use plain `CREATE INDEX`, which blocks writes
  while it builds. Acceptable at the measured remote volume (38 sales and 16 dispatches on 2026-10-13). Larger volumes
  need `CREATE INDEX CONCURRENTLY` outside a transaction, run as separate statements.
