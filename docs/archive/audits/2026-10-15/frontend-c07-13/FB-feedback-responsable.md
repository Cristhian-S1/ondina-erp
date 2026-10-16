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
