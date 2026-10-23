# E6 — Corrections and Cancellation with Traceability (HU-13)

[Sprint 2 index](README.md)

## Objective

Administrators cancel or correct sales, dispatches, production and expenses with a mandatory reason and a visible audit history. Stock compensation always runs through the existing database triggers.

## Covers

- HU-13 (#61, OND-w76.4).

**Roles:** Backend/Supabase, Frontend (`administracion`, `Auditoria.tsx`), Security/review (mandatory), Testing. **Depends on:** E2 (admin role in the UI). E3 and E5 add new record types to cover.

## Repository evidence

- `private.proteger_movimiento` covers nine movement tables. It blocks DELETE and reactivation, and blocks edits except `anulado`, `modificado_*`, `observaciones`, `descuento` and `total` (`supabase/migrations/20261013184049_b3_data_integrity.sql:52-70`). A quantity or product correction therefore means cancelling and re-registering.
- Cancellation triggers (`trg_venta_anular`, `trg_despacho_anular`, `trg_produccion_anular`, `trg_merma_anular`, `trg_devolucion_*_anular`) own the stock compensation ([database](../../engineering/database.md)).
- `public.corregir_devolucion` is the reference pattern (`20261013200000_b6_revision_fixes.sql:207-237`): admin and sucursal check, actor = `auth.uid()`, non-blank reason, idempotency key with advisory lock, `for update` lock and `ondina.motivo`.
- `gastos_extras` has no cancellation trigger and is not covered by `proteger_movimiento`. Its correction semantics are undefined.
- `public.auditoria` has an admin/sucursal SELECT policy but no SELECT grant. `supabase/tests/002_security.test.sql:81` asserts that.

## Options

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Per-type RPCs modelled on `corregir_devolucion` (`anular_venta`, `anular_despacho`, `anular_produccion`, `corregir_venta` = cancel + re-register in one transaction with a `corrige_a` link), plus `historial_registro(tabla, id)` | Reuses DB compensation; reversal-and-repost keeps history ([Fowler, accounting patterns](https://martinfowler.com/eaaDev/AccountingNarrative.html); [compensating transaction](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction), 2026-04-20) | Many RPCs and pgTAP cases; needs the ratified correction matrix | L (6–9 d) |
| B. Generic "edit any field" RPC with JSON patches | One endpoint | Conflicts with `proteger_movimiento`; cannot express compensation; high risk | M, not advised |
| C. Cancellation only (no in-place correction), user re-enters the right record; audit-history read RPC | Smallest; triggers exist | Two-step UX; no original → correction link unless added | M (3–4 d) |

**Recommendation: C in Sprint 2, then A's `corrige_a` link once the #61 matrix is ratified.**
- Expose audit history through a function that returns selected columns scoped by sucursal, not a raw SELECT grant on `auditoria`.
- That keeps the `002_security` assertion valid and avoids shipping other sucursales' full OLD/NEW JSON.
- Define the expense rule (add `gastos_extras` to `proteger_movimiento` plus a cancellation flag) in E1, because [E7](e07-gasto-receipt-whatsapp.md) attaches receipts to the same rows.

## Acceptance criteria

- [ ] Cancelling a sale compensates stock/carga exactly once; a second cancellation fails without a second movement (pgTAP).
- [ ] Reactivation and DELETE on movement tables fail (pgTAP).
- [ ] A non-admin or cross-sucursal cancellation is denied; a blank reason fails (pgTAP).
- [ ] The same idempotency key twice has one effect; a reused key with a different payload fails (pgTAP).
- [ ] A failure mid-RPC rolls back both stock and audit (pgTAP).
- [ ] An admin sees audit history only for their sucursal (all if global); others and `anon` get nothing; `authenticated` cannot UPDATE/DELETE `auditoria` (pgTAP).
- [ ] No compensation arithmetic in `frontend/src` (review).
- [ ] `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`.
- [ ] Security/review verdict: pass.

## Verification

`supabase test db`; the frontend commands; an integration test for one end-to-end cancellation.

## Risks

- "Registros cerrados" is undefined.
- Cancelling a dispatch after related returns exist must be rejected; enumerate those cases in pgTAP.
- Trigger-based audit is not compliance-grade ([supa_audit maintainer note](https://github.com/supabase/supa_audit/issues/31)); acceptable for internal traceability.
