# Ondina Agent Guide

## Current Repository State

- This repository currently contains project documentation and a Supabase/PostgreSQL schema; there is no application source tree, package manifest, lockfile, CI workflow, or test configuration to run.
- Do not invent build, lint, typecheck, or test commands. Re-check the root files when implementation code is introduced.
- The project targets a web system for sales, production, warehouse/dispatch, and administration, used mainly from tablets.
- The repository uses one future frontend application; domain work is separated by Git branches, not permanent module directories.

## Source Of Truth

- Read `AGENTS_para_equipo_desarrollo.md` before changing project artifacts; it contains the team's language, naming, SQL/RLS, testing, Git, and security conventions.
- Use `Plan De Desarrollo.md` for the delivery plan and chosen architecture: React + Vite + TypeScript, Supabase, Tailwind, TanStack Query, React Hook Form/Zod, Playwright, and Vercel are planned but not yet present in this repository.
- Use `docs/Problematica.md`, `docs/Requerimentos RF y RNF.md`, and `docs/Historias de Usuario.md` for business requirements. Treat unresolved requirements in the meeting notes as unresolved rather than silently deciding them.

## Database

- `bd/ondina_schema_supabase.sql` is the current canonical schema and includes Supabase Auth, RLS policies, triggers, audit logging, views, storage policy, and seed data.
- `bd/ondina_schema_supabase_v2.sql` is the simplified schema proposal, including multi-branch `sucursales`; validate it before converting it into migrations.
- `bd/ondina_sql.txt` is a legacy pgAdmin/ERD draft explicitly superseded by the canonical schema; do not extend or deploy it.
- The canonical schema is a complete transaction wrapped in `BEGIN`/`COMMIT`; apply it only to an isolated Supabase/PostgreSQL environment after checking compatibility with the target database.
- Preserve the database invariants already encoded in the canonical schema: RLS on exposed tables, role-based authorization in the database, audit triggers, configurable business parameters, and soft-delete/anulation for operational records.
- Inventory quantities are maintained by database triggers, not direct application updates. Dispatch adjustments only add detail rows during the configured window; they do not edit or subtract existing rows.
- Never store Supabase passwords in application tables; authentication belongs to Supabase Auth and `perfiles.id` references `auth.users.id`.

## Workflow Constraints

- Do not add dependencies, application scaffolding, migrations, CI/CD, or infrastructure configuration unless the user explicitly asks for implementation work.
- Do not commit secrets, `.env` files, credentials, real customer data, or generated database dumps.
- When implementation begins, add versioned migrations under a dedicated migration directory instead of editing an already-applied schema blindly; keep RLS and audit behavior with every exposed table.
- If documentation conflicts with executable SQL, prefer the canonical schema for the current data model and flag the discrepancy instead of guessing.

## Branch Organization

- Use `feature/ventas` for sales and customer work.
- Use `feature/bodega` for warehouse and dispatch work.
- Use `feature/produccion` for production work.
- Use `feature/administracion` for administration work.
- Keep domain work isolated by branch; do not create permanent module application directories.
- The integrated frontend on `develop` owns the React/Vite entrypoint, routing, session/role guards, shared layout, visual language, shared Supabase client, global error handling, and composition across domains.
- Do not access Supabase directly from presentation components; use shared services and validate external data with Zod.
- All domain changes must follow the same visual system: layout, navigation, typography, spacing, colors, touch targets, loading states, empty states, and error states.
- A domain branch may vary its workflow, but must not introduce an unrelated visual language or duplicate shared UI components.
