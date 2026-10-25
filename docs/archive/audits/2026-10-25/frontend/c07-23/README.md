# OND-c07.23 — Bodega history names inactive sellers

Date: 2026-10-25
Scope: local-only browser verification of dispatch/return history after the
`vendedores_historial_sucursal` RPC and the Bodega naming changes.

Environment:

- Vite dev server on `127.0.0.1:5191` with dummy
  `VITE_SUPABASE_URL=http://127.0.0.1:54321` and a dummy anon key.
- Google Chrome 156.0.8078.47 through Playwright.
- Synthetic Bodega session; every Auth, REST and RPC call intercepted in the
  browser. Zero database writes; no real Supabase project contacted.
- Viewports: 412x915 and 1280x800.

## Result

All three scenarios pass at both viewports. No product defects were found.

| # | Scenario | 412x915 | 1280x800 |
|---|----------|---------|----------|
| 1 | Dispatch history and seller selector | PASS | PASS |
| 2 | Return history | PASS | PASS |
| 3 | History RPC missing (HTTP 404) | PASS | PASS |

1. **Dispatches.** History rows name `Valentina Rojas` (active) and
   `Bruno Soto (inactivo)`. The history filter offers both sellers. The
   `Nuevo despacho` selector offers only the active seller, without Bruno or an
   inactive label.
2. **Returns.** The return history lists both sellers and names the inactive
   one `Bruno Soto (inactivo)`; the filter offers both.
3. **Missing history RPC.** With `vendedores_historial_sucursal` answering 404,
   the page still loads with no error banner. The active seller is named from
   the active roster and the unknown id renders
   `Vendedor no disponible · ref. 99999999`. The filter falls back to the active
   roster (Valentina only).

The run also asserts there are no unexpected browser errors beyond the
deliberate 404, no REST mutations, and no unexpected synthetic requests.
Evidence, including the exact filter and selector options, is in
`evidence.json`.

## Screenshots

- `01-despachos-historial-{412x915,1280x800}.png`
- `02-despachos-nuevo-{412x915,1280x800}.png`
- `03-devoluciones-historial-{412x915,1280x800}.png`
- `04-despachos-sin-rpc-{412x915,1280x800}.png`

## Rerun

```sh
cd frontend
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=dummy-local-anon-key \
npm run dev -- --host 127.0.0.1 --port 5191 --strictPort

# In another shell, with Playwright already installed:
C07_23_PLAYWRIGHT_MODULE=/home/cristhian/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs \
node scripts/c07-23-historial-visual.mjs
```

The script accepts `C07_23_BASE_URL` and `C07_23_SUPABASE_URL` overrides, both
restricted to loopback hosts. If Playwright is resolvable from `node_modules`,
the `C07_23_PLAYWRIGHT_MODULE` override can be omitted.

## Limits

The check uses synthetic fixtures and intercepted HTTP responses. It verifies
the Bodega rendering contract, not the real RPC grant/data or RLS behaviour; the
404 path is simulated at the HTTP layer.
