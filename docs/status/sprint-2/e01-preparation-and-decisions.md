# E1 — Preparation and Scope Decisions

[Sprint 2 index](README.md)

## Objective

Make the fleet dispatchable and turn the open `question` items into recorded decisions before any build stage depends on them.

## Covers

- HU-05 (#6, OND-w76.14), HU-06 (#68, OND-w76.11), HU-07 receipt policy (#69, OND-w76.12), HU-16 (#64, OND-w76.7).
- The new gasto-photo/WhatsApp requirement, which has no issue yet ([E7](e07-gasto-receipt-whatsapp.md)).

**Role:** Coordinator drafts the decision options, the user decides and Documentation records the result. **Depends on:** nothing.

## Repository evidence

- HU-05: the seller page was removed; the requirement and DB design remain ([story status](../user-stories.md), HU-05 row).
- HU-06: document fields exist in the SQL design only; no SII integration ([story status](../user-stories.md), HU-06 row).
- HU-07: `ventas/api.ts` inserts `comprobante_url: null`, and no bucket exists. OND-w76.12 warns that the historical `storage.objects` policies are unsafe.
- HU-16: `frontend/vercel.json` sends `Permissions-Policy: … geolocation=()`, which blocks the browser Geolocation API.
- `docs/orchestration/profiles.local.json` predates the role assignment in [roles](../../orchestration/roles.md).

## Options

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. One decision session covering all five items, with a written option sheet per item | One user interruption; unblocks E7/E8 together | Longer session; HU-06 may need external (accountant/SII) input | S (0.5–1 d coordinator) |
| B. Decide per stage just before it starts | Decisions use the freshest context | Repeated interruptions; E7/E8 may stall mid-sprint | S, spread out |
| C. Defer every `question` item to Sprint 3 and build only the defined stories | No decision cost now | HU-07 stays partial; the WhatsApp request is not delivered | none |

**Recommendation: A.** Four of the five items gate E7, E8 or a deferral, and each option sheet can reuse the research in the stage files. If HU-06 needs external input, it is the only item to defer.

## Decisions to record

| Item | Question for the user | Options to offer |
| --- | --- | --- |
| HU-05 | Is the seller's empty-container view still needed? | Restore a read-only view from the existing design / retire it like HU-18 |
| HU-06 | Does Sprint 2 issue boletas/facturas? | Defer (recommended without SII provider decision) / record document number only / integrate a provider |
| HU-07 | Receipt formats, size limit, retention, who can view | JPEG/PNG ≤ 5 MB, retained while the gasto exists, owner + admin of the sucursal |
| WhatsApp | Which sending mode? | Share sheet (user confirms) / Cloud API automatic notification / both phased ([E7](e07-gasto-receipt-whatsapp.md)) |
| HU-16 | What is the map for, and is location tracking allowed? | See [E8](e08-map-and-gps.md) |

## Acceptance criteria

- [ ] Each of the five items has a dated Decision section in its Beads issue (or a new issue for WhatsApp).
- [ ] Items decided as deferred are marked deferred in Beads.
- [ ] `profiles.local.json` matches the role/model table, and each active role shows `launch.effective` equal to its assignment.

## Verification

`bd show <id>` per item; Orca launch receipts. No frontend commands apply.

## Risks

- Unresolved decisions stall E7 and E8.
- If the Codex quota runs out, the fallback needs the user's approval.
- Creating the WhatsApp issue on GitHub is an external action, so the user must authorize it; a Beads issue is enough to plan.
