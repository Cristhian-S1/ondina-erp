# HU-29 — bodega losses and daily reconciliation (browser verification)

- **Date:** 2026-10-25
- **Branch:** `Cristhian-S1/t3-test-hu29`, based on `ccafbda` (`docs(db): record HU-29 bodega losses and the security review`), UI `f395e28`, database `9398a30`
- **Beads:** `OND-w76.10` (HU-29, GitHub #67)
- **Requirement:** `/mermas` must register a bodega-stock or in-transit loss with an explicit origin, positive quantity, mandatory reason and idempotent retry; only administration may annul a loss with its own reason. `/cuadre-diario` must default to today, reject ranges over 31 days, show the seller/product daily movements, label inactive sellers from the historical roster and state explicitly when the load comparison is unavailable. Both pages must work at 375, 412, 768 and 1280 px without horizontal page overflow, with primary actions of at least 44 px.
- **Result:** **PASS** — 18/18 scenario/viewport combinations passed on the final run, with no unexpected browser errors, no unexpected endpoints and no database writes other than `registrar_merma_bodega` and `anular_merma_bodega`. No UI defects were found.

## Method

- Check: [`frontend/scripts/hu29-mermas-visual.mjs`](../../../../../../frontend/scripts/hu29-mermas-visual.mjs). It is local-only, adds no dependency and only writes evidence under this folder.
- App server: `npm run dev -- --host 127.0.0.1 --port 5193 --strictPort` from `frontend/`, with dummy `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_ANON_KEY=dummy-local-anon-key`. `frontend/.env` and `.env.local` are absent, so the values are supplied only on the dev command line. No real project URL or key was used.
- Browser: `/usr/bin/google-chrome` (Google Chrome 156.0.8078.47), driven by Playwright `1.64.0-alpha-1790635538000` from the local npx cache through `HU29_PLAYWRIGHT_MODULE`. Playwright is not a project dependency.
- Synthetic session: every request to `http://127.0.0.1:54321` is intercepted with `page.route`. `POST /auth/v1/token` returns a synthetic session for `ux-hu29-bodega@example.invalid` or `ux-hu29-admin@example.invalid`; `GET /rest/v1/perfiles` returns a synthetic `bodega` or `administrador` profile; `GET /rest/v1/sucursales` returns two synthetic branches for the admin selector. CORS preflights are answered locally.
- Fixtures: one active seller (`Valentina Rojas`), one inactive seller (`Iván Retirado`), `Agua 20L`, `Hielo en bolsa 2kg`, a `Bandeja` packaging type, an active product that must not be offered (`Producto retirado`), one dispatch of today, and three losses (two active, one annulled). The reconciliation returns two rows: one with `comparacion_disponible = false` and one with comparison values and the inactive seller.
- Guard rails: the only accepted data mutations are `POST /rest/v1/rpc/registrar_merma_bodega` and `POST /rest/v1/rpc/anular_merma_bodega`. The read-only RPCs `vendedores_sucursal`, `vendedores_historial_sucursal` and `cuadre_diario_bodega` are POST at the HTTP level but are classified as reads. Any other non-GET under `/rest/v1/`, unknown endpoints, page errors, unexpected console errors or requests outside `127.0.0.1` fail the run. The deliberate HTTP 400 of the stock-error scenario and the deliberate aborted retry request are the only exempted browser-health entries.
- Idempotency: the RPC stub stores the first response per `p_idempotency_key`; a replay returns the original id and does not insert a second loss.
- The check was executed on four viewports: 375x812, 412x915, 768x1024 and 1280x800. Functional-only scenarios (retry, double click, validation, server error, role visibility, empty state) ran once at 1280x800; the three page-level scenarios ran at all four viewports.

## Steps and results

| # | Scenario | Viewports | Expected | Observed | Result | Screenshots |
|---|----------|-----------|----------|----------|--------|-------------|
| 1 | Bodega registers a bodega-stock product loss | 375x812, 412x915, 768x1024, 1280x800 | Form defaults to Bodega/Producto; only active products; one `registrar_merma_bodega` POST with the eight documented arguments and explicit nulls; list refreshes, form resets | One POST: `p_sucursal_id=0000…0001`, `p_origen="bodega"`, `p_despacho_id=null`, `p_producto_id=5555…5555`, `p_tipo_empaque_id=null`, `p_cantidad=4`, `p_motivo`, UUID `p_idempotency_key`; "3 registros" → "4 registros"; mermas GET 1 → 2; product/quantity/reason cleared; inactive product not offered | PASS | `01-formulario-merma-*.png`, `02-mermas-actualizadas-*.png` |
| 2 | Daily reconciliation | 375x812, 412x915, 768x1024, 1280x800 | Defaults to today; table ≥640 px and cards <640 px; "Comparación no disponible" only for the false row; comparison values for the true row; inactive seller labeled; range >31 days rejected without querying | `p_desde=p_hasta=2026-10-25`, `p_vendedor_id=null`; `table`/`table-row` at 768/1280 and `block`/`grid` with visible mobile labels at 375/412; one "Comparación no disponible"; "Saldo inicial: 7", "Carga actual (hoy): 10", "Diferencia: 0"; `Iván Retirado (inactivo)` in table and selector; 32-day range showed "El rango no puede superar 31 días." with zero extra RPC; corrected to 24–25 showed one new query | PASS | `03-cuadre-*.png`, `04-cuadre-rango-*.png` |
| 3 | Administration annuls a loss | 375x812, 412x915, 768x1024, 1280x800 | Admin gets the branch selector; "Anular" column and two active-loss actions; the dialog requires its own reason; one `anular_merma_bodega(p_merma_id,p_motivo)`; the row becomes Anulada | Branch selector with two options; 2 actions → dialog → empty reason shows "Indica el motivo de la anulación." with zero RPC → reason "Error de conteo" sends exactly `{p_merma_id: 3333…3301, p_motivo: "Error de conteo"}` → 1 action left and 2 "Anulada" badges; no new loss was registered | PASS | `05-anular-modal-*.png`, `06-anulada-*.png` |
| 4 | Retry after a network failure | 1280x800 | The failed submit surfaces a Spanish error, keeps the form values and retries with the same idempotency key | First request aborted by the browser with "No fue posible completar la operación. Inténtalo de nuevo."; product/quantity/reason retained; retry sent the same UUID key; exactly 2 POSTs; new row appeared and the total went 3 → 4 | PASS | `07-reintento-red-1280x800.png` |
| 5 | Double click on "Registrar merma" | 1280x800 | At most one mutation for an unchanged attempt | One POST with one UUID key while the 600 ms stub was in flight | PASS | `08-doble-click-1280x800.png` |
| 6 | Client-side validation | 1280x800 | Blank reason and non-positive quantity are blocked in Spanish without any RPC | Blank reason: "Indica el motivo de la merma."; quantity 0: "Ingresa una cantidad mayor que cero."; zero `registrar_merma_bodega` POSTs in both cases; values preserved | PASS | `09-validacion-motivo-1280x800.png`, `10-validacion-cantidad-1280x800.png` |
| 7 | Database stock error | 1280x800 | PostgREST `P0001` "Stock o carga insuficiente…" is mapped to the approved Spanish message; the form survives; the list is unchanged | Exact message "No hay stock o carga suficiente para registrar la merma."; product, `9.999` and reason retained; one rejected POST; "3 registros" unchanged | PASS | `11-error-stock-1280x800.png` |
| 8 | Bodega cannot annul | 1280x800 | No "Anular" action or "Acción" column for a bodega user | 0 action buttons, 0 "Acción" headers, 0 "Anular" buttons | PASS | `12-sin-anular-bodega-1280x800.png` |
| 9 | Empty reconciliation | 1280x800 | Empty state with the queried range; no table | "No hay movimientos entre 25-10-2026 y 25-10-2026."; no table; one RPC | PASS | `13-cuadre-vacio-1280x800.png` |

Layout and touch targets:

| Viewport | `/mermas` | `/cuadre-diario` | Page overflow | Primary action heights |
|----------|-----------|------------------|---------------|------------------------|
| 375x812 | cards (`block`/`grid`) | cards (`block`/`grid`) | `scrollWidth = innerWidth = 375` | 44 px |
| 412x915 | cards (`block`/`grid`) | cards (`block`/`grid`) | `scrollWidth = innerWidth = 412` | 44 px |
| 768x1024 | table (`table`/`table-row`) | table (`table`/`table-row`) | `scrollWidth = innerWidth = 768` | 44 px |
| 1280x800 | table (`table`/`table-row`) | table (`table`/`table-row`) | `scrollWidth = innerWidth = 1280` | 44 px |

Measured primary actions: "Registrar merma", "Aumentar", "Disminuir", "Anular", "Anular merma" (confirm) and "Actualizar" were all 44 px high.

## Browser health

- Final run: 0 unexpected page errors, 0 unexpected failed requests and 0 unexpected console errors.
- Expected HTTP failures in their own scenarios: the aborted retry request (`net::ERR_FAILED`) and the stock-error HTTP 400; both were exempted by URL and message, not globally.
- Non-GET requests per page: the Auth token exchange, the two read-only seller RPCs (again after a refresh) and the expected mutation. No other non-GET reached `/rest/v1/`.
- Unexpected endpoints: 0. Requests outside `127.0.0.1`: 0.
- One intermediate run failed the 1280x800 reconciliation scenario because Chrome reported `net::ERR_NETWORK_CHANGED` while loading Vite dev-server modules (container network churn); the full rerun passed 18/18. The script intentionally treats such browser-health failures as failures instead of retrying them silently.

## Observations

- The 9-column reconciliation table exceeds the card width at 768x1024 and relies on the documented internal horizontal scroll (`sm:overflow-x-auto`); the page itself never overflows. This matches the "table ≥640 px, cards <640 px" convention and is not counted as a defect.
- Native date inputs display `10/25/2026` in headless Chrome despite the `es-CL` context locale; the submitted values are ISO dates and the visible validation text is Spanish. The display format is controlled by the browser, not by the page.
- When an administrator views a loss registered by a bodega user, "Registrado por" falls back to `Usuario ref. <uuid8>` because the page resolves only the current user and the historical seller roster. The actor is still stored (`creado_por`); this is the existing design (the base exposes only the UUID) and not a regression in HU-29.
- No implementation files were modified.

## Reproduction

Start the dev server (dummy values are safe because all Supabase traffic is intercepted):

```sh
cd frontend
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=dummy-local-anon-key \
npm run dev -- --host 127.0.0.1 --port 5193 --strictPort
```

In another shell:

```sh
cd frontend
HU29_PLAYWRIGHT_MODULE=/home/cristhian/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs \
node scripts/hu29-mermas-visual.mjs
```

The script accepts `HU29_BASE_URL` (default `http://127.0.0.1:5193`) and `HU29_SUPABASE_URL` (default `http://127.0.0.1:54321`); both must stay on `127.0.0.1` or `localhost`. It exits 0 only when every scenario passes and rewrites `evidence.json`, `report.json`, `results.txt` and the screenshots under this folder.

## Limitations

- Headless Google Chrome only; Firefox, WebKit and real iOS/Android browsers were not exercised.
- The check runs against the Vite development server with intercepted synthetic Supabase responses. It does not cover real authentication, RLS/grants, database triggers, the RPC bodies as executed by PostgreSQL, real stock/carga arithmetic, concurrent writes or network latency.
- The double-click, network-failure and stock-error cases are simulated at the HTTP layer; the PL/pgSQL functions are not executed.
- Registration evidence is scoped to a bodega-stock product, as requested for this round. The dispatch-origin product path and the empty-packaging ("envase") registration path render correctly in the fixture but are not exercised end to end here; they remain covered by the unit tests and the database tests.
- The 31-day boundary is exercised with a 32-day range and a 2-day range, not at exactly 31/32 days.
- The synthetic dates are anchored to the Santiago jornada on 2026-10-25; the script computes "today" at run time.
- Assertions are DOM/geometry based plus visual inspection of the screenshots; there is no pixel baseline or image diff.
- Playwright must be provided through `HU29_PLAYWRIGHT_MODULE`, because the repository intentionally does not depend on it.

## Evidence

- [`evidence.json`](evidence.json) — every scenario result, request bodies, idempotency keys, GET counters, layout/touch measurements and failures from the final run.
- [`report.json`](report.json) — machine-readable summary with the same scenarios, allowed writes and read RPCs.
- [`results.txt`](results.txt) — one PASS line per scenario/viewport.
- `01-formulario-merma-{375x812,412x915,768x1024,1280x800}.png` — filled form before submitting.
- `02-mermas-actualizadas-{375x812,412x915,768x1024,1280x800}.png` — refreshed list with the new loss.
- `03-cuadre-{375x812,412x915,768x1024,1280x800}.png` — reconciliation table/cards, comparison states and inactive seller.
- `04-cuadre-rango-{375x812,412x915,768x1024,1280x800}.png` — rejected 32-day range.
- `05-anular-modal-{375x812,412x915,768x1024,1280x800}.png` — administration cancellation dialog.
- `06-anulada-{375x812,412x915,768x1024,1280x800}.png` — list after a single compensation.
- `07-reintento-red-1280x800.png` — successful retry after the simulated network failure.
- `08-doble-click-1280x800.png` — state after the double click (one request).
- `09-validacion-motivo-1280x800.png`, `10-validacion-cantidad-1280x800.png` — client-side validation messages.
- `11-error-stock-1280x800.png` — mapped stock error with the form preserved.
- `12-sin-anular-bodega-1280x800.png` — bodega list without the cancellation action.
- `13-cuadre-vacio-1280x800.png` — empty reconciliation state.
