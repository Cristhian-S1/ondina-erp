# Worker reports — deep audit 2026-10-13

Raw, area-level evidence behind [auditoria-profunda-2026-10-13.md](../auditoria-profunda-2026-10-13.md) and [evaluacion-auditoria-2026-10-09.md](../evaluacion-auditoria-2026-10-09.md). Reports are in Spanish; this index is agent-facing.

All workers were read-only auditors in the shared checkout (`develop` = `origin/develop` at `a0a8f65`). Each was allowed to write one report file and nothing else. The coordinator validated every delivery by checking `git status` (only the report changed), reading the full report and re-running at least one key piece of evidence before accepting it.

## Orca receipts

Run `run_af5dd59a6889`. Coordinator: Claude Code (Opus 5.5) in terminal `term_fe8cc23f-…`. Placement: `--worktree current` for all workers, so no new worktrees were created and no setup ran.

| Area | Report | Client / effective model | Task | Dispatch | Outcome |
| --- | --- | --- | --- | --- | --- |
| Backend schema/RLS + RPC/stock | [backend-schema-rpc.md](backend-schema-rpc.md) | codex / `gpt-6.1-sol` (`launch.effective`) | `task_fd6aafdf5150` | `ctx_30febce22f9a` | succeeded |
| Frontend UI + data | [frontend-ui-datos.md](frontend-ui-datos.md) | codex / `gpt-6.1-sol` (`launch.effective`) | `task_71d194ebeda4` | `ctx_1af8ebd10b3b` | succeeded |
| Testing + documentation | [testing-documentacion.md](testing-documentacion.md) | opencode / DeepSeek V4.1 Flash (OpenCode Go), seen in the TUI | `task_9111c471bd80` | `ctx_56cd51e252f6` | succeeded |
| CI/CD + operations | [ci-cd-operacion.md](ci-cd-operacion.md) | opencode / DeepSeek V4.1 Flash (OpenCode Go), seen in the TUI | `task_6b51b3e4058d` | `ctx_0c6591118052` | succeeded |
| Security + independent review | [seguridad-revision.md](seguridad-revision.md) | codex / `gpt-6.1-sol` (`launch.effective`) | `task_825a57b60849` | `ctx_0f273a505c5c` | succeeded |

Waves, never more than 3 concurrent workers: the first wave was backend, frontend and testing/docs. CI/CD started after testing/docs settled, and security after frontend settled.

## Runtime notes

- OpenCode model override: `worker-start --agent opencode --model …` failed with `capability_unsupported`, and `--agent opencode2 --model …` was also refused. The workers were launched without `--model`. The OpenCode config sets no `model`, so the TUI used the most recent model in `~/.local/state/opencode/model.json`. The coordinator confirmed "DeepSeek V4.1 Flash OpenCode Go · max" on the worker screen via `worker-read`. `launch.effective.model` is `null` for these two workers, so the model is verified from the screen, not from the receipt.
- Codex launched with `worker-start --model gpt-6.1-sol` directly. The "Hooks need review" prompt did not appear.
- `worker-release` returned `state: retained, reason: user_takeover, processAction: none` for all five. `worker-list --terminal-state reclaimable` returns none, and the terminals are `user_owned` and still live. Closing them is the user's decision.
- Orca repo setup hook verified as `npm ci --prefix frontend` (`repo list --json`).
- The backend worker used a throwaway `postgres:16` Docker container (no network, synthetic data) and removed it afterwards. The `postgres` container that exited two months ago predates this audit.
- The CI/CD and security workers made read-only `gh api` calls (branch protection, environments, deployments, security_and_analysis). There were no GitHub writes, Supabase remote access or Vercel calls.
