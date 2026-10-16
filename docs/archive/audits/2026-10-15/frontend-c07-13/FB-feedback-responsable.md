# FB — Feedback of the business owner after the local UX review (2026-10-15)

Branch `feature/frontend-ux`. Four points reported after running `.ux-local/levantar.sh`.

| # | Module | Report | Root cause | Fix |
|---|---|---|---|---|
| FB-01 | Login | Show/hide password should be an eye icon, well aligned | Text label `Ver`/`Ocultar` changed width | `EyeIcon`/`EyeOffIcon` (own module `icons-visibilidad.tsx` so the entry chunk does not pull the navigation icons); fixed 44 px button aligned to the input |
| FB-02 | Ventas | First client registration shows no toast and the dialog stays open; the second works | `Clientes` keys `RegistrarCliente` by `sucursal:vendedorId`; `onCreated` changed `vendedorId` from `''` to the seller id on the first success, remounting the dialog and dropping the toast and close timer | `onCreated` is deferred until the dialog closes (timer, Cancel, Escape). Regression test in `Clientes.test.tsx` |
| FB-03 | Bodega | Devoluciones section icons not representative | Generic box/recycle icons | `HieloIcon` (ice cubes) for "Productos del despacho", `BidonIcon` for "Envases" |
| FB-04 | Producción | Date filter calendar does not show on mobile (Registrar and Historial) | Android/iOS render `input type="date"` without a calendar indicator | Shared `InputFecha`: on coarse pointers a visible 44 px calendar button calls `showPicker()` (falls back to focus); desktop keeps the native indicator. Also used by the two admin date filters in Bodega |

## Verification

- `npm run lint`, `npm run build`, `npm run size` (entry JS +0.4 %, CSS +0.9 % vs base): pass.
- Unit 828/828 (71 files), integration 22/22 against local Supabase.
- Headless Chrome (Pixel 7 emulation and 1280 px desktop) against local Supabase: eye toggle, calendar button visible only on touch and focusing the field, Devoluciones icons.
- Limit: the native picker opened by `showPicker()` was not exercised on a physical Android/iOS device.

## Independent review (Sonnet subagent)

No P1/P2. Applied: removed the password button `title` that contradicted its fixed accessible name (P4); added a Cancel-after-first-registration regression test (P4). Accepted as known: Firefox on a touch-primary desktop can show its own date icon next to the new button (P3, WebKit-only pseudo-element); `onCreated` is skipped if the page unmounts within the 1.5 s close delay (P4, harmless because the parent state unmounts too). Unit tests: 829/829.

## FB-04 follow-up: double calendar icon

Reported by the owner on his real phone: the Producción date filters (Registrar and Historial) showed two calendar icons; only the rightmost (ours) worked.

- **Cause.** `InputFecha` hid the native indicator only with `::-webkit-calendar-picker-indicator` on coarse pointers and added `pr-12`. A browser that draws its own indicator outside that pseudo-element (most likely Firefox for Android/Gecko, unconfirmed) kept it, and `pr-12` pushed it left of our button, so both were visible. Chrome's Pixel 7 emulation hides the WebKit indicator, which is why the earlier check showed one icon.
- **Fix.** The 44 px button is now shown for every pointer type, inset 1 px inside the input border (height = input − 2 px) with an opaque background (`bg-white`, `bg-slate-100` when disabled, matching the input). The input keeps its normal end padding, so any native indicator stays pinned to the right edge underneath the button; the WebKit indicator is hidden for every pointer so Chrome desktop has no invisible click area under it. Margin utilities move to the wrapper so the button aligns with the input box. Start padding drops to `ps-2` to give the date text room; end padding is unchanged because reducing it would not widen the visible text (text is start-aligned) and increasing it is what exposed the native icon. Firefox's spaced `dd / mm / aaaa` (~100 px) plus the button does not fit a ~141 px column, so the Producción filters switch to two columns at 400 px instead of 360 px, and the two Bodega admin date filters get a fixed `w-40`.
- **Verification.** Lint, build, `npm run size` (budget OK), unit 830/830 (71 files). Headless Chrome (Pixel 7, 360/400 px, 1280 px) and Playwright Firefox 132 (412/400/360 px with `hasTouch`, 1280 px) against local Supabase: one icon in every capture, full date text, button inset 1/1/1 px and 44×42 px, button click focuses the input, Devoluciones filter included.
- **Limits.** Not tested on a physical phone or Firefox for Android itself (desktop Gecko with touch emulation only); the native picker opened by `showPicker()` was not exercised. At fractional device pixel ratios (e.g. 2.625) the bottom border under the button can render a hair lighter due to sub-pixel anti-aliasing.
