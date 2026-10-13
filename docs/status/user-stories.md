# User-Story Implementation

Code review baseline: `develop` commit `059172a`, 2026-10-13; the code was re-reviewed on 2026-10-13 during the [deep audit](../archive/audits/2026-10-13/auditoria-profunda-2026-10-13.md), including the HU-31 session-restoration fix now in `develop`. This matrix describes repository implementation, not live database behavior or production acceptance. The [requirements](../product/requirements.md) and [story criteria](../product/stories/README.md) remain authoritative for intent.
**Present** means relevant code exists; **Partial** means an explicit gap is known; **Placeholder/No UI/Backend only** describe the missing delivery surface. Tasks and their current status live in Beads, not this table.

## Sprint summary

Sprint 1 (GitHub issues #1–#19, all closed) delivered **17 stories**, 16 of them with open follow-ups listed per story; **13 items are pending for Sprint 2** — HU-05, HU-06, the HU-07 receipt upload (#69), HU-10 through HU-17, HU-26 and HU-29 — and **2 stories were removed from scope** on 2026-08-01 (HU-18, HU-30; IDs are not reused).

Status legend for the `Sprint` column:

- `Completada` — the Sprint 1 issue is closed and no open follow-up issue is listed for the story.
- `Completada — en revisión` — the Sprint 1 issue is closed, but open follow-up issues are listed in the row: delivered with known defects or pending verification.
- `Pendiente (Sprint 2)` — not delivered in Sprint 1; the linked open issue carries it in Sprint 2.
- `Retirada` — removed from delivery scope (HU-18, HU-30); the business need stays recorded in the RF/RNF catalog.

"Completed" means the Sprint 1 GitHub issue was closed; it is **not** a production-acceptance claim. The `GitHub` column links the tracking issue for each story.

## Sales

| Story | Sprint | GitHub | Implementation | Evidence or limit |
| --- | --- | --- | --- | --- |
| [HU-01](../product/stories/sales.md#hu-01) | `Completada` | [#1](https://github.com/Cristhian-S1/ondina-erp/issues/1) | Present | `RegistrarVenta.tsx`, sales services and `registrar_venta`; authorization/stock require real integration checks. |
| [HU-02](../product/stories/sales.md#hu-02) | `Completada — en revisión` | [#2](https://github.com/Cristhian-S1/ondina-erp/issues/2) | Present | `RegistrarCliente.tsx` and customer services. Open follow-up: [#72](https://github.com/Cristhian-S1/ondina-erp/issues/72) (administrative creation/consultation by sucursal and vendedor). |
| [HU-03](../product/stories/sales.md#hu-03) | `Completada — en revisión` | [#5](https://github.com/Cristhian-S1/ondina-erp/issues/5) | Present | `Carga.tsx`; seller-load query. Open follow-up: [#49](https://github.com/Cristhian-S1/ondina-erp/issues/49) (distinct error, permission and empty-list states). |
| [HU-04](../product/stories/sales.md#hu-04) | `Completada — en revisión` | [#4](https://github.com/Cristhian-S1/ondina-erp/issues/4) | Present | `Clientes.tsx`; route/customer queries. Open follow-up: [#49](https://github.com/Cristhian-S1/ondina-erp/issues/49) (service error handling). |
| [HU-05](../product/stories/sales.md#hu-05) | `Pendiente (Sprint 2)` | [#6](https://github.com/Cristhian-S1/ondina-erp/issues/6) | UI removed | No seller page; the business requirement and database design are retained and their scope is still to be ratified. Carried over from Sprint 1. |
| [HU-06](../product/stories/sales.md#hu-06) | `Pendiente (Sprint 2)` | [#68](https://github.com/Cristhian-S1/ondina-erp/issues/68) | Deferred | Sale document fields exist in SQL design; document issuance is not implemented. |
| [HU-07](../product/stories/sales.md#hu-07) | `Completada — en revisión` | [#3](https://github.com/Cristhian-S1/ondina-erp/issues/3) | Partial | `Gastos.tsx` records expenses; the receipt upload required by the story is absent and deferred to Sprint 2. Open follow-ups: [#69](https://github.com/Cristhian-S1/ondina-erp/issues/69), [#35](https://github.com/Cristhian-S1/ondina-erp/issues/35) (America/Santiago jornada). |
| [HU-08](../product/stories/sales.md#hu-08) | `Completada — en revisión` | [#19](https://github.com/Cristhian-S1/ondina-erp/issues/19) | Present | `RankingVendedores.tsx`. Open follow-ups: [#27](https://github.com/Cristhian-S1/ondina-erp/issues/27) (anonymous view access), [#34](https://github.com/Cristhian-S1/ondina-erp/issues/34) and [#35](https://github.com/Cristhian-S1/ondina-erp/issues/35) (historical rules and America/Santiago periods). |
| [HU-09](../product/stories/sales.md#hu-09) | `Completada — en revisión` | [#18](https://github.com/Cristhian-S1/ondina-erp/issues/18) | Present | `MiComision.tsx`; historical rules and permissions need database verification. Open follow-ups: [#27](https://github.com/Cristhian-S1/ondina-erp/issues/27) (anonymous view access), [#34](https://github.com/Cristhian-S1/ondina-erp/issues/34) (historical commissions), [#35](https://github.com/Cristhian-S1/ondina-erp/issues/35) (America/Santiago periods). |

## Administration

| Story | Sprint | GitHub | Implementation | Evidence or limit |
| --- | --- | --- | --- | --- |
| [HU-10](../product/stories/administration.md#hu-10) | `Pendiente (Sprint 2)` | [#58](https://github.com/Cristhian-S1/ondina-erp/issues/58) | Placeholder | `Administracion.tsx` renders `ModulePage`. |
| [HU-11](../product/stories/administration.md#hu-11) | `Pendiente (Sprint 2)` | [#59](https://github.com/Cristhian-S1/ondina-erp/issues/59) | No UI | `v_historial_cliente` is SQL design, not a delivered customer-history screen. |
| [HU-12](../product/stories/administration.md#hu-12) | `Pendiente (Sprint 2)` | [#60](https://github.com/Cristhian-S1/ondina-erp/issues/60) | No UI | Inactive-customer view design; alert workflow absent. |
| [HU-13](../product/stories/administration.md#hu-13) | `Pendiente (Sprint 2)` | [#61](https://github.com/Cristhian-S1/ondina-erp/issues/61) | Partial | Administrator return corrections in bodega; general record correction/audit UI incomplete. |
| [HU-14](../product/stories/administration.md#hu-14) | `Pendiente (Sprint 2)` | [#62](https://github.com/Cristhian-S1/ondina-erp/issues/62) | Placeholder | `Reportes.tsx` renders `ModulePage`. |
| [HU-15](../product/stories/administration.md#hu-15) | `Pendiente (Sprint 2)` | [#63](https://github.com/Cristhian-S1/ondina-erp/issues/63) | No UI | Commission-rule design; administration page has no configuration form. |
| [HU-16](../product/stories/administration.md#hu-16) | `Pendiente (Sprint 2)` | [#64](https://github.com/Cristhian-S1/ondina-erp/issues/64) | Placeholder | `Ubicaciones.tsx` renders `ModulePage`; GPS flow absent. |
| [HU-17](../product/stories/administration.md#hu-17) | `Pendiente (Sprint 2)` | [#65](https://github.com/Cristhian-S1/ondina-erp/issues/65) | No UI | Product catalog reads exist; dedicated administration form absent. |

## Production and warehouse

| Story | Sprint | GitHub | Implementation | Evidence or limit |
| --- | --- | --- | --- | --- |
| [HU-19](../product/stories/production.md#hu-19) | `Completada — en revisión` | [#16](https://github.com/Cristhian-S1/ondina-erp/issues/16) | Present | Production empty-container section and stock queries. † |
| [HU-20](../product/stories/production.md#hu-20) | `Completada — en revisión` | [#14](https://github.com/Cristhian-S1/ondina-erp/issues/14) | Present | `registrarProduccion` inserts production; database owns stock effects. † |
| [HU-21](../product/stories/production.md#hu-21) | `Completada — en revisión` | [#15](https://github.com/Cristhian-S1/ondina-erp/issues/15) | Present | `HistorialProduccion.tsx` and history queries. † |
| [HU-22](../product/stories/production.md#hu-22) | `Completada — en revisión` | [#13](https://github.com/Cristhian-S1/ondina-erp/issues/13) | Present | `IndicadoresProduccion.tsx` and production data/metrics. † |
| [HU-23](../product/stories/production.md#hu-23) | `Completada — en revisión` | [#12](https://github.com/Cristhian-S1/ondina-erp/issues/12) | Partial | The incidents section inserts into `mermas`; general incidents require acceptance review. † Open follow-up: [#70](https://github.com/Cristhian-S1/ondina-erp/issues/70) (separate descriptive incidents from stock losses). |
| [HU-24](../product/stories/warehouse.md#hu-24) | `Completada — en revisión` | [#9](https://github.com/Cristhian-S1/ondina-erp/issues/9) | Present | `Stock.tsx` and stock services. Open follow-ups: [#48](https://github.com/Cristhian-S1/ondina-erp/issues/48) (Realtime), [#49](https://github.com/Cristhian-S1/ondina-erp/issues/49) (automatic freshness and error states). |
| [HU-25](../product/stories/warehouse.md#hu-25) | `Completada — en revisión` | [#7](https://github.com/Cristhian-S1/ondina-erp/issues/7) | Present | `Despachos.tsx` and dispatch services. Open follow-ups: [#42](https://github.com/Cristhian-S1/ondina-erp/issues/42) (duplicates/conflicts), [#49](https://github.com/Cristhian-S1/ondina-erp/issues/49) (error states). |
| [HU-26](../product/stories/warehouse.md#hu-26) | `Pendiente (Sprint 2)` | [#66](https://github.com/Cristhian-S1/ondina-erp/issues/66) | Backend only | Adjustment rules are in SQL; no dedicated adjustment UI. |
| [HU-27](../product/stories/warehouse.md#hu-27) | `Completada — en revisión` | [#8](https://github.com/Cristhian-S1/ondina-erp/issues/8) | Present | `Devoluciones.tsx` and product-return services. Open follow-ups: [#33](https://github.com/Cristhian-S1/ondina-erp/issues/33) (products and containers returned in one transaction), [#42](https://github.com/Cristhian-S1/ondina-erp/issues/42) (duplicates/conflicts). |
| [HU-28](../product/stories/warehouse.md#hu-28) | `Completada — en revisión` | [#10](https://github.com/Cristhian-S1/ondina-erp/issues/10) | Present | `Devoluciones.tsx` and container-return services. Open follow-ups: [#33](https://github.com/Cristhian-S1/ondina-erp/issues/33), [#42](https://github.com/Cristhian-S1/ondina-erp/issues/42). |
| [HU-29](../product/stories/warehouse.md#hu-29) | `Pendiente (Sprint 2)` | [#67](https://github.com/Cristhian-S1/ondina-erp/issues/67) | Partial | Production has a merma form, but the requested warehouse/dispatch flow is absent. |
| [HU-31](../product/stories/authentication.md#hu-31) | `Completada — en revisión` | [#11](https://github.com/Cristhian-S1/ondina-erp/issues/11) | Partial | Login/role routing exists; the session-restoration race (OND-82e) was fixed in `develop` on 2026-10-13. Open follow-ups: [#36](https://github.com/Cristhian-S1/ondina-erp/issues/36) (role journeys untested), [#44](https://github.com/Cristhian-S1/ondina-erp/issues/44) (Supabase Auth sessions and protection). |

† An administrator without an operational branch now sees an explicit message instead of the endless loading state; choosing a branch is still pending ([#37](https://github.com/Cristhian-S1/ondina-erp/issues/37)). Applies to the rows marked †.

## Scope and verification

HU-18 (day closing) and HU-30 (offline operations) were removed from delivery scope on 2026-08-01; IDs are not reused. This does not silently delete the corresponding business needs from RF/RNF: [RNF-01](../product/requirements.md) was narrowed to intermittent connectivity on 2026-10-13.
The removal of `docs/datos_planilla_manual_fisico.md` in commit `edafa8b` is ratified (2026-10-13); the file remains recoverable from Git history.
Current blockers include schema reconciliation, anonymous commercial-view access and administrator sucursal handling. See [dated audit evidence](../archive/audits/2026-10-09/auditoria-integral-2026-10-09.md) and [GitHub issues](https://github.com/Cristhian-S1/ondina-erp/issues).
Cross-cutting platform work is tracked once here instead of per story: schema reconciliation (#28), RLS/grants and identity isolation (#29, #30), stock-reversal and audit guarantees (#31, #32), real migrations and pgTAP in CI (#40), backup recovery (#41) and isolated role journeys (#43).
Frontend tests are in each domain. Do not copy historical test counts or browser checks into a current acceptance claim; record fresh execution evidence in the relevant Beads issue.
