# Orca Orchestration

Use this section when supervised execution is requested. Claude Code coordinates Claude Code, Codex and OpenCode workers; the user selects models, recorded per role in [roles](roles.md). Read the task's Beads issue and load the version-matched `orca-cli`/`orchestration` guides before runtime actions.

| Need | Reference |
| --- | --- |
| Executable, runtime, repo and worktrees | [Setup](setup.md) |
| Client/model differences | [Clients](clients.md) |
| Roles, models, ownership and "done" | [Roles](roles.md) |
| Handoffs, human review and escalation | [Handoffs](handoffs.md) |
| Dispatch specification | [Task template](task-template.md) |
| Sprint 2 stages to dispatch (product plan, not orchestration) | [Sprint 2 plan](../status/sprint-2/README.md) |
| Profile template (values for commands) | [Example profile](profiles.example.json) |

## Execution boundaries

The catalog has eight worker slots and one coordinator. Start with at most three concurrent workers plus the coordinator, activating only independent work. A small task usually needs one implementer and a review.
The example has `enabled: false` and `model: null`. It is a project planning template, not native Orca configuration; reading it does not configure or start a fleet. The role/model table in [roles](roles.md) is the current user assignment; reconcile the ignored local profile with it before dispatch.
Beads owns product tasks/acceptance. Orca Run/Task/Dispatch owns execution attempts and references the Beads ID. Runtime receipts and verified results establish progress; a live terminal does not establish completion.

## Coordinator prompt

> Read docs/orchestration/README.md and the orca-cli/orchestration skills. Load the guides from the selected Orca executable. Review my local profiles and the Beads issue/dependencies. Select an independent wave with explicit file ownership, verified effective models and at most three workers. Within the requested execution scope, prepare runtime/worktrees from origin/develop, validate each delivery, settle its Dispatch and integrate authorized changes.

Requested Orca supervision must use its actual runtime rather than unregistered native subagents. Do not choose models for an empty profile or a role missing from the roles table. See [agent tools](../agents/tools.md) for client-specific MCP and memory configuration.
