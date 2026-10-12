---
name: grill-with-docs
description: "Use when requirements, domain terms or design choices need clarification and approved decisions should be retained."
disable-model-invocation: true
---

# Clarify a Design

Read existing requirements and approved decisions first. Apply `domain-modeling` when business terminology is ambiguous; this workflow does not require a separate `/grilling` skill.

1. Identify assumptions that materially change the design. Ask one focused question at a time when the available context cannot answer it.
2. Use CodeGraph before locating or understanding indexed code. Explain discrepancies between the stated requirement and current behavior.
3. Use concrete scenarios to clarify permissions, stock movements, corrections and failure cases rather than inventing requirements.
4. Record approved terms and significant trade-offs according to the [domain guide](../../../docs/agents/domain.md). Track unresolved work in Beads.
5. When the user has already settled the design and requested implementation, proceed within that scope instead of repeating the interview.

Under Orca supervision, send blocking questions to the coordinator using the Dispatch preamble and its exact identity.
