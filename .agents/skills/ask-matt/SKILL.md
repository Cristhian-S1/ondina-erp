---
name: ask-matt
description: "Use when choosing an installed skill or engineering workflow for an Ondina task."
disable-model-invocation: true
---

# Choose a Skill

Choose the shortest workflow that fits the request. Preserve decisions and authorization already given; do not restart setup or an interview by default.

## From idea to delivery

1. Use `grill-with-docs` only for unresolved requirements or design choices; use `domain-modeling` for ambiguous business terms.
2. If a question needs a runnable answer, use `prototype`. Use `handoff` when moving the investigation to another session, and retain the validated decision.
3. For substantial work, use `to-spec`, then `to-tickets` to create independently verifiable slices and their Beads dependencies. Small, agreed changes can proceed through the project development workflow directly.
4. Select the relevant implementation references below, validate the affected behavior, and use `code-review` for review. Do not invoke an uninstalled `/implement`, `/tdd`, `/triage`, or `/grilling` command.

## Task-specific references

| Need | Installed skills |
| --- | --- |
| Tasks, blockers and durable context | `beads` |
| Module design or architectural friction | `codebase-design`, `improve-codebase-architecture` |
| Supabase, Auth and database behavior | `supabase`, `supabase-postgres-best-practices` |
| React/Vite performance | `vercel-react-best-practices` |
| Test coverage and validation strategy | `testing-strategy` |
| Diff or pull request review | `code-review` |
| Orca worktrees or terminals | `orca-cli` |
| Supervised Orca workers | `orchestration` |
| Missing reusable capability | `find-skills` |

Use the [catalog](../../../docs/skills.md) and [tooling guide](../../../docs/agents/tools.md). If a capability is unavailable, describe the gap and continue authorized work with available tools.
