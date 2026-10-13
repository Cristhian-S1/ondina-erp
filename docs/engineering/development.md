# Development Workflow

## Local work

Use the commands in the [root README](../../README.md). Dependencies and executable frontend tests live in `frontend/`: use Node 22 (`frontend/.nvmrc`), `npm ci` with the lockfile, and copy `frontend/.env.example` to `.env` with development-only values.
Only public values belong in `VITE_*` (`VITE_SUPABASE_URL` and the anon/publishable key); never a `service_role` key — the CI build fails when `dist/` references it.
When `supabase/config.toml` exists in the repository, `supabase start` provides an isolated local Supabase stack for development; never copy real data or credentials into it. Until then, use a dedicated development project.
Read [architecture](architecture.md), [frontend](frontend.md) or [database](database.md) for the area being changed.

## Git and review

- `develop` is integration; `main` is the production release branch.
- Branch flow: create a short-lived branch from `develop` (for example `fix/<topic>` or `feature/<topic>`), open a PR to `develop`, and release with a PR from `develop` to `main`. The PR follows `.github/pull_request_template.md` (summary, linked issues, Beads ID, validation, database impact, UI evidence) and `.github/CODEOWNERS` requests the maintainer's review. The historical `feature/{ventas,bodega,produccion,administracion}` branches were archived as `archive/feature-*` tags on 2026-10-13.
- Archive a branch that is no longer active as a tag before deleting it (`git tag archive/<branch> <branch>`, push the tag, then delete the branch) so its commits remain reachable; do not archive or delete without a team decision.
- Integrate through reviewed PRs, normally with squash. Explicit user requests can authorize direct work on `develop`.
- Use Conventional Commits, an imperative summary and at most 72 characters; reference the HU or issue when useful.
- Review the diff and preserve other sessions' files, branches and stashes. Match commit/push/PR/deployment actions to the actual authorization.
- Explain the problem, resulting behavior, validation and material limits in the PR or handoff; link existing evidence instead of copying it.

## CI and deploy

`.github/workflows/ci.yml` runs lint, build, a privileged-key scan of `dist/`, the bundle budget and tests plus a basic migration-text check on PRs and pushes to develop/main. On a push to develop, the development deploy runs only after both jobs succeed; production deploys from `main` run lint/build/tests first and then wait for the `production` environment approval. Manual redeploy/rollback uses the `ref` input of the deploy workflows, available once those files exist on `main`. `.github/workflows/health.yml` checks production availability every 30 minutes and maintains the incident issue; see [CI and deployment](deployment.md) for details, the runbook and the limits that remain open.

## Quality

For frontend changes, run lint/build and tests exercising the affected behavior. Vitest/Testing Library does not certify remote RPC, RLS or trigger behavior; use isolated integration evidence for those changes.
For documentation/configuration, check syntax, references and dated claims. For changed scripts, verify the relevant real workflow without production fixtures. Repeat checks when new changes or unresolved failures justify it.
Keep tasks and execution status in Beads: run `bd prime` to recover durable context and close work only when its acceptance criteria are met. When `.codegraph/` exists, use CodeGraph to locate and understand code before falling back to ordinary search tools. A screen or successful build does not establish a user story's acceptance; consult [implementation status](../status/user-stories.md).
