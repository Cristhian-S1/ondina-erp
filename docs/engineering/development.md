# Development Workflow

## Local work

Use the commands in the [root README](../../README.md). Dependencies and executable frontend tests live in `frontend/`; use the lockfile with `npm ci` and development-only environment values.
Read [architecture](architecture.md), [frontend](frontend.md) or [database](database.md) for the area being changed.

## Git and review

- `develop` is integration; `main` is the production release branch. Domain branches are `feature/ventas`, `feature/bodega`, `feature/produccion` and `feature/administracion`.
- Integrate domain work through reviewed PRs, normally with squash. Explicit user requests can authorize direct work on `develop`.
- Use Conventional Commits, an imperative summary and at most 72 characters; reference the HU or issue when useful.
- Review the diff and preserve other sessions' files, branches and stashes. Match commit/push/PR/deployment actions to the actual authorization.
- Explain the problem, resulting behavior, validation and material limits in the PR or handoff; link existing evidence instead of copying it.

## Quality

For frontend changes, run lint/build and tests exercising the affected behavior. Vitest/Testing Library does not certify remote RPC, RLS or trigger behavior; use isolated integration evidence for those changes.
For documentation/configuration, check syntax, references and dated claims. For changed scripts, verify the relevant real workflow without production fixtures. Repeat checks when new changes or unresolved failures justify it.
Keep tasks and execution status in Beads. A screen or successful build does not establish a user story's acceptance; consult [implementation status](../status/user-stories.md).
