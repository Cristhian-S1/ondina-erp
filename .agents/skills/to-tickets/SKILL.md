---
name: to-tickets
description: "Use when splitting an agreed specification or plan into verifiable tasks with real blocking dependencies."
disable-model-invocation: true
---

# From Specification to Tasks

Read the referenced specification and existing issues first. Ondina uses Beads for durable work and `external_ref` for its GitHub association; see [tooling](../../../docs/agents/tools.md).

## Decomposition

- Prefer narrow, complete vertical slices across the layers needed for a behavior: schema, service, UI and validation. Each slice must be demonstrable or independently verifiable and fit a fresh implementation session.
- For a broad mechanical refactor that cannot land as independent slices, use expand–migrate–contract: add the compatible form, migrate callers in bounded batches, then remove the old form. Keep intermediate integration green, or explicitly define the integration branch and final verification task.
- Each task states the problem, scope, ownership, constraints, observable acceptance criteria and validation. Use verified paths when useful; do not paste a speculative implementation.
- Add only dependencies that actually gate work. Separate independent work without assigning simultaneous writers to shared files.

## Record and execute

1. Reuse or link existing tasks instead of creating duplicates.
2. If the request authorizes the breakdown, create Beads tasks and add blocking edges with `bd dep add <issue> <blocker>`. Clarify only unresolved scope or dependency choices.
3. Work the ready frontier with `bd ready`; do not use Markdown status files or `.scratch/issues` as another tracker.
4. Publish or update GitHub when authorized and retain its URL. Creating child tasks does not complete the parent.

For supervised execution, Orca Tasks reference the Beads IDs; a Dispatch records an attempt. See [orchestration](../../../docs/orchestration/README.md).
