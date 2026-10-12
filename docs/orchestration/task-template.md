# Worker Task Specification

Provide a bounded specification, retaining IDs emitted by Orca rather than inventing them.

## Context

- Beads issue and optional GitHub link; parent/real blockers.
- Objective, relevant requirement/story and verified current behavior.
- Existing worktree/base, selected client/model and effective launch evidence.

## Ownership and constraints

- Paths the worker may write and shared paths owned elsewhere.
- Required contracts, runtime/environment and permitted side effects.
- Scope exclusions and questions that must go to the coordinator.

## Acceptance and delivery

- Observable result and focused validation commands/fixtures.
- Report changed files, tests/evidence, limits and unresolved questions.
- Return the exact active Dispatch outcome through the runtime protocol; do not infer completion from terminal liveness.
- Commit/push/deploy only within the task's authorization; preserve other workers' changes and resources.

Use the [tooling](../agents/tools.md) and [development](../engineering/development.md) guides only as needed.
