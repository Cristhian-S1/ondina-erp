# Sprint 2 Plan

Prepared 2026-10-21 on `develop` at `edaa424`. This is a plan with options per stage, not an acceptance record. Task status lives in Beads and story intent in the [stories](../../product/stories/README.md) and [requirements](../../product/requirements.md). Roles, models, handoffs and human gates are in [orchestration](../../orchestration/README.md). Remove this folder once Sprint 2 is closed; Git keeps the history.

## Summary

- Thirteen Sprint 2 stories are open (#6, #58–#69). Every hard Beads blocker is closed; the only active dependency is HU-12 waiting on HU-11.
- Four stories need a decision before any build: HU-05, HU-06, HU-07 receipt policy and HU-16. E1 handles them together with the new WhatsApp requirement.
- **Admin writes:** since the B2 hardening, the catalog, profile and rule tables have no write path for `authenticated`, and the report views are readable only by `service_role`. Every admin stage therefore starts with database contracts (RPCs), which are the Backend role's work.
- **WhatsApp:** automatic sending is possible only through the Cloud API from a business number. From the seller's WhatsApp the seller must always confirm (see [E7](e07-gasto-receipt-whatsapp.md)).
- **Remote migrations:** nothing reaches the remote database before the backup rehearsal (#41, [E10](e10-platform-carry-over.md)).

## Stages

| Stage | Scope | Recommendation | Main roles |
| --- | --- | --- | --- |
| [E1](e01-preparation-and-decisions.md) | Fleet setup; decisions on HU-05/06/07/16 and WhatsApp | One decision session with option sheets | Coordinator, user |
| [E2](e02-user-administration.md) | HU-10 users | Edge Function (invite) + RPC with a last-admin guard; no JWT claims | Backend, Frontend, Security |
| [E3](e03-catalog-and-commission-rules.md) | HU-17 catalog, HU-15 rules | Admin RPCs with audit; atomic rule versioning + simulation | Backend, Frontend |
| [E4](e04-customers.md) | HU-11 → HU-12 | Invoker RPCs over the existing views; in-app alert list | Backend, Frontend |
| [E5](e05-bodega-adjustments-and-losses.md) | HU-26, HU-29 | Idempotent RPCs; daily reconciliation view | Frontend, Backend |
| [E6](e06-corrections-and-cancellation.md) | HU-13 | Cancellation RPCs + audit-history read first; correction link later | Backend, Frontend, Security |
| [E7](e07-gasto-receipt-whatsapp.md) | HU-07 receipt + WhatsApp | Private Storage + Web Share (`wa.me` fallback); Cloud API later | Backend, Frontend, CI/CD, Security |
| [E8](e08-map-and-gps.md) | HU-16 map | Only if ratified: Leaflet + OSM tiles, foreground capture, legal sign-off | Backend, Frontend, CI/CD, Security |
| [E9](e09-reports-and-closeout.md) | HU-14 + status matrix refresh | Invoker report RPCs; CSV built from the same result | Backend, Frontend, Documentation |
| [E10](e10-platform-carry-over.md) | #39, #41, #44, #46, #54, #86 | One CI/CD slot in parallel; #41 first | CI/CD, Security |

**Suggested waves (at most three workers):**

| Wave | Work |
| --- | --- |
| W1 | E1 and E10 #41 |
| W2 | E2 Backend + E5 Frontend + E10 |
| W3 | E2 Frontend + E3 Backend + E10 |
| W4 | E3 Frontend + E4 Backend + E7 Backend |
| W5 | E4/E7 Frontend + Security review + Testing |
| W6 | E6 |
| W7 | E8 (if ratified) and E9, then Documentation |

## Status of issues and stories (2026-10-21)

Sources: `gh issue list --state all`, `bd list`, `bd ready`, `bd blocked`, the [story status matrix](../user-stories.md) and the code paths named in each stage.

| ID | State | Source | Note |
| --- | --- | --- | --- |
| HU-05 / #6 / OND-w76.14 | Pending (decision) | GH open, `question`; matrix "UI removed" | [E1](e01-preparation-and-decisions.md) |
| HU-06 / #68 / OND-w76.11 | Pending (decision) | GH open, `question`; matrix "Deferred" | No SII provider decided |
| HU-07 / #69 / OND-w76.12 | Partial | Matrix "Partial"; `ventas/api.ts` sets `comprobante_url: null` | [E7](e07-gasto-receipt-whatsapp.md) |
| Expense photo → WhatsApp | No issue | No match in GH, Beads, `docs/product`, `frontend/src` or `supabase` | Create in E1 |
| HU-10 / #58 / OND-w76.1 | Pending | GH open P1; `bd ready` | No write path on `perfiles` |
| HU-11 / #59 / OND-w76.2 | Pending | Matrix "No UI"; view granted to `service_role` only | [E4](e04-customers.md) |
| HU-12 / #60 / OND-w76.3 | Pending, blocked | `bd blocked` → OND-w76.2 | After HU-11 |
| HU-13 / #61 / OND-w76.4 | Partial | Matrix "Partial"; only `corregir_devolucion` exposed | [E6](e06-corrections-and-cancellation.md) |
| HU-14 / #62 / OND-w76.5 | Pending | Matrix "Placeholder"; report views `service_role` only | [E9](e09-reports-and-closeout.md) |
| HU-15 / #63 / OND-w76.6 | Pending | Matrix "No UI"; DB guards exist, no write grant | [E3](e03-catalog-and-commission-rules.md) |
| HU-16 / #64 / OND-w76.7 | Pending (decision) | GH P3; `vercel.json` `geolocation=()` | [E8](e08-map-and-gps.md) |
| HU-17 / #65 / OND-w76.8 | Pending | Matrix "No UI"; no write grant | [E3](e03-catalog-and-commission-rules.md) |
| HU-26 / #66 / OND-w76.9 | Partial | Matrix "Backend only"; window trigger exists | [E5](e05-bodega-adjustments-and-losses.md) |
| HU-29 / #67 / OND-w76.10 | Partial | Matrix "Partial"; `mermas` supports `despacho_id` | [E5](e05-bodega-adjustments-and-losses.md) |
| HU-31 / #11 | Partial | Follow-up #44 open | [E10](e10-platform-carry-over.md) |
| HU-01–04, 08, 09, 19–25, 27, 28 | Done (issue closed) | GH: Sprint 1 issues and listed follow-ups closed | Production acceptance not verified |
| #39 / OND-get | Open | GH, Beads | E10 |
| #41 / OND-5gi.10 | Open (ready) | GH, Beads gate | E10, gates remote migrations |
| #44 / OND-d40 | Open | GH, Beads | E10 / E2 overlap |
| #46 / OND-o5g | In progress | Beads | E10 |
| #54 / OND-5a4 | In progress | Beads | E10 |
| #86, OND-c07.23, OND-c07.24 | Open | GH, Beads | E10 |

**Discrepancy:** the [story status matrix](../user-stories.md) (baseline `059172a`, 2026-10-13) still lists follow-ups #27, #33–#37, #42, #48, #49, #70 and #72 as open, and HU-23 as Partial. All of those issues are closed on GitHub. E9 refreshes the matrix with dated evidence.

## Cross-cutting rules for every stage

- **Verification:** frontend checks run from `frontend/`: `npm run lint`, `npm run build`, `npm run test`. Database checks run on a local stack: `supabase db reset`, `supabase test db`.
- **Database ownership:** admin writes go through `security definer` RPCs with `search_path = ''`, an explicit role/sucursal/`activo` check, a mandatory reason (`ondina.motivo`) and an idempotency key where retries can duplicate. Stock, compensation and audit stay in the database ([database](../../engineering/database.md)).
- **Remote actions:** no `supabase db push`, function deploy, secret creation, push, PR or deploy without the human gates in [handoffs](../../orchestration/handoffs.md).

## Research basis

Three research passes were run on 2026-10-21: map options, admin features and WhatsApp feasibility. Their findings and source URLs are cited inside E2–E9; claims that could not be verified are marked [uncertain]. The working reports were temporary session files and are not part of the repository.
