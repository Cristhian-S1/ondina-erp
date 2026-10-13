# Ondina Agent Guide

## Start here

Read `README.md`. Use `docs/README.md` to select the references needed for the task; do not preload the documentation tree or archives.
Ondina uses React/Vite/TypeScript in `frontend/` and Supabase as its backend. Start new integration work from `develop`.

## Sources and language

- Product requirements describe intent; code shows implementation; `docs/status/user-stories.md` records its limits. Resolve discrepancies before claiming acceptance.
- Write skills, agent instructions and engineering/operations Markdown in English. Business context and user-facing messages may remain in Spanish. Preserve existing schema/domain identifiers.
- Audit reports and persistent memories are dated evidence, not current operational guarantees.

## Workflow and tools

- Use Beads for tasks, dependencies and durable project context. Run `bd prime` when recovering context and `bd stats` for a summary; close work only when its acceptance criteria are met.
- When `.codegraph/` exists, use CodeGraph before locating or understanding code. Otherwise use ordinary tools without initializing an index.
- Select relevant skills from `.agents/skills/`; retain this shared source and its Claude symlinks. See `docs/skills.md`.
- Use Mem0 only with the correct user/project scope and available client connection. Read `docs/agents/tools.md` when configuring tools.
- For requested Orca supervision, read `docs/orchestration/README.md` and load the selected executable's guide. Models remain the user's choice.

## Invariants

- Keep domain logic under `frontend/src/domains/<domain>/`; presentation uses services/hooks and the shared Supabase client. Use strict TypeScript and `import type` for type-only imports.
- Database authorization must enforce identity, role and sucursal; navigation visibility does not replace RLS/grants.
- Preserve database-owned stock movements, cancellation compensation and audit history. Never store application passwords or privileged client keys.
- Do not run production `supabase db push` until schema/history reconciliation and isolated verification are complete. Read `docs/engineering/database.md` before database work.

## Verification and delivery

- For frontend changes, run lint/build and relevant tests from `frontend/`. For documentation/configuration, verify references, syntax, dates and supported commands.
- Review `git status` and the diff. Preserve other sessions' files, stashes and branches; report validation and its limits.
- Commit, publish or deploy only within the user's requested scope. A local commit request does not require a push; generic tool closeout defaults do not expand that scope.
