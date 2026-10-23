# E9 — Reports, Exports and Status Closeout (HU-14)

[Sprint 2 index](README.md)

## Objective

Administrators see and export sales, expenses (with receipts) and commissions by period, seller and product, within their scope. The screen and the export must agree. After that, refresh the story status matrix with fresh evidence.

## Covers

- HU-14 (#62, OND-w76.5).
- The [story status](../user-stories.md) discrepancy: follow-ups listed as open there are closed on GitHub.

**Roles:** Backend/Supabase, Frontend (`administracion/pages/Reportes.tsx`), Documentation, Testing. **Depends on:** E3, E4, E6 and E7 (the data each report consolidates).

## Repository evidence

- Invoker views `v_cuadre_despacho`, `v_ventas_diarias`, `v_ventas_producto`, `v_historial_cliente` and `v_clientes_inactivos` exist with `security_invoker = true`. They are granted only to `service_role` (`supabase/migrations/20261013184049_b3_data_integrity.sql:893-988`).
- `Reportes.tsx` is a placeholder.
- The first report set must be "aprobado con negocio" (#62), with an explicit rule for cancelled sales. The export format (CSV vs. Excel) and the meaning of "tiempo real" are undecided.

## Options

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Grant SELECT on the existing views to `authenticated` and filter with PostgREST parameters | Fast; base-table RLS applies ([views](https://supabase.com/docs/guides/database/views)) | Per-row RLS over large scans; weekly/monthly grouping needs new views; no shared export contract | S–M (2–4 d) |
| B. `security invoker`, `stable` report RPCs (`reporte_ventas(p_desde, p_hasta, p_vendedor, p_producto, p_agrupacion)`, `reporte_gastos`, `reporte_comisiones`) with server-side aggregation, Santiago day boundaries, an explicit cancelled-sales rule and a row limit | One contract for screen and export; pgTAP against fixtures | More SQL | M (4–5 d) |
| C. Materialized views refreshed by cron | Fast at scale | Materialized views do not apply RLS, so they must not be exposed; staleness; overkill | L |

**Recommendation: B.**
- Build the CSV client-side from the same RPC result.
- Quote every field and neutralize text cells that start with `= + - @`, tab or CR, while keeping numbers numeric ([OWASP CSV injection](https://owasp.org/www-community/attacks/CSV_Injection)).
- Interpret "tiempo real" as refresh-on-open plus a manual refresh. Realtime would need a separate decision.

## Acceptance criteria

- [ ] Report totals equal the fixture SQL sums, with cancelled sales handled by the ratified rule (pgTAP).
- [ ] A sucursal-1 admin cannot see sucursal-2 rows; vendedor and `anon` are denied (pgTAP).
- [ ] A sale at 23:59 and one at 00:01 America/Santiago fall on different days (pgTAP).
- [ ] The CSV of a filtered view has the same row count and totals as the screen (component test).
- [ ] A text cell starting with `=` is neutralized in the CSV (unit test).
- [ ] Expense rows link to their receipt through a short-lived signed URL, never a public URL ([E7](e07-gasto-receipt-whatsapp.md)).
- [ ] The status matrix rows for every Sprint 2 story cite dated evidence in Beads.
- [ ] `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`.

## Verification

`supabase test db`; the frontend commands; a link check of edited documents.

## Risks

- Exports contain personal data (customers, sellers); restrict them to administrators and note retention in the export UI.
- Large ranges; enforce a maximum range or pagination in the RPC.
