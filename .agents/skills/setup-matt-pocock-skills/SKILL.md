---
name: setup-matt-pocock-skills
description: "Use when checking or repairing the issue tracker and domain documentation expected by the engineering skills."
disable-model-invocation: true
---

# Check Engineering Setup

Ondina already has a tracker and shared instructions. Inspect and repair the existing setup; do not initialize another one.

1. Read `AGENTS.md`, `CLAUDE.md`, the [tooling guide](../../../docs/agents/tools.md), and the [domain guide](../../../docs/agents/domain.md).
2. Run `bd prime` and `bd stats`. Preserve the embedded Dolt database, remote, issue identifiers and persistent memories.
3. Check installed skills against the [catalog](../../../docs/skills.md) and verify their references. Read existing glossary/ADR files when present; create them only for a real decision or resolved term.
4. Apply only changes covered by the request. Reuse the agreed tracker and documentation layout rather than replacing root instructions with a scaffold.

Do not switch to GitHub merely because a GitHub remote exists, create `.scratch/issues`, or add triage labels that no installed workflow consumes. If a required reference is missing, create the smallest useful reference.
