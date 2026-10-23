# E4 — Customer History and Inactive Alerts

[Sprint 2 index](README.md)

## Objective

Give sellers and administrators a purchase history per customer (HU-11), then alerts for customers without recent purchases (HU-12).

## Covers

- HU-11 (#59, OND-w76.2).
- HU-12 (#60, OND-w76.3), which is blocked in Beads by OND-w76.2.

**Roles:** Backend/Supabase (access path, pgTAP), Frontend (`ventas` and/or `administracion` pages), Testing. **Depends on:** E1. HU-12 starts after HU-11 is accepted.

## Repository evidence

- `public.v_historial_cliente` and `public.v_clientes_inactivos` exist with `security_invoker = true`. Both have SELECT revoked from `authenticated` and granted only to `service_role` (`supabase/migrations/20261013184049_b3_data_integrity.sql:943-976`). The frontend cannot read them today.
- The inactivity threshold is the `configuracion` key `dias_inactividad_cliente` (seeded as 30 in `supabase/seed.sql:51`). Both views use America/Santiago dates and exclude cancelled sales (`not v.anulado`).

## Options

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Grant SELECT on the two views to `authenticated` and rely on `security_invoker` so the RLS on `clientes`/`ventas` applies | Smallest change; reuses the existing views | Exposure depends on every underlying policy staying correct; aggregation over RLS can be slow (#47); no pagination contract | S (1 d BE + 1–2 d FE) |
| B. `security invoker` RPCs `historial_cliente(p_cliente_id, p_desde, p_hasta, p_limit, p_offset)` and `clientes_inactivos(p_sucursal_id)` that read the views/tables with explicit role/sucursal checks | Stable, typed contract; pagination; pgTAP can target the function; matches the existing `vendedores_sucursal` RPC pattern | More SQL; two contracts to maintain | M (2 d BE + 2 d FE) |
| C. Materialized summary table refreshed by trigger or pg_cron | Fast reads at scale | Staleness; refresh jobs; overkill for current volume [uncertain: no production volume measured here] | L |

**Recommendation: B.** It keeps the views service-only and makes the access rule explicit and testable. It also gives HU-14 (E9) a reusable contract. Keep the RPC `security invoker` so RLS still applies, and add the explicit checks as defense in depth.

For HU-12 the alert surface needs its own choice:

| Alert option | Pros | Cons |
| --- | --- | --- |
| In-app list/badge on the seller's Clientes page and the admin page | No new infrastructure | Seen only when the app is open |
| Push/WhatsApp notification | Proactive | Same limits as [E7](e07-gasto-receipt-whatsapp.md); outside the HU-12 text |

Recommended: the in-app list, with the threshold editable by an administrator.

## Acceptance criteria

- [ ] A seller sees history only for customers of their sucursal (pgTAP with two sucursales and two sellers).
- [ ] An administrator sees history for any customer of the sucursal they selected.
- [ ] Cancelled sales are excluded from the totals (pgTAP fixture).
- [ ] With threshold N, a customer whose last purchase was N+1 days ago (America/Santiago) appears in the inactive list, and one at N days does not.
- [ ] `anon` gets no rows from any new function.
- [ ] `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`.

## Verification

`supabase db reset` + `supabase test db` locally; the frontend commands from `frontend/`; a responsive check at 375/768/1280 px (cards below 640 px per [frontend conventions](../../engineering/frontend.md)).

## Risks

- Date-boundary errors around midnight in Santiago; reuse the existing timezone expressions.
- Query cost under RLS; measure with `EXPLAIN` as in #47.
