# Orca Setup

## Resolve and load the guide

Read `orca-cli` first. Use `ORCA_CLI_COMMAND` when supplied, otherwise `orca-dev` in an Orca dev session, `orca-ide` on Linux outside a managed terminal, or `orca` in the other supported managed environments. Reuse the selected executable; do not fall through to another build.
Bare Linux `orca` can launch GNOME's screen reader. The examples below use `orca-ide`; substitute the executable verified for the session.

```bash
orca-ide skills get orca-cli --json
orca-ide skills get orchestration --json
orca-ide status --json
```

When startup is authorized and the app is stopped, use `open --json` and check status. For `runtime_access_denied`, fix sandbox access rather than restarting. Do not create Runs/workers while the runtime is inaccessible; discover unsupported flags with `--help`.

## Coordinator, repository and profiles

Run Claude Code in an Orca-managed coordinator terminal so the caller/inbox identity is known. Outside that terminal, use the selectors required by the guide; never infer IDs from a role name.
Discover the repository with `repo list --json`, register its real path if needed using the documented command, and retain the returned full ID. Verify the repo and base reference before changing settings.
Copy `profiles.example.json` to ignored `profiles.local.json`, select available models per role and review concurrency. This template supplies values for commands; it does not replace Orca's native configuration.

## Worktrees and dispatch

Use separate implementation worktrees from `origin/develop`, with one writer per shared path. Load conditional references before remote placement or uncertain recovery:

```bash
orca-ide skills get orchestration --reference references/placement-and-remote.md --json
orca-ide skills get orchestration --reference references/coordinator-loop.md --json
```

For the documented OpenCode model override, prepare an existing worktree before dispatch and verify host/client support. Inspect existing terminals; remove only an unused shell confirmed to belong to this setup.
Install dependencies and development-only environments per worker. Keep credentials out of Git and production out of fixtures.
The repo's Orca setup hook must be `npm ci --prefix frontend`. The root has no `package.json`, so the former `pnpm install` setup fails with `ERR_PNPM_NO_PKG_MANIFEST`. Until that hook is updated in Orca's repo settings, create worktrees with `--setup skip` and run `npm ci --prefix frontend` inside each worker's worktree.

## Supervised loop

Create a Run and dispatch the first independent wave using the current guide and [task template](task-template.md). Wait in bounded intervals for `worker_done`, `escalation` and `question`; use the Run selector when the guide requires it.
Validate receipts, active Dispatch identity, outcome, diff and evidence before integration. Reply to questions through the coordinator, settle the delivery before its ack, and release/reuse workers through the documented lifecycle.
For `outcome_unknown`, residual resources or timeouts, inspect the worker and follow its recovery action instead of blind retries. The selected executable's guide is authoritative for command syntax.
