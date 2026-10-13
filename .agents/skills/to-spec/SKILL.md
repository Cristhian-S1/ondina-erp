---
name: to-spec
description: "Use when synthesizing already-discussed requirements and decisions into an implementable specification."
disable-model-invocation: true
---

# From Conversation to Specification

Synthesize agreed context; do not restart an interview that has already been resolved. Read the [tooling guide](../../../docs/agents/tools.md) and relevant domain decisions. Use CodeGraph when code evidence is missing.

## Specification structure

- **Problem:** the user's concrete problem and affected actors.
- **Expected outcome:** relevant user stories and observable acceptance criteria, proportional to the change.
- **Implementation decisions:** affected interfaces, data contracts, approved trade-offs and constraints. Reference verified paths when they help the implementer; avoid speculative code listings.
- **Validation:** behavior to test, existing public test surfaces, suitable prior tests and database/browser checks that need a real isolated environment.
- **Out of scope:** explicit exclusions and unresolved decisions; distinguish these from approved requirements.
- **Supporting evidence:** concise references to a prototype, requirement, ADR or issue when it supplies necessary context.

Prefer existing test surfaces over new abstractions. If a prototype encodes an approved decision more clearly than prose, retain only the decision-bearing snippet and identify its origin.

Link the specification from Beads. A specification is not a second execution tracker. Reuse an existing issue when appropriate and publish or update GitHub only within the user's authorized scope. Existing screens do not establish production acceptance.
