# E8 — Vendor Location Map (HU-16)

[Sprint 2 index](README.md)

## Objective

If the business ratifies it in [E1](e01-preparation-and-decisions.md), deliver an administrator-only map with each active seller's last known location. Capture happens only during the declared workday, while the app is open and with the seller informed. If it is not ratified, close HU-16 by decision; it is not counted as implemented.

## Covers

- HU-16 (#64, OND-w76.7), RF-27.

**Roles:** Backend/Supabase (policies, retention, pgTAP), Frontend (`administracion/pages/Ubicaciones.tsx` and a capture hook in `ventas`), CI/CD (headers), Security/review, Documentation (privacy notice). **Depends on:** the E1 decision and a legal/labour sign-off (see Constraints).

## Repository evidence

- `Ubicaciones.tsx` renders the `ModulePage` placeholder ([story status](../user-stories.md)).
- `public.ubicaciones_vendedores` already stores coordinates (`numeric(9,6)`) (`supabase/migrations/20261013000000_remote_baseline.sql:1290-1298`). The policies in `20261013181647_harden_database_security.sql:146-150,837-838` let a seller insert their own row and let administrators read rows in their scope. The earlier audit note (bodega reading all sucursales) refers to the replaced baseline policy and looks stale; whether production has the new policy is [uncertain].
- No PostGIS, retention job or Realtime publication exists for this table.
- `frontend/vercel.json` sends `Permissions-Policy: geolocation=()`, which disables geolocation for the whole origin. The CSP `img-src` is `'self' data:`.

## Open scope questions (not answered by the sources)

- Live position, last point only, or a history trail?
- Are customer locations or routes in scope? Customers have only a text address, without coordinates.
- Device (phone/tablet), capture frequency, precision and hours.
- Retention period, which administrators can see it, and the sellers' contract type (art. 22 exemption).

## Platform limits

- Browsers deliver positions only to a visible, foreground page in a secure context after the user grants permission. A web page or PWA cannot track in the background ([W3C Geolocation, 2026-03-26](https://www.w3.org/TR/geolocation/); [MDN Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), accessed 2026-10-21). The UI must not promise continuous tracking.
- `Permissions-Policy: geolocation=()` makes `getCurrentPosition`/`watchPosition` fail with `PERMISSION_DENIED` ([MDN `geolocation` directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation)).

## Options

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Leaflet (plain, small wrapper) with OSM raster tiles; tile URL in configuration so the provider can change | Free library; ~42 KB gz; one CSP change; no token | OSM tile servers are donation-funded and best-effort, with no SLA and the right to block heavy use ([OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/)); attribution required | Map 1–1.5 d; story 4–5.5 d |
| B. MapLibre GL with self-hosted Protomaps PMTiles | No per-request fee; can be cached for intermittent connectivity | ~440 KB gz (lazy-load); WebGL; tile build pipeline; `worker-src`/`blob:` CSP; Range-request hosting [uncertain] | 6–8 d |
| C. Google Maps JS (`@vis.gl/react-google-maps`) | Geocoding/routing available if needed later | Billing account; 10,000 free dynamic map loads/month then USD 7 per 1,000 ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [2025-03-01 changes](https://developers.google.com/maps/billing-and-pricing/march-2025)); broad CSP; online only | 3–4 d + billing setup |

Excluded: Mapbox GL JS. It is proprietary, needs a token, and requires a commercial licence for internal business or vehicle use ([Mapbox pricing](https://www.mapbox.com/pricing)).

**Recommendation: A.** The need is a few markers on an internal admin screen. Option A has the smallest bundle and header change and no account. Keeping the tile URL configurable allows a move to a paid OSM-derived provider (e.g. Stadia) if usage grows. Use plain Leaflet instead of `react-leaflet` unless the Hippocratic-2.1 licence of `react-leaflet` is reviewed and accepted. Choose B only if offline maps are ratified, and C only if geocoding/routing becomes a requirement.

## Constraints (legal and privacy)

- Ley 21.719 (published 2024-12-13) amends Ley 19.628 and takes effect on 2026-12-01 ([BCN](https://www.bcn.cl/leychile/navegar?idNorma=1209272), [Diario Oficial](https://www.diariooficial.interior.gob.cl/publicaciones/2024/12/13/44023/01/2583630.pdf)). Design for it now: legal basis, notice of purpose and duration, data minimization and retention. Whether consent or legitimate interest is the right basis needs counsel [uncertain].
- The Dirección del Trabajo accepts GPS for field sales when it does not become surveillance and is in the Reglamento Interno ([ORD 148, 2022-01-26](https://dt.gob.cl/legislacion/1624/w3-article-121818.html)). It rejected route tracking for a worker exempt under art. 22 ([ORD 1547, 2017-04-07](https://dt.gob.cl/legislacion/1624/w3-article-111610.html)).
- Never log coordinates. Tests use synthetic coordinates only (#64 acceptance).

## Header changes (`frontend/vercel.json`, CI/CD owner, human gate)

- `Permissions-Policy`: `geolocation=(self)`; keep `camera=(), microphone=(), payment=()` unless [E7](e07-gasto-receipt-whatsapp.md) decides otherwise.
- CSP for option A: `img-src 'self' data: https://tile.openstreetmap.org` (or the chosen provider host). Keep `Referrer-Policy: strict-origin-when-cross-origin`, because the OSM policy requires a valid Referer.

## Acceptance criteria

- [ ] Purpose, notice, hours, precision, frequency and retention are approved and recorded before any capture code merges.
- [ ] A seller sees when location is being shared, and denying permission leaves a usable screen.
- [ ] Only administrators within scope can read locations; seller, bodega, produccion and `anon` get no rows (pgTAP).
- [ ] Rows older than the approved retention are deleted by a scheduled job or documented procedure (pgTAP or a rehearsal record).
- [ ] No coordinates appear in logs, Sentry events or issues (review plus a test on the logger).
- [ ] The map shows OSM attribution.
- [ ] `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`.

## Verification

- `supabase test db`.
- The frontend commands.
- Staging checks for permission granted/denied and interrupted connection on Android Chrome and iOS Safari, recorded in Beads.

## Risks

- The law takes effect during or right after the sprint; shipping capture without a legal basis is the main risk.
- OSM tile blocking under heavier use; mitigated by the configurable provider.
- pg_cron availability for retention is [uncertain]; a manual or Edge Function schedule is the fallback.
