# Ondina ERP

Web ERP for bottled-water and ice distribution: sales, customers, warehouse/dispatch and production. The operational UI and business reference material are in Spanish.

## Project state

Sales, warehouse and production have implemented screens and services; administration and several acceptance criteria remain incomplete. Production readiness depends on resolving the open schema, authorization and integrity findings.
See [user-story implementation](docs/status/user-stories.md) for code evidence and [Beads/GitHub tooling](docs/agents/tools.md) for current work. Historical checks are dated evidence, not a live service guarantee.

## Quick start

Use Node.js 22 per `frontend/.nvmrc` and a development Supabase project:

```bash
cd frontend
npm ci
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for development.
npm run dev
```

Only public values belong in `VITE_*`: `VITE_SUPABASE_URL` and the anon/publishable key. Never set a `service_role` key there; CI fails if the built `dist/` references it.
When `supabase/config.toml` exists in the repository, `supabase start` brings up an isolated local Supabase stack; never copy real data or credentials into it.

Quality checks, from `frontend/`:

```bash
npm run lint
npm run build
npm run test
```

## Repository

| Path | Purpose |
| --- | --- |
| `frontend/` | React/Vite/TypeScript application, domain services and Vitest/Testing Library tests. |
| `bd/` | SQL design, business objects and diagrams. |
| `supabase/migrations/` | Versioned migrations; reconcile them with remote schema/history before deployment. |
| `.github/workflows/` | Declared CI and Vercel deployment workflows; the development deploy runs only after the CI checks pass. |
| `docs/` | [Task-based documentation index](docs/README.md). |
| `.agents/skills/` | Shared skill source, exposed to Claude through `.claude/skills/` symlinks. |

The frontend uses Tailwind/Mantine, TanStack Query, React Hook Form and Zod. Supabase provides PostgreSQL and Auth; related Storage/Realtime capabilities require feature-specific verification.

## Contributing

`develop` is the integration base; `main` is the production release branch. Use the [development workflow](docs/engineering/development.md) and [agent instructions](AGENTS.md).
Track durable work in Beads: run `bd prime` to recover context and keep status current, and start with `bash scripts/bootstrap-beads.sh` when restoring its local database; see [.beads/README.md](.beads/README.md).
When `.codegraph/` exists in the repository, use CodeGraph to locate and understand code before falling back to ordinary search tools.
Write agent instructions, skills and engineering documentation in English. Keep Spanish user-facing copy and business references. Load only the documents needed for the current task.
