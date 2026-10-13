# User-Story Implementation

Code review baseline: `develop` commit `55d6c0f`, 2026-10-12; the code was re-reviewed on 2026-10-13 during the [deep audit](../archive/audits/2026-10-13/auditoria-profunda-2026-10-13.md), including the HU-31 session-restoration fix now in `develop` (#36 stays open until the role journeys are tested). This matrix describes repository implementation, not live database behavior or production acceptance. The [requirements](../product/requirements.md) and [story criteria](../product/stories/README.md) remain authoritative for intent.
**Present** means relevant code exists; **Partial** means an explicit gap is known; **Placeholder/No UI/Backend only** describe the missing delivery surface. Tasks and their current status live in Beads, not this table.

## Sales

| Story | Implementation | Evidence or limit |
| --- | --- | --- |
| [HU-01](../product/stories/sales.md#hu-01) | Present | `RegistrarVenta.tsx`, sales services and `registrar_venta`; authorization/stock require real integration checks. |
| [HU-02](../product/stories/sales.md#hu-02) | Present | `RegistrarCliente.tsx` and customer services. |
| [HU-03](../product/stories/sales.md#hu-03) | Present | `Carga.tsx`; seller-load query. |
| [HU-04](../product/stories/sales.md#hu-04) | Present | `Clientes.tsx`; route/customer queries. |
| [HU-05](../product/stories/sales.md#hu-05) | UI removed | No seller page; retained business requirement and database design need scope confirmation. |
| [HU-06](../product/stories/sales.md#hu-06) | Deferred | Sale document fields exist in SQL design; document issuance is not implemented. |
| [HU-07](../product/stories/sales.md#hu-07) | Partial | `Gastos.tsx` records expenses; receipt upload required by the story is absent. |
| [HU-08](../product/stories/sales.md#hu-08) | Present | `RankingVendedores.tsx`; verify view access against the security backlog. |
| [HU-09](../product/stories/sales.md#hu-09) | Present | `MiComision.tsx`; historical rules and permissions need database verification. |

## Administration

| Story | Implementation | Evidence or limit |
| --- | --- | --- |
| [HU-10](../product/stories/administration.md#hu-10) | Placeholder | `Administracion.tsx` renders `ModulePage`. |
| [HU-11](../product/stories/administration.md#hu-11) | No UI | `v_historial_cliente` is SQL design, not a delivered customer-history screen. |
| [HU-12](../product/stories/administration.md#hu-12) | No UI | Inactive-customer view design; alert workflow absent. |
| [HU-13](../product/stories/administration.md#hu-13) | Partial | Administrator return corrections in bodega; general record correction/audit UI incomplete. |
| [HU-14](../product/stories/administration.md#hu-14) | Placeholder | `Reportes.tsx` renders `ModulePage`. |
| [HU-15](../product/stories/administration.md#hu-15) | No UI | Commission-rule design; administration page has no configuration form. |
| [HU-16](../product/stories/administration.md#hu-16) | Placeholder | `Ubicaciones.tsx` renders `ModulePage`; GPS flow absent. |
| [HU-17](../product/stories/administration.md#hu-17) | No UI | Product catalog reads exist; dedicated administration form absent. |

## Production and warehouse

| Story | Implementation | Evidence or limit |
| --- | --- | --- |
| [HU-19](../product/stories/production.md#hu-19) | Present | Production empty-container section and stock queries. An administrator without an operational branch now sees an explicit message instead of the endless loading state (#37; selector still pending). |
| [HU-20](../product/stories/production.md#hu-20) | Present | `registrarProduccion` inserts production; database owns stock effects. An administrator without an operational branch now sees an explicit message instead of the endless loading state (#37; selector still pending). |
| [HU-21](../product/stories/production.md#hu-21) | Present | `HistorialProduccion.tsx` and history queries. An administrator without an operational branch now sees an explicit message instead of the endless loading state (#37; selector still pending). |
| [HU-22](../product/stories/production.md#hu-22) | Present | `IndicadoresProduccion.tsx` and production data/metrics. An administrator without an operational branch now sees an explicit message instead of the endless loading state (#37; selector still pending). |
| [HU-23](../product/stories/production.md#hu-23) | Partial | The incidents section inserts into `mermas`; general incidents require acceptance review. An administrator without an operational branch now sees an explicit message instead of the endless loading state (#37; selector still pending). |
| [HU-24](../product/stories/warehouse.md#hu-24) | Present | `Stock.tsx` and stock services. |
| [HU-25](../product/stories/warehouse.md#hu-25) | Present | `Despachos.tsx` and dispatch services. |
| [HU-26](../product/stories/warehouse.md#hu-26) | Backend only | Adjustment rules are in SQL; no dedicated adjustment UI. |
| [HU-27](../product/stories/warehouse.md#hu-27) | Present | `Devoluciones.tsx` and product-return services. |
| [HU-28](../product/stories/warehouse.md#hu-28) | Present | `Devoluciones.tsx` and container-return services. |
| [HU-29](../product/stories/warehouse.md#hu-29) | Partial | Production has a merma form, but the requested warehouse/dispatch flow is absent. |
| [HU-31](../product/stories/authentication.md#hu-31) | Partial | Login/role routing exists; the session-restoration race (OND-82e) was fixed in `develop` on 2026-10-13, but #36 stays open until the role journeys are tested. |

## Scope and verification

HU-18 (day closing) and HU-30 (offline operations) were removed from delivery scope on 2026-08-01; IDs are not reused. This does not silently delete the corresponding business needs from RF/RNF.
Current blockers include schema reconciliation, anonymous commercial-view access and administrator sucursal handling. See [dated audit evidence](../archive/audits/2026-10-09/auditoria-integral-2026-10-09.md) and [GitHub issues](https://github.com/Cristhian-S1/ondina-erp/issues).
Frontend tests are in each domain. Do not copy historical test counts or browser checks into a current acceptance claim; record fresh execution evidence in the relevant Beads issue.
