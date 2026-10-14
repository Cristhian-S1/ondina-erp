# Architecture

## Application boundaries

| Area | Source and responsibility |
| --- | --- |
| Frontend | `frontend/`: React/Vite/TypeScript with Tailwind CSS, TanStack Query, React Hook Form and Zod; no UI component library (Mantine removed 2026-10-14). |
| Domain modules | `frontend/src/domains/`: ventas, bodega, produccion and administracion, composed as `DomainModule` entries. |
| Shared client | `frontend/src/lib/supabase.ts`; presentation consumes domain services/hooks. |
| Backend | Supabase PostgreSQL/Auth; stock, authorization and transaction integrity belong in the database. |
| Deployment | Vercel SPA configuration and GitHub Actions; database migrations are a separate manual workflow. |

The current architecture uses the Supabase client rather than a separate Node API. Introduce another backend or framework only for an approved need, not to satisfy an unrelated skill recipe.

## Frontend build shape

Domain pages are lazy-loaded per route with a `Suspense` fallback, and the built HTML preloads only the entry, `jsx-runtime` and `vendor-supabase` chunks: `frontend/vite.config.ts` pins `@supabase/*` (and its recursive dependencies) into a dedicated `vendor-supabase` group so shell imports cannot merge Supabase into the entry. `npm run size` gates five gzip metrics against `frontend/bundle-budget.json` and must be measured with a real `frontend/.env.local`. Details and current figures live in [frontend conventions](frontend.md) and [performance](performance.md).

## Data and access

Supabase Auth owns credentials; `perfiles` supplies application roles and sucursal association. Operational records reference customers, sellers, products and the responsible user.
Warehouse stock, empty containers and seller load represent different inventories. Database transactions/triggers maintain their movements; the browser must not duplicate that authority.
Persist sale prices and auditable corrections rather than recalculating history from current catalog values. Validate ownership, role, active profile and sucursal in backend authorization.

See [database rules](database.md) and the [canonical schema diagram](../../bd/diagramas_esquemas_mermaid.md). SQL files, migrations and deployed schema are distinct evidence sources.

## Scope boundaries

[Product context](../product/context.md) records objectives and unresolved business choices. [Stories](../product/stories/README.md) define acceptance; [status](../status/user-stories.md) records current implementation limits.
Offline support, receipts, GPS and the complete administration UI are not established by choosing Supabase, Vercel or React. Consult the relevant story and backlog before adding tools or changing scope.
