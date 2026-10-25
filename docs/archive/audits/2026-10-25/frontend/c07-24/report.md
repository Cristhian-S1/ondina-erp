# OND-c07.24 — mobile drawer reset across breakpoints (browser verification)

- **Date:** 2026-10-25
- **Branch:** `Cristhian-S1/t3-test-menu`, based on `f502994` (`fix(frontend): close the mobile menu when the breakpoint changes`)
- **Requirement:** with the drawer open at 412x915, resizing to 1280x800 and back to 412x915 must leave the drawer closed, without a reload. 375x812 and 768x1024 must render without horizontal scroll.
- **Result:** **PASS** — the script exited 0 on two consecutive runs, with no browser errors, no unexpected API calls and no database writes.

## Method

- Check: [`frontend/scripts/c07-24-menu-visual.mjs`](../../../../../../frontend/scripts/c07-24-menu-visual.mjs). It is local-only, performs no business mutation and adds no dependency.
- App server: `npm run dev -- --host 127.0.0.1 --port 5190` from `frontend/`, with dummy `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_ANON_KEY=dummy-local-anon-key`. No real project URL or key was used.
- Browser: `/usr/bin/google-chrome` (Google Chrome 156.0.8078.47), driven by Playwright `1.64.0-alpha-1790635538000` from the local npx cache, selected through `C07_24_PLAYWRIGHT_MODULE`. Playwright is not a project dependency.
- Synthetic session: every request to `http://127.0.0.1:54321` is intercepted with `page.route`. `POST /auth/v1/token` returns a synthetic session for `ux-menu@example.invalid`; `GET /rest/v1/perfiles` returns a synthetic `bodega` profile; `GET /rest/v1/sucursales` returns a synthetic branch. CORS preflights are answered locally.
- Guard rails: any non-GET request under `/rest/v1/`, any unknown synthetic endpoint, any page/console error or failed request fails the run. The drawer state is read from the DOM (`aria-expanded`, `aria-hidden`, `inert`, role, bounding box, overlay presence) and layout overflow from `document.documentElement.scrollWidth` vs `innerWidth`.

## Steps and results

| # | Step | Viewport | Expected | Observed | Result | Screenshot |
|---|------|----------|----------|----------|--------|------------|
| 1 | Load the dashboard with the synthetic session | 412x915 | Drawer closed: `aria-expanded=false`, aside off-screen | `aria-expanded=false`, `aria-hidden=true`, `inert`, aside `left=-256` / `right=0` | PASS | — |
| 2 | Open the drawer with "Alternar menú lateral" | 412x915 | Dialog on-screen | `aria-expanded=true`, `role=dialog`, overlay present, aside `left=0` / `right=256` | PASS | `01-drawer-open-412x915.png` |
| 3 | Resize with the drawer open | 1280x800 | Desktop sidebar; mobile dialog semantics gone; `mobileOpen` reset | Sidebar `left=0` / `width=256`, no `role=dialog`, no overlay | PASS | `02-desktop-1280x800.png` |
| 4 | Resize back without reloading | 412x915 | Drawer closed again (the regression) | `aria-expanded=false`, `aria-hidden=true`, `inert`, aside `left=-256` / `right=0`, no overlay, no dialog | PASS | `03-back-to-mobile-412x915.png` |
| 5 | Render a narrow phone layout | 375x812 | No horizontal scroll; drawer closed | `scrollWidth=375`, `innerWidth=375`, drawer off-screen | PASS | `04-375x812.png` |
| 6 | Render a tablet layout | 768x1024 | No horizontal scroll; drawer closed | `scrollWidth=768`, `innerWidth=768`, drawer off-screen | PASS | `05-768x1024.png` |

Step 3 notes: on desktop the same header button toggles the collapsed sidebar, so `aria-expanded=true` is the intended state for the expanded desktop sidebar. The mobile drawer assertions are that the `dialog` role, the overlay and the modal state are gone.

## Browser health

- Page errors: 0. Console errors: 0. Failed requests: 0.
- Synthetic API requests: `POST /auth/v1/token`, `GET /rest/v1/perfiles`, `GET /rest/v1/sucursales` (twice, dashboard and drawer branch lookup).
- Unexpected endpoints: 0. Non-GET `/rest/v1` requests: 0.

## Reproduction

Start the dev server (dummy values are safe because all Supabase traffic is intercepted):

```sh
cd frontend
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=dummy-local-anon-key \
npm run dev -- --host 127.0.0.1 --port 5190
```

In another shell:

```sh
cd frontend
C07_24_PLAYWRIGHT_MODULE=/home/cristhian/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs \
node scripts/c07-24-menu-visual.mjs
```

The script exits 0 on success and non-zero on any assertion failure. It rewrites the screenshots and `evidence.json` under this folder. Optional overrides: `C07_24_BASE_URL` (must stay on `127.0.0.1`/`localhost`) and `C07_24_SUPABASE_URL` (must also stay local).

## Limitations

- Headless Google Chrome only; Firefox, WebKit and real iOS/Android browsers were not exercised.
- The check runs against the Vite development server with intercepted synthetic Supabase responses. It does not cover real network latency, authentication or RLS behavior.
- Assertions are DOM/geometry based plus visual inspection of the screenshots; there is no pixel baseline or image diff.
- The breakpoint transition is tested at 412 to 1280 to 412 px, crossing the `lg` (1024 px) breakpoint, not at the exact 1023/1024 px boundary.
- Playwright must be provided through `C07_24_PLAYWRIGHT_MODULE`, because the repository intentionally does not depend on it.

## Evidence

- [`evidence.json`](evidence.json) — raw step results, errors, writes and intercepted requests from the final run.
- `01-drawer-open-412x915.png` — drawer open as a modal.
- `02-desktop-1280x800.png` — desktop sidebar after resizing with the drawer open.
- `03-back-to-mobile-412x915.png` — drawer closed after returning to 412 px.
- `04-375x812.png` — narrow phone layout.
- `05-768x1024.png` — tablet layout.
