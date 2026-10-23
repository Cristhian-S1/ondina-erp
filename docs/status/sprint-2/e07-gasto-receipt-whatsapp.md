# E7 — Expense Receipt Photo and WhatsApp Sending (HU-07 extension)

[Sprint 2 index](README.md)

## Objective

In the Vendedor module, the "Gasto" action lets the seller photograph the expense invoice. The photo is stored privately, linked to the expense, and can be sent through WhatsApp.

> **Contexto de negocio:** el vendedor registra un gasto (combustible, avería u otro), toma la foto de la boleta o factura y la comparte por WhatsApp con administración. El comprobante válido es el que queda en Ondina; WhatsApp es una comodidad.

## Covers

- HU-07 (#69, OND-w76.12): the attachment criterion that is still missing.
- The new WhatsApp requirement, which has no GitHub or Beads issue yet. It is created in [E1](e01-preparation-and-decisions.md).

**Roles:**
- Backend/Supabase: bucket, Storage policies, path validation, pgTAP.
- Frontend: `frontend/src/domains/ventas/pages/Gastos.tsx`, `ventas/api.ts`, `ventas/schemas.ts`.
- CI/CD: `frontend/vercel.json` headers.
- Security/review (mandatory) and Testing.

**Depends on:** the E1 decision (formats, retention, sending mode); the human gate for the schema and header changes. Coordinate with [E6](e06-corrections-and-cancellation.md) on cancelling expenses.

## Explicit WhatsApp limitation

**Fully automatic sending with no user action is not possible from the seller's own WhatsApp through any official channel.**
- Web Share and `wa.me` both require the seller to pick the chat and tap Send.
- The only official automatic path is the WhatsApp Cloud API, sending from a business number that Ondina controls to recipients who opted in (for example administrators or the accountant).
- Outside a 24-hour customer-service window, that path can send only a Meta-approved template, and each delivered message is billed.

Sources: [send-messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages), [pricing](https://developers.facebook.com/docs/whatsapp/pricing) and [opt-in](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in), all accessed 2026-10-21.

## Repository evidence

- **Expense insert:** `ventas/api.ts` inserts `gastos_extras` with `comprobante_url: null`. The column is a nullable `text` (`supabase/migrations/20261013000000_remote_baseline.sql:1119-1134`).
- **RLS:** `gastos_extras_select_b2` and `gastos_extras_insert_b2` (`20261013181647_harden_database_security.sql:76-80`). A seller inserts only their own rows for `mi_sucursal()`. There is no UPDATE policy, so a photo cannot be attached after insert.
- **Storage:** no bucket exists in the migrations. OND-w76.12 warns that the historical `storage.objects` policies are unsafe and must not be reused.
- **Headers:** `frontend/vercel.json` sets CSP `img-src 'self' data:`, so a `blob:` preview and Supabase signed-URL images are blocked. It also sets `Permissions-Policy: camera=() … geolocation=()`.
- **Story:** the expense cannot be modified or deleted by the seller once registered (RNF-10, RNF-14; [sales stories](../../product/stories/sales.md#hu-07)).

## Part 1 — storing the photo (required by HU-07)

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Client generates the `gasto_id` (UUID), re-encodes the photo, uploads it to `{sucursal_id}/{vendedor_id}/{gasto_id}.jpg`, then inserts the row with the object path. A trigger checks that the path prefix matches the row's sucursal/seller | No UPDATE policy needed; keeps the row immutable; RLS covers the upload | Abandoned uploads leave orphans that need a cleanup job | M (2–3 d) |
| B. `security definer` RPC `registrar_gasto_con_comprobante` after a client upload, inserting and validating in one call | One server-side check point | Still two steps (upload, RPC); definer function needs careful review | M (3 d) |
| C. Insert first, then add a narrow UPDATE (column `comprobante_url`, only while null, only by the owner) | Simple order | Weakens immutability; another policy to secure | S–M (2 d) |

**Recommendation: A.**
- Private bucket `comprobantes-gastos` (name to confirm) with `file_size_limit` 5 MB and `allowed_mime_types` `image/jpeg,image/png`.
- `storage.objects` INSERT allowed when `(storage.foldername(name))[1] = private.mi_sucursal()::text` and `[2] = auth.uid()::text`. SELECT for the owner, and for administrators in their sucursal (all if global). No UPDATE or DELETE ([Storage access control](https://supabase.com/docs/guides/storage/security/access-control); [buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)).
- Store the object path, not a URL. Admins view it with `createSignedUrl(path, 60–300)` ([serving downloads](https://supabase.com/docs/guides/storage/serving/downloads)).
- Re-encode on a canvas to JPEG, quality ≈ 0.8, longest side ≈ 1600 px. This removes EXIF/GPS metadata and stays under WhatsApp's 5 MB image limit ([media reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)). No new dependency is needed.
- Capture with `<input type="file" accept="image/*" capture="environment">` ([MDN capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)).

## Part 2 — sending by WhatsApp

| Option | Automatic | Pros | Cons | Effort | Cost |
| --- | --- | --- | --- | --- | --- |
| A. Web Share with the file (`navigator.canShare({files})` → `navigator.share({files, text})` on the button click) | No; the seller picks the chat and taps Send | Sends the real image; no account, token or backend | Not supported in Firefox (Android/desktop); no preselected recipient; the call must run in the click with the file already in memory, or the activation expires ([MDN share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)); no delivery proof in Ondina | S (1–1.5 d) | 0 |
| B. `wa.me/<number>?text=` | No; tap Send | Recipient preselected; works everywhere | Text only, no attachment ([WhatsApp FAQ](https://faq.whatsapp.com/425247423114725)); a signed link in the text would expose the receipt to anyone holding it | S (0.5 d) | 0 |
| C. Cloud API from an Edge Function: utility template with an IMAGE header to opted-in admins, plus a status webhook and a `gasto_notificaciones` log | **Yes** | Hands-free; delivery status; central record | Meta Business verification, a dedicated number that cannot also be used in the normal app ([phone numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)); template review up to 24 h; Meta may recategorize utility as marketing ([template guidelines](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines)); secrets and webhook operations | L (4–6 d plus Meta lead time) | Per delivered template; Chile utility ≈ USD 0.02 [uncertain, third-party mirrors]; since 2026-10-01 service messages are charged again after 1,000 free per number per month ([pricing](https://developers.facebook.com/docs/whatsapp/pricing)) |
| D. C plus Coexistence on an existing WhatsApp Business app number | Yes | Keeps the human app on the same number | Fixed 20 messages/s; groups and broadcasts unsupported; 24 h history-sync deadline; onboarding may require a Tech Provider [uncertain] ([coexistence](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)) | L+ | As C |

**Recommendation for Sprint 2: Part 1 option A plus Part 2 option A, with B as the fallback when `canShare` is false.**
- The fallback sends the expense summary only; no link, and no supplier data in the text.
- The button appears after the expense saves, so a failed share never loses the record.
- Option C is a later, separate decision (Sprint 3+) because it needs a Meta account, a number, opt-in records, cost approval and data-processing review. Start Meta verification early if the user approves it.

## Privacy

- **Data on the receipt:** receipts can carry supplier RUT, names and partial card numbers. Re-encode and offer cropping before upload.
- **WhatsApp copies:** with options A/B the image lives in the seller's WhatsApp account and backups, outside Ondina's RLS. The user must accept this in E1.
- **Cloud API:** Meta processes the data and keeps message data up to 30 days ([data privacy](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/data-privacy-and-security)).
- **Law:** Ley 21.719 takes effect on 2026-12-01 ([BCN](https://www.bcn.cl/leychile/navegar?idNorma=1209272)). Mention receipts and WhatsApp sharing in the privacy notice; the legal basis needs review [uncertain].
- **Logging:** never log image bytes or signed URLs.

## Header changes (`frontend/vercel.json`, CI/CD owner, human gate)

- `img-src 'self' data: blob: https://<project-ref>.supabase.co`. Pin the project host rather than the `*.supabase.co` wildcard.
- `connect-src` already allows Supabase.
- Keep `camera=()`. No source says it affects `<input capture>`, which hands off to the OS camera [uncertain]. Change it to `camera=(self)` only if the device test fails.
- `web-share` defaults to `'self'`, so no change is needed.

## Acceptance criteria

- [ ] Saving an expense with a photo stores one object under `{sucursal_id}/{vendedor_id}/` and the row holds its path, not a URL.
- [ ] Another seller and another sucursal are denied read and write on that object; `anon` is denied (pgTAP/Storage test).
- [ ] The seller cannot overwrite or delete a stored receipt (test).
- [ ] A non-image or a file over 5 MB is rejected by the client and by the bucket (test).
- [ ] A row whose path prefix does not match its sucursal/seller is rejected by the database (pgTAP).
- [ ] The uploaded JPEG contains no EXIF/APP1 segment (unit test on the re-encoder).
- [ ] An administrator of the sucursal opens the receipt through a signed URL that expires within 300 s.
- [ ] On Android Chrome and iOS Safari the button opens the share sheet with the image. Where `canShare` is false, the `wa.me` text fallback opens. Results are recorded in Beads.
- [ ] The UI states that sending through WhatsApp requires confirming in WhatsApp.
- [ ] `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`.
- [ ] Security/review verdict: pass.

## Verification

- `supabase db reset` + `supabase test db` (local).
- The frontend commands from `frontend/`.
- A manual device check at 375/412 px with a synthetic receipt image (no real supplier data).

## Risks

- Orphan objects from abandoned uploads; schedule a cleanup of objects without a row.
- Safari activation expiry if the share follows an `await`.
- Supplier data leaving the system through WhatsApp.
- Option C cost and recategorization risk if adopted later.
- The current HU-07 text does not mention WhatsApp, so product must confirm the requirement.
