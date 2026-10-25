# HU-26 — dispatch adjustments inside the window (browser verification)

- **Date:** 2026-10-25
- **Branch:** `Cristhian-S1/t3-test-hu26`, based on `efed78c` (`feat(bodega): add product adjustments to dispatches within the window`)
- **Requirement:** a dispatch inside its 15-minute adjustment window offers "Agregar productos"; the dialog sends `ajustar_despacho(p_despacho_id, p_lineas, p_idempotency_key)` once, the list refreshes after success and the appended line is marked "Ajuste". A dispatch outside the window must not offer the action. A database window-expired rejection must be shown in Spanish while the form stays usable. A double click must not produce duplicate mutations with different keys. The flow must not overflow horizontally at 375x812 and its controls must keep 44 px touch targets.
- **Result:** **PASS** — the script exited 0 on two consecutive runs with all five checks passing at their viewports, no unexpected browser errors, no unexpected endpoints and no database writes other than the expected adjustment RPC. No product defects were found.

## Method

- Check: [`frontend/scripts/hu26-ajuste-visual.mjs`](../../../../../../frontend/scripts/hu26-ajuste-visual.mjs). It is local-only, adds no dependency and only writes evidence under this folder.
- App server: `npm run dev -- --host 127.0.0.1 --port 5192 --strictPort` from `frontend/`, with dummy `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_ANON_KEY=dummy-local-anon-key`. No real project URL or key was used.
- Browser: `/usr/bin/google-chrome` (Google Chrome 156.0.8078.47), driven by Playwright `1.64.0-alpha-1790635538000` from the local npx cache through `HU26_PLAYWRIGHT_MODULE`. Playwright is not a project dependency.
- Synthetic session: every request to `http://127.0.0.1:54321` is intercepted with `page.route`. `POST /auth/v1/token` returns a synthetic session for `ux-hu26@example.invalid`; `GET /rest/v1/perfiles` returns a synthetic `bodega` profile; `GET /rest/v1/sucursales` returns a synthetic branch. The seller lookups (`vendedores_sucursal`, `vendedores_historial_sucursal`) are synthetic read-only RPCs. CORS preflights are answered locally.
- Fixture: one active seller (`Valentina Rojas`), one dispatch whose `creado_en` is **2 minutes ago** in scenarios 1, 3 and 4 and **30 minutes ago** in scenario 2. The original detail is `Agua 20L × 12`. The successful adjustment appends `Hielo en bolsa 2kg × 4` with `es_ajuste = true` before the response, so the post-adjustment refetch can prove the list and the detail were refreshed. Bodega stock is 200 water / 100 ice.
- Guard rails: the only accepted data mutation is `POST /rest/v1/rpc/ajustar_despacho`; every other non-GET under `/rest/v1/` fails the run. The seller RPCs are POST but read-only and are classified as reads. The Auth token exchange is session setup, not a data write. Unknown endpoints, page errors, failed requests and unexpected console errors fail the run; the deliberate HTTP 400 in the expired-window scenario is the only exempted console entry (Chrome logs it as `Failed to load resource`).
- The RPC stub is idempotent per `p_idempotency_key`, mirroring `private.solicitudes_ajuste_despacho`: a repeated key returns the first response without appending a second line.

## Steps and results

| # | Scenario | Viewports | Expected | Observed | Result | Screenshots |
|---|----------|-----------|----------|----------|--------|-------------|
| 1 | Successful adjustment on a 2-minute-old dispatch | 412x915, 1280x800 | "Agregar productos" opens the dialog; one RPC POST with the dispatch id, the new line and a UUID key; list refreshes; detail marks the new line "Ajuste" | One POST `{p_despacho_id: 1111…1126, p_lineas: [{producto_id: 5555…5555, cantidad: 4}], p_idempotency_key: <UUID>}`; dispatch and detail GETs went 1 → 2; detail shows `Hielo en bolsa 2kgAjuste · 25-10-2026 14:21 … 4` and the recalculated total 16; hint changes to "Quedan 12 min 58 s … (aprox.)" | PASS | `01-formulario-ajuste-*.png`, `02-ajuste-aplicado-*.png` |
| 2 | Dispatch outside the window (30 minutes old) | 412x915, 1280x800 | No "Agregar productos"; closed-window hint; zero RPC | Action count 0; "La ventana de ajuste de este despacho está cerrada." shown; RPC count 0 | PASS | `03-ventana-cerrada-*.png` |
| 3 | Database rejects with the window-expired error (PostgREST `P0001`, HTTP 400) | 412x915, 1280x800 | Spanish message shown; form keeps product and quantity; dialog can be closed | Exact message "La ventana de ajuste del despacho expiró. Ya no se pueden agregar productos."; dialog stayed open; product and quantity `4` kept; "Cancelar" closed it | PASS | `04-error-ventana-*.png` |
| 4 | Double click on "Agregar al despacho" | 412x915, 1280x800 | One request, or two sharing the same idempotency key; report which | **One request** at both viewports (the button disables while the 600 ms RPC is in flight), with one UUID key per run | PASS | `05-doble-click-*.png` |
| 5 | Narrow phone layout | 375x812 | No horizontal scroll; new controls ≥ 44 px high | `scrollWidth = innerWidth = 375` both with the dialog open and after closing; every measured control is exactly 44 px high: "Agregar productos", "Cerrar", "Quitar", Producto select, Cantidad input, "Aumentar", "Disminuir", "+ Agregar producto", "Cancelar", "Agregar al despacho" | PASS | `06-375x812-ajuste.png`, `07-375x812-lista.png` |

Notes:

- Scenario 1's hint shows `(aprox.)` because it is the client-side estimate; after a successful adjustment it would be replaced by the RPC's `ventana_expira_en`. The detail still offering "Agregar productos" afterwards is expected: the dispatch remains inside the window.
- Scenario 3 deliberately simulates a race in which the client hint says the window is open but the database rejects. This is the only scenario that produces an HTTP 400 and a Chrome console entry.
- The "Ajuste" badge is rendered inline next to the product name, so its `innerText` has no separating space (`Hielo en bolsa 2kgAjuste · …`). The screenshot shows the amber badge correctly; this is purely how `innerText` concatenates the elements.

## Browser health

- Page errors: 0 in every scenario. Failed requests: 0. Console errors: only the expected `Failed to load resource: … 400 (Bad Request)` for the adjustment RPC in scenario 3.
- Non-GET requests per successful scenario: the Auth token exchange, the two read-only seller RPCs (once at load and once after the refresh), and the expected `ajustar_despacho` POST. No other non-GET reached `/rest/v1/`.
- Unexpected endpoints: 0 in every scenario.

## Defects

None found. No implementation files were modified.

## Reproduction

Start the dev server (dummy values are safe because all Supabase traffic is intercepted):

```sh
cd frontend
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=dummy-local-anon-key \
npm run dev -- --host 127.0.0.1 --port 5192 --strictPort
```

In another shell:

```sh
cd frontend
HU26_PLAYWRIGHT_MODULE=/home/cristhian/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs \
node scripts/hu26-ajuste-visual.mjs
```

The script exits 0 only when every scenario passes and rewrites the screenshots and `evidence.json` under this folder. Optional overrides: `HU26_BASE_URL` (must stay on `127.0.0.1`/`localhost`) and `HU26_SUPABASE_URL` (must also stay local).

## Limitations

- Headless Google Chrome only; Firefox, WebKit and real iOS/Android browsers were not exercised.
- The check runs against the Vite development server with intercepted synthetic Supabase responses. It does not cover real network latency, real authentication, RLS, grants, the database-side window clock or the real `configuracion.ventana_ajuste_minutos` value.
- The 15-minute boundary is inferred from the client hint: fixtures are 2 and 30 minutes old, not at 14:59/15:01. The database remains the authority in production.
- Scenario 3 simulates the server rejection at the HTTP layer; it does not execute the PL/pgSQL function.
- Assertions are DOM/geometry based plus visual inspection of the screenshots; there is no pixel baseline or image diff.
- Playwright must be provided through `HU26_PLAYWRIGHT_MODULE`, because the repository intentionally does not depend on it.

## Evidence

- [`evidence.json`](evidence.json) — request bodies, idempotency keys, GET counters, touch-target measurements, non-GET requests and failures from the final run.
- `01-formulario-ajuste-{412x915,1280x800}.png` — filled adjustment dialog before submitting.
- `02-ajuste-aplicado-{412x915,1280x800}.png` — refreshed list with the line marked "Ajuste".
- `03-ventana-cerrada-{412x915,1280x800}.png` — 30-minute-old dispatch without the action.
- `04-error-ventana-{412x915,1280x800}.png` — Spanish window-expired rejection with the form preserved.
- `05-doble-click-{412x915,1280x800}.png` — state after the double click (one request).
- `06-375x812-ajuste.png` — adjustment dialog at 375x812.
- `07-375x812-lista.png` — refreshed dispatch list at 375x812.
