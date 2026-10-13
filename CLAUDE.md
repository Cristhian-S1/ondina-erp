# Ondina with Claude Code

@AGENTS.md

Use `docs/README.md` to find task-specific references. Path-scoped rules live in `.claude/rules/`; `.claude/skills/` links to the shared `.agents/skills/` source.
Keep personal preferences in ignored `.claude/settings.local.json` and credentials in local client configuration.
Inspect loaded instructions with `/context` and connections with `/mcp` when validating a session.
For requested Orca execution, start with `docs/orchestration/README.md`; do not choose models or dispatch from an unconfigured example profile.

## Commands

Run from `frontend/` (Node 22.12+; copy `.env.example` to `.env` with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`):

```bash
npm run dev                          # Vite dev server
npm run lint                         # ESLint
npm run build                        # tsc -b && vite build
npm run test                         # vitest run (jsdom)
npx vitest run src/domains/ventas/schemas.test.ts   # single file
npx vitest run -t "nombre del test"                 # single test by name
```

## Architecture

- `frontend/src/domains/index.ts` registers each `DomainModule` (`ventas`, `bodega`, `produccion`, `administracion`); `App.tsx` flattens their `routes` under `ProtectedRoute` + `DashboardLayout`. A new screen is added to its domain's `index.tsx`, not to `App.tsx`.
- Each domain owns `api.ts` (the only place that imports `src/lib/supabase`), `types.ts`, Zod `schemas.ts`/`validacion.ts`, pure calculations, hooks and pages, with tests colocated next to the code. Pages/hooks never call the Supabase client directly.
- `src/types/database-generated.types.ts` holds the generated DB types; `@` aliases `src/`. Shared helpers live in `src/lib` (`format.ts` for es-CL thousands formatting/parsing, `ui.ts` for shared Tailwind classes including error styles, `errors.ts`, `catalog.ts`).
- Stock movements, cancellation compensation and audit history live in the database (`supabase/migrations/`, design in `bd/`), so frontend changes must not reimplement them.
- Zod is v4 with `@hookform/resolvers` v5; use `z.input`/`z.output` types with React Hook Form. Responsive convention (tables become cards below 640px) is in `docs/engineering/frontend.md`.
