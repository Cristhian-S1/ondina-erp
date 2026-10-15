# Frontend Conventions

Updated 2026-10-14 after the frontend-ux round (findings A1/UX, delivery lots B1–B7, with B3 integrated). Delivery reports with per-commit evidence live in `docs/archive/audits/2026-10-13/frontend-ux/`.

## Structure and types

Use domain services/hooks and the shared client. Keep strict TypeScript, type-only imports with `import type`, PascalCase components, `useCamelCase` hooks and camelCase utilities. User-facing messages stay in Spanish.
`strict` is explicit in `frontend/tsconfig.app.json` (and the node project), so keep code clean under it rather than narrowing types at the boundary.
Keep React Hook Form input/output types distinct when Zod coerces or preprocesses values; use the lockfile-compatible resolver and `useForm<Input, Context, Output>` rather than suppressing type errors.

## View states: `frontend/src/components/EstadoVista.tsx`

`EstadoVista` (default export) is the shared view-state block for pages, lists and `Suspense` fallbacks. Three variants:

| Variant | Semantics | Rendering |
| --- | --- | --- |
| `cargando` | First fetch still pending, nothing to show yet. | `role="status"`, default message `Cargando...`. |
| `vacio` | Read succeeded and produced zero rows. | Dashed-border block; optional `accion` (e.g. create the first record). |
| `error` | Read failed. | `role="alert"` red block; optional `onReintentar` renders the `Reintentar` button (`btnSecondary`). |

Rules:

- **Error is not empty, and empty is not zero.** A failed read is never rendered as an empty list, zeroed metrics or stale cached rows (A1-05): data kept in cache is hidden after a failure, and a metric without a valid value shows `—`. Empty states must say why: `Aún no hay despachos para esta sucursal.` (no records yet) versus `No hay despachos para el día y vendedor seleccionados.` (a filter produced no rows).
- **`onReintentar` repeats reads only.** Every current wiring re-fetches a read (`refetch()`, a page `load()`, or bumping `Stock`'s retry version). Never point `Reintentar` at a mutation: a failed write is reported with `errorBlockCls` or `Toast`, the form keeps its values, and the user retries deliberately.
- Pages render their own `cargando`/`error`/`vacio` states with it, and it is the `Suspense` fallback of the domain routes in `domains/administracion/index.tsx`, `domains/produccion/index.tsx` and `domains/ventas/index.tsx`. The `domains/bodega/index.tsx` fallbacks are still a plain `<p role="status">Cargando página...</p>`; replace them with `EstadoVista` when touching that file.
- Sections whose functionality does not exist yet use `components/ModulePage.tsx` (`Próximamente` badge, honest text and a `Volver al inicio` link), with the same badge in the nav; never fake functionality behind a link.
- Unexpected render failures fall through to `components/ErrorBoundary.tsx`, wrapped around the app root in `frontend/src/main.tsx`.

## Dates and the Santiago zone: `frontend/src/lib/format.ts`

`lib/format.ts` is the single source for date formatting (UX-09):

- `fmtFecha(valor)` → `dd-mm-aaaa`; `fmtFechaHora(valor)` → `dd-mm-aaaa hh:mm` (24-hour, no seconds). Input is `string | Date | null | undefined`; empty or invalid input renders `—`.
- Formatting is fixed to `es-CL` in the `America/Santiago` zone via `Intl.DateTimeFormat` with `formatToParts`. Never format a visible date with the browser's local zone: `2026-10-13T02:15:59Z` is `12-10-2026 23:15` for the user in Santiago.
- "Today" and period arithmetic are also Santiago-based, not UTC: `mesActualSantiago()` in `domains/ventas/hooks/useRankingVendedores.ts` returns the current `AAAA-MM`, and `fechaSantiago()` / `useJornadaSantiago()` / `inicioPeriodo()` in `domains/bodega/hooks/useJornadaSantiago.ts` track the warehouse day (`useSyncExternalStore` with a 1-second clock plus `focus`/`visibilitychange` listeners). Late in a Chilean evening or month UTC is already on the next day/month, so compute in Santiago and let tests exercise the boundary.
- Native `type="date"` inputs keep their own values and constraints; format only what is displayed.
- `lib/ui.ts#fmtFecha` (legacy short format `dd-mm hh:mm`, browser zone) is `@deprecated` and currently has no consumers: `Gastos` and every other page now format through `lib/format`. Delete it on the next `lib/ui.ts` touch instead of importing it.

## Data loading: scoped query keys, `isPending` vs `isFetching`

Reads go through React Query with keys that carry the full identity scope, so one user's data can never be replaced by another user's late response (A1-01):

- Include the domain prefix, the profile identity and the selected context in the key. Reference patterns:
  - `domains/bodega/hooks/useDatosBodega.ts`: `['bodega', perfil?.id, perfil?.rol, perfil?.sucursal_id, sucursalId, incluirStock]` with `enabled: !!perfil && !!sucursalId`.
  - `domains/ventas/hooks/useRankingVendedores.ts`: `['ventas', 'ranking', mes, perfil?.id, perfil?.sucursal_id, perfil?.rol]`.
  - `domains/produccion/hooks/useDatosProduccion.ts`: `['produccion', perfilId, sucursalId, <recurso>, ...]`.
- Domain reads set `retry: false` so a failure surfaces immediately in the UI (`EstadoVista` error) instead of retrying silently.
- Scope switches remount the screen: `domains/bodega/components/AmbitoBodega.tsx` keys children with a `<Fragment>` whose key joins `identidad` and `sucursalId`, so drafts, selections, filters and retry state reset when identity or sucursal changes, while the sucursal selector itself stays usable during a load. Its own read errors use `EstadoVista` + `refetch()`.
- Mutations and Realtime subscriptions invalidate only the resources they affected, still scoped by identity and sucursal (see the invalidation helpers in `useDatosProduccion.ts`).
- Distinguish `isPending` from `isFetching`: `isPending` means "no data yet" (it is also true during the first load), `isFetching` means "a request is in flight". Gate the full `cargando` state on `isPending`/`isError` — as `domains/bodega/pages/Despachos.tsx` and `Devoluciones.tsx` do — so rows already fetched for the same context stay on screen during a revalidation. `domains/bodega/pages/Stock.tsx` adds an explicit refresh affordance on `isFetching` (`refrescando`): the button label becomes `Actualizando...` and the block shows `Actualizando stock...` while in flight. Data from a *previous* identity or sucursal must never remain on screen while the new context loads; that is what the scoped keys and the `AmbitoBodega` remount enforce.
- `Stock` reads use `staleTime: 30_000` with `refetchOnWindowFocus: 'always'` (FE-07) so stock is fresh after movements made in other screens or sessions.
- Read services (`api.ts`, `lib/catalog.ts`) throw user-safe Spanish errors instead of returning `[]`, so a failed read is not mistaken for an empty result (#49); pages surface the message and keep their retry path.
- Domain modules route through `React.lazy` with a `Suspense` fallback, so each domain page loads on first visit (#50).
- The sale draft lives in `sessionStorage` under `ondina:draft-registrar-venta:<perfilId>`, is restored only for that identity and is cleared on logout (#36). Persistence goes through `domains/ventas/components/PersistenciaBorradorVenta.tsx`: writes are debounced 250 ms, flushed on `pagehide`/`visibilitychange` and on unmount, and guarded so a flush never stores another identity's values. Keep heavy work out of render: B3 measured six consecutive `Observaciones` keystrokes going from 6 renders + 6 immediate writes to 0 renders + one grouped write this way.

## Feedback

Use `frontend/src/lib/ui.ts` instead of duplicating error styles:

| Constant | Purpose |
| --- | --- |
| `errorTextCls` | Field validation beneath the input. |
| `inputErrorCls` | Invalid input styling. |
| `errorBlockCls` | Persistent mutation/error summary. |

- Writes report through `useToast` / `components/Toast.tsx`: `exito` (green, `role="status"`, `aria-live="polite"`) for success and `error` (red, `role="alert"`, `aria-live="assertive"`) for failed mutations or business validation. The toast auto-dismisses after 4 s (shared timer in `components/toast-utils.ts`), can be closed with a 44×44 button (`aria-label="Cerrar notificación"`), spans the width on mobile (`left-2 right-2`) and floats `sm:right-4` from that breakpoint. Do not create a second notification system.
- Labeled fields with validation go through `components/CampoFormulario.tsx` (see the next section): validation errors are persistent text under the field, never toasts, and fields keep their values so the user can fix and resubmit.
- `pages/Login.tsx` wires the same attributes directly (`aria-invalid`, `aria-describedby="login-error"`, summary with `role="alert"`); keep that wiring intact when restyling.
- Failed reads/mutations that need a persistent summary use `errorBlockCls` (Login) or an equivalent `role="alert"` red block, as the bodega pages render inline today; prefer the `lib/ui.ts` constant over re-typing those classes when touching those files. Translate technical backend errors into useful Spanish feedback.

## Accessible fields and the confirmed-sale summary

- `components/CampoFormulario.tsx` is the accessible field pattern (A1-12): a stable `useId` id with `<label htmlFor>`, the control receiving `{ id, className, 'aria-invalid', 'aria-describedby' }` (`inputCls` plus `inputErrorCls` when invalid), and the error as `<p id="{id}-error" className={errorTextCls}>` so assistive tech links input and message. `RegistrarVenta`, `RegistrarCliente`, `Gastos` and the sale product rows (`FilaProductoVenta`) use it; RHF keeps refs and focus. Reserve inline `errorTextCls` for list-level messages (`Máximo 6 productos por venta`) and form-level errors (`errors.detalles`).
- `RegistrarVenta` success does not navigate: it renders `domains/ventas/components/ResumenVentaConfirmada.tsx` in place (UX-05). The summary keeps the full folio (read-only input plus a `Copiar folio` button), shows the client, and reads the database-confirmed total with `obtenerResumenVenta` (query key `['ventas', 'resumen', perfilId, id]`, `retry: false`). The form's total is only orientative: the definitive total, discount and stock movements belong to the database.
- `Reintentar` in that summary refetches only the confirmed total — never re-submits the sale; the B3 verification counted exactly 1 `registrar_venta` POST and read-only retries after a simulated failure.
- `Registrar otra venta` resets the form in place; leaving the page is an explicit `Ir a Ventas` link. A late catalog response fills only untouched fields instead of resetting client, quantities or observations.
- On success, invalidation happens only in `hooks/useRegistrarVenta.ts` (`['ventas', 'carga']`, `['ventas', 'historico']` and the `['mi-comision']` prefix for A1-06); failed mutations invalidate nothing, and pages do not call `invalidateQueries` directly.

## Modals, drawer and page title

- `components/Dialog.tsx` wraps the native `<dialog>` element with `showModal()`: `aria-labelledby`/`aria-describedby`, Escape through `onCancel`, focus returned to the opener on close, and every button forced to 44×44 via `[&_button]:min-h-11 [&_button]:min-w-11`. Bodega's despacho modal uses it; each modal line gets a local UUID as key so deleting a previous line preserves the next line's DOM node, value and focus (A1-04) — the local id is never sent to the RPC.
- The mobile navigation drawer in `components/DashboardLayout.tsx` is a modal: while open it renders `role="dialog"` with `aria-modal="true"` and `aria-label="Menú principal"`, Tab/Shift+Tab are trapped inside, Escape closes it, focus returns to the menu button, the page content is `inert`, and clicking the overlay closes it. The drawer shows the user's name, role and sucursal. The sidebar is `inert`/`aria-hidden` whenever it is hidden on mobile; desktop behaviour is unchanged.
- `document.title` is set per route by `DashboardLayout` as `<sección> · Ondina` (or `Ondina` on the home route); do not set titles from individual pages.
- The drawer loads the sucursal name with a dynamic `import('../lib/dashboard')` so the layout does not instantiate the Supabase client at startup; a failure degrades to generic text.

## No UI component library

Mantine (`@mantine/core`, `@mantine/dates`, `@mantine/hooks`) and `dayjs` were removed from `frontend/package.json` and `src/` (B7, 2026-10-14). Consequences:

- Build controls from native elements styled with Tailwind: `<select>` pickers (the Ranking `Mes`/`Año` selector disables future months and limits history to 3 years back), `type="date"` inputs, and `<dialog>` for modals.
- `frontend/src/sin-mantine.test.ts` fails the suite if any `src` file mentions `@mantine` or `dayjs`; keep that guard green.
- The visual aspect is defined by Tailwind (plus `lib/ui.ts` classes), not by a library reset. Do not reintroduce a component library without an approved decision; if a richer control is genuinely needed, raise it as a scope decision first.

## Accessibility and contrast

- Table headers use `thCls` (`text-slate-600`): 7.24:1 on `slate-50`, against the 2.45:1 the previous `slate-400` measured (AA requires 4.5:1). Secondary text uses `text-slate-600` (6.92:1 on `slate-100`); `text-slate-500` is reserved for decorative icons (4.35:1 on `slate-100`). Error text uses `red-700` (`errorTextCls`, `errorBlockCls`). Do not lower text grays on light backgrounds to meet a layout idea.
- Interactive targets are at least 44 px: `inputCls`, `btnPrimary`, `btnSecondary`, `btnDanger` and `btnDangerOutline` carry `min-h-11`; icon-only buttons (menu toggle, `Cerrar menú`, Toast close, Dialog close) are `min-h-11 min-w-11`; drawer nav items are the same height.
- Live regions and semantics come from the roles of `EstadoVista`, `Toast` and `Dialog` (`status`, `alert`, `dialog`, `aria-modal`, `inert`); keep them intact when restyling.
- Use one responsive DOM/form tree: tables may become cards below 640 px, but must not duplicate React Hook Form registrations.

## Layout and numeric input

- Verify 375px, 768px and 1280px layouts, including keyboard use and horizontal overflow (`scrollWidth <= innerWidth` was the acceptance bar for the frontend-ux round).
- Stack form grids and allow headers/actions to wrap on small screens (`min-w-0` on grid children; long text wraps).
- Use the helpers in `frontend/src/lib/format.ts` for `es-CL` thousands, parsing and live formatting (`formatMiles`, `parseMiles`, `formatMilesInput`, `displayMilesInput`). Numeric text inputs use `inputMode="numeric"`; keep display strings separate from submitted values.
- Reuse established empty-input and validation behavior instead of parsing separators or assigning numeric defaults ad hoc.

## Build and bundle budget

- `npm run size` runs `frontend/scripts/check-bundle-size.mjs` and checks five gzip metrics against `frontend/bundle-budget.json`: entry JS gzip, entry CSS gzip, largest raw JS chunk, and the initial-total JS/CSS gzip sets (JS bases measured 2026-10-14 at commit `c2bcd87`; on 2026-10-15 the owner approved re-basing both CSS metrics to 8,405 B at `5466c4e`, recorded as `cssDate`/`cssCommit`, after the approved mobile UI grew CSS 9.8%). Limits are the measured base plus `headroomPercent: 10` (rounded up). The checker itself is covered by `frontend/scripts/check-bundle-size.test.mjs`.
- `frontend/vite.config.ts` pins `@supabase/*` and its recursive dependencies into a dedicated `vendor-supabase` chunk through `build.rolldownOptions.output.codeSplitting.groups` (A1-16). Without that group, imports from the app shell merge Supabase into the entry whenever a real `.env.local` is present, which is what caused the B1/B2 size regression.
- Measure with a real `frontend/.env.local` (local Supabase URL and anon key; it stays git-ignored). A build without it does not represent the operating bundle and understates the entry set (B6 evidence).
- After the Mantine removal (B7), the measured entry was ≈94.8 kB gzip JS and ≈6.9 kB gzip CSS, with domain pages still lazy. Method, tables and history live in [performance.md](performance.md).
- Known preexisting build notice: Vite's dynamic/static import warning for `lib/dashboard.ts` (the layout loads it dynamically by design).

## Comments

Explain non-obvious reasons with concise `//` comments and the related HU when useful. Reserve JSDoc/TSDoc for exported contracts that need it. Remove commented-out code and debugging logs; avoid restating readable implementation.

## Server pagination

Use the shared **Previous / Next** pattern (`components/Paginacion.tsx`, default export) for growing histories. The Spanish live region announces “Página X de Y · N registros”; both buttons have accessible labels, native disabled states and targets of at least 44×44 px. Controls wrap at narrow widths. Props: `pagina` (one-based), `total` (exact filtered count), `tamanoPagina` (default 20), `onCambiar(page)`, optional `cargando` (disables navigation and announces updating), and optional `etiqueta` (navigation landmark label). Empty results retain page 1 with both buttons disabled.

`lib/paginacion.ts` exports `TAMANO_PAGINA = 20`, `Pagina<T> = { filas: T[]; total: number }`, `rangoPagina(page, size)` (inclusive zero-based PostgREST bounds) and `totalPaginas(total, size)`. Services apply filters before `.range(from, to)` and request `count: 'exact'`; order by timestamp and a unique ID for deterministic ties. Include identity, role, branch, filters and page in React Query keys. Use `keepPreviousData` while paging within the same scope and filters, show updating feedback, and reset page to 1 when a filter changes. Do not carry placeholders across identities, branches or filters. Clamp an obsolete last page after the count shrinks.

Bodega splits `useDatosBodega` (catalog, authoritative stock/envases and seller load) from `usePaginaBodega` (filtered dispatch headers plus details, containers and returns for visible IDs only). Date bounds are Santiago civil days with an exclusive next-day upper bound. The returns selector is itself paginated; a separate ID-and-branch-scoped query pins its selected dispatch so paging does not drop the return draft. The returns panel on Despachos describes only the current page. No totals depend on adding paginated rows. Successful writes invalidate every cached Bodega page and resource in the current identity/branch, the stock view and seller load; failed writes do not invalidate or clear drafts.

References: [Supabase range](https://supabase.com/docs/reference/javascript/range), [TanStack paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries).
