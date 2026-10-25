# E5 — Dispatch Adjustments and Warehouse Losses

[Sprint 2 index](README.md)

## Objective

Deliver the UI for additive dispatch adjustments within the configured window (HU-26) and for warehouse/dispatch losses that count in the daily reconciliation (HU-29). Stock effects stay in the database.

## Covers

- HU-26 (#66, OND-w76.9).
- HU-29 (#67, OND-w76.10).

**Roles:** Frontend (`frontend/src/domains/bodega/**`), Backend/Supabase only for contract gaps, Testing. **Depends on:** E1. Independent of E2–E4, so it can run in parallel with them.

## Repository evidence

- **Window:** `public.trg_despacho_detalle_insert` raises "La ventana de ajuste del despacho expiró." once `ventana_ajuste_minutos` has elapsed. The default is 15 (`supabase/migrations/20261013184049_b3_data_integrity.sql:265-331`).
- **Story limits:** the window is configurable (15 minutes by default; the client suggested 10–20) and is additive only ([warehouse stories](../../product/stories/warehouse.md#hu-26)). The effective constraint is whole minutes 5–60 ([migration](../../../supabase/migrations/20261025175810_hu26_ventana_ajuste.sql)).
- **Losses table:** `public.mermas` has `despacho_id`, exactly one of `producto_id`/`tipo_empaque_id`, `cantidad > 0`, a mandatory `motivo` and `anulado`. Its insert policy lets bodega insert only within `mi_sucursal()` (`remote_baseline.sql:1152-1164, 2126`). `trg_merma_insert`/`trg_merma_anular` own the stock effect.
- **Frontend:** the bodega pages call the RPCs `crear_despacho`, `registrar_devolucion` and `corregir_devolucion` (`bodega/api.ts`). `Despachos.tsx` and `Devoluciones.tsx` are large components (#86).

## Options — HU-26

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Frontend inserts extra `despacho_detalles` rows directly; the trigger enforces the window | No new SQL | Depends on table-level insert grants; no idempotency key, so retries can duplicate (the #42 class of bug) | S (FE 1–2 d) |
| B. New RPC `ajustar_despacho(p_despacho_id, p_productos jsonb, p_idempotency_key uuid)` that inserts detail rows (trigger still enforces the window) and writes the audit row | Matches the `crear_despacho`/`corregir_devolucion` contracts; idempotent; one error contract for the UI | One migration plus pgTAP | M (BE 1–2 d + FE 2 d) |
| C. Extend `crear_despacho` with an "append" mode | One entry point | Overloads a function that is already hardened; riskier review | M |

**Recommendation: B.** It is consistent with the idempotency guarantees from #42 and keeps the additive rule and audit in the database. Decision 2026-10-25: the window stays configurable in `public.configuracion.ventana_ajuste_minutos` (default 15) and the database accepts whole minutes from 5 to 60 (`configuracion_ventana_ajuste_minutos_rango`, [migration](../../../supabase/migrations/20261025175810_hu26_ventana_ajuste.sql));
bodega reads the configured minutes and the server clock through `public.ventana_ajuste_despacho()`, and the database always decides; the UI hint only corrects device clock skew.

## Options — HU-29

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Bodega form inserting into `mermas` via `api.ts`, reusing the production merma form pattern | Table, policy and triggers already exist | No idempotency; reconciliation view still missing | S–M (FE 2 d) |
| B. RPC `registrar_merma_bodega(...)` with an idempotency key plus a daily reconciliation view (dispatched − sold − returned − losses) per seller and day | Satisfies the "cuadre" criterion; retry-safe | Requires agreeing the reconciliation formula with the business | M (BE 2 d + FE 2–3 d) |

**Recommendation: B.** The story asks for losses to count in the daily reconciliation, and a table insert alone does not provide that. Ratify the reconciliation formula in E1 or at the start of E5.

## Acceptance criteria

- [ ] An adjustment within the window adds quantities and lowers stock; one after the window is rejected by the database with the documented message (pgTAP).
- [ ] An adjustment cannot reduce or edit existing lines (pgTAP).
- [ ] Repeating an adjustment or loss with the same idempotency key creates no duplicate (pgTAP).
- [ ] A loss without a reason is rejected client-side and by the database.
- [ ] A loss lowers stock once and is not re-entered; cancelling it compensates through `trg_merma_anular` (pgTAP).
- [ ] Bodega of sucursal A cannot register losses for sucursal B (pgTAP).
- [ ] No stock arithmetic in `frontend/src/domains/bodega/**` (review).
- [ ] `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`.

## Verification

`supabase test db`; the frontend commands; an integration test in `frontend/tests/integration` against local Supabase; a mobile check at 375/412 px.

## Risks

- Clock skew between client and server; the window is evaluated in the database, so the UI only shows the remaining time as a hint.
- Touching `Despachos.tsx` while #86 refactors it; assign one Frontend owner for both.
